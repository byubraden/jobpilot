import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { MockProvider } from "../ai/mock-provider";
import type { AIProvider, AIRequest, AIResponse } from "../ai/provider";
import { createDatabase } from "../db/connection";
import {
  AgentRunRepository, ApplicationDraftRepository, FitAnalysisRepository, JobRepository,
  ProfileRepository, ResumeSuggestionsRepository,
} from "../db/repositories";
import { JobWorkflowCoordinator } from "../workflow/coordinator";
import { createProvider, type ProviderSelectionKind } from "./container";
import { JobService } from "./job-service";

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
afterEach(() => db.close());

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
    expect(result.workflow.steps.map((step) => step.status)).toEqual(["complete", "complete", "complete"]);
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

  it("requires explicit provider selection and does not substitute a live provider", () => {
    expect(createProvider("mock").kind).toBe("mock");
    expect(() => createProvider("ollama")).toThrow(/not yet configured/i);
    expect(() => createProvider("anthropic")).toThrow(/not yet configured/i);
  });
});
