import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { revalidatePath } from "next/cache";
import { MockProvider } from "../ai/mock-provider";
import type { AIProvider, AIRequest, AIResponse } from "../ai/provider";
import { createDatabase } from "../db/connection";
import {
  AgentRunRepository, ApplicationDraftRepository, FitAnalysisRepository, JobRepository,
  ProfileRepository, ResumeSuggestionsRepository,
} from "../db/repositories";
import { JobWorkflowCoordinator } from "../workflow/coordinator";
import { createProvider, getServices, type ProviderSelectionKind } from "./container";
import { JobService } from "./job-service";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const candidate = {
  headline: "Junior software engineer",
  education: ["Computer Science degree"],
  internships: [],
  projects: [],
  skills: ["TypeScript"],
  resumeText: "Built a production web application.",
};
const description = "A software engineering role requiring TypeScript and web application skills. ".repeat(4);

let db: Database.Database;
let profiles: ProfileRepository;
let jobs: JobRepository;
let runs: AgentRunRepository;
let fitResults: FitAnalysisRepository;
let resumeResults: ResumeSuggestionsRepository;
let applicationDrafts: ApplicationDraftRepository;
let service: JobService;
let provider: AIProvider;

function makeService(): JobService {
  return new JobService({
    profiles, jobs, runs, fitResults, resumeResults, applicationDrafts,
    createCoordinator(kind: ProviderSelectionKind) {
      if (kind !== "mock") throw new Error("Unexpected provider");
      return new JobWorkflowCoordinator({
        provider, profiles, jobs, runs, fitResults, resumeResults, applicationDrafts,
      });
    },
  });
}

beforeEach(() => {
  db = createDatabase(":memory:");
  profiles = new ProfileRepository(db);
  jobs = new JobRepository(db);
  runs = new AgentRunRepository(db);
  fitResults = new FitAnalysisRepository(db);
  resumeResults = new ResumeSuggestionsRepository(db);
  applicationDrafts = new ApplicationDraftRepository(db);
  provider = new MockProvider();
  service = makeService();
  profiles.save(candidate);
});
afterEach(() => {
  db.close();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("JobService", () => {
  it("persists a new job before the coordinator invokes its provider", async () => {
    let observedJobId: number | undefined;
    provider = {
      kind: "mock", model: "observing",
      async generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
        const stored = jobs.list()[0];
        expect(stored?.description).toBe(description);
        observedJobId = stored?.id;
        return new MockProvider().generate(request);
      },
    };

    const result = await service.createJob({ description }, "mock");

    expect(result.job.id).toBe(observedJobId);
    expect(jobs.get(result.job.id)?.description).toBe(description);
    expect(result.workflow?.steps.map((step) => step.status)).toEqual(["complete", "complete", "complete"]);
  });

  it("returns the one saved job with a safe startup failure when the profile is missing", async () => {
    db.prepare("DELETE FROM candidate_profiles").run();

    const result = await service.createJob({ description }, "mock");

    expect(jobs.list()).toHaveLength(1);
    expect(result.job).toEqual(jobs.list()[0]);
    expect(result.workflow).toBeNull();
    expect(result.workflowStartFailure).toMatchObject({ code: "profile_required", message: expect.stringMatching(/profile/i) });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("does not expose unexpected workflow startup error details", async () => {
    const failingService = new JobService({
      profiles, jobs, runs, fitResults, resumeResults, applicationDrafts,
      createCoordinator() {
        return {
          async run() { throw new Error("secret startup details"); },
        } as unknown as JobWorkflowCoordinator;
      },
    });

    const result = await failingService.createJob({ description }, "mock");

    expect(jobs.list()).toHaveLength(1);
    expect(result.job.id).toBe(jobs.list()[0].id);
    expect(result.workflowStartFailure).toMatchObject({ code: "retry_analysis", message: expect.stringMatching(/retry/i) });
    expect(JSON.stringify(result)).not.toContain("secret startup details");
  });

  it("rejects unknown application statuses without changing the stored job", () => {
    const job = jobs.create({ description, status: "found" });
    expect(() => service.changeJobStatus(job.id, "invented")).toThrow();
    expect(jobs.get(job.id)?.status).toBe("found");
  });

  it("returns the stored job when an agent step fails", async () => {
    const job = jobs.create({ description, status: "found" });
    provider = new MockProvider({ errors: { fit: new Error("provider secret") } });

    const result = await service.analyzeJob(job.id, "mock");

    expect(result.job).toEqual(job);
    expect(result.workflow.steps.map((step) => step.status)).toEqual(["failed", "pending", "pending"]);
    expect(result.workflow.steps[0].error).not.toContain("provider secret");
    expect(jobs.get(job.id)).toEqual(job);
  });

  it("labels retained results stale after the profile changes and a new run fails", async () => {
    const created = await service.createJob({ description }, "mock");
    profiles.save({ ...candidate, headline: "Updated candidate" });
    provider = new MockProvider({ errors: { fit: new Error("offline") } });

    const result = await service.analyzeJob(created.job.id, "mock");

    expect(result.workflow.steps[0].status).toBe("failed");
    const detail = service.getJobDetail(created.job.id);
    expect(detail?.currentProfileVersion).toBe(2);
    expect(detail?.fit).toMatchObject({ profileVersion: 1, isStale: true });
    expect(detail?.resume).toMatchObject({ profileVersion: 1, isStale: true });
    expect(detail?.application).toMatchObject({ profileVersion: 1, isStale: true });
    expect(detail?.fit?.payload.score).toBe(82);
  });

  it("creates only the explicitly selected local provider", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(createProvider("mock").kind).toBe("mock");
    expect(createProvider("ollama").kind).toBe("ollama");
    expect(() => createProvider("anthropic")).toThrow(/API key/i);
  });
});

describe("createJobAction after workflow startup failure", () => {
  it("returns the saved job and revalidates once without triggering a resubmission", async () => {
    vi.stubEnv("DATABASE_PATH", ":memory:");
    const { createJobAction } = await import("../../app/actions");
    const form = new FormData();
    form.set("description", description);
    form.set("providerKind", "mock");

    const result = await createJobAction(form);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.job.id).toBeGreaterThan(0);
    expect(result.data.workflow).toBeNull();
    expect(result.data.workflowStartFailure?.code).toBe("profile_required");
    expect(getServices().jobs.listJobs()).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith(`/jobs/${result.data.job.id}`);
    expect(vi.mocked(revalidatePath).mock.calls).toHaveLength(2);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
