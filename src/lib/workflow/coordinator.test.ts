import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { MockProvider } from "../ai/mock-provider";
import type { AIProvider, AIRequest, AIResponse } from "../ai/provider";
import { createDatabase } from "../db/connection";
import {
  AgentRunRepository,
  ApplicationDraftRepository,
  FitAnalysisRepository,
  JobRepository,
  ProfileRepository,
  ResumeSuggestionsRepository,
} from "../db/repositories";
import { JobInputSchema, type AgentKind } from "../domain/schemas";
import { JobWorkflowCoordinator } from "./coordinator";

const candidate = {
  headline: "Junior full-stack developer",
  education: ["MS Computer Science"],
  internships: [],
  projects: [],
  skills: ["TypeScript"],
  resumeText: "Built a full-stack capstone application.",
};
const jobInput = JobInputSchema.parse({ description: "A software engineering role requiring TypeScript. ".repeat(5) });

class RecordingProvider implements AIProvider {
  readonly kind = "mock";
  readonly model = "deterministic";
  readonly tasks: AgentKind[] = [];
  readonly errors: Partial<Record<AgentKind, Error>> = {};

  generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
    this.tasks.push(request.task);
    return new MockProvider({ errors: this.errors }).generate(request);
  }
}

let db: Database.Database;
let provider: RecordingProvider;
let profiles: ProfileRepository;
let jobs: JobRepository;
let runs: AgentRunRepository;
let fitResults: FitAnalysisRepository;
let resumeResults: ResumeSuggestionsRepository;
let applicationDrafts: ApplicationDraftRepository;
let coordinator: JobWorkflowCoordinator;

beforeEach(() => {
  db = createDatabase(":memory:");
  provider = new RecordingProvider();
  profiles = new ProfileRepository(db);
  jobs = new JobRepository(db);
  runs = new AgentRunRepository(db);
  fitResults = new FitAnalysisRepository(db);
  resumeResults = new ResumeSuggestionsRepository(db);
  applicationDrafts = new ApplicationDraftRepository(db);
  coordinator = new JobWorkflowCoordinator({
    provider, profiles, jobs, runs, fitResults, resumeResults, applicationDrafts,
  });
});

afterEach(() => db.close());

describe("job workflow coordinator", () => {
  it("runs fit, résumé, and application in order and persists each validated result", async () => {
    const profile = profiles.save(candidate);
    const job = jobs.create(jobInput);

    const result = await coordinator.run(job.id);

    expect(result.steps.map((step) => step.status)).toEqual(["complete", "complete", "complete"]);
    expect(provider.tasks).toEqual(["fit", "resume", "application"]);
    expect(fitResults.get(job.id)?.score).toBe(82);
    expect(resumeResults.get(job.id)).not.toBeNull();
    expect(applicationDrafts.get(job.id)).not.toBeNull();
    expect(runs.listForJob(job.id).map((run) => run.status)).toEqual(["complete", "complete", "complete"]);
    expect(runs.listForJob(job.id).map((run) => run.profileVersion)).toEqual([profile.version, profile.version, profile.version]);
  });

  it("stops after a résumé failure while preserving the completed fit result", async () => {
    profiles.save(candidate);
    const job = jobs.create(jobInput);
    provider.errors.resume = new Error("secret provider details");

    const result = await coordinator.run(job.id);

    expect(result.steps.map((step) => step.status)).toEqual(["complete", "failed", "pending"]);
    expect(provider.tasks).toEqual(["fit", "resume"]);
    expect(fitResults.get(job.id)?.score).toBe(82);
    expect(resumeResults.get(job.id)).toBeNull();
    expect(applicationDrafts.get(job.id)).toBeNull();
    expect(runs.listForJob(job.id).map((run) => run.status)).toEqual(["failed", "complete"]);
    expect(runs.listForJob(job.id)[0].error).not.toContain("secret provider details");
  });

  it("retries résumé and its dependent application without rerunning fit", async () => {
    profiles.save(candidate);
    const job = jobs.create(jobInput);
    provider.errors.resume = new Error("temporary failure");
    await coordinator.run(job.id);
    delete provider.errors.resume;

    const result = await coordinator.retry(job.id, "resume");

    expect(result.steps.map((step) => step.status)).toEqual(["complete", "complete", "complete"]);
    expect(provider.tasks).toEqual(["fit", "resume", "resume", "application"]);
    expect(runs.listForJob(job.id).filter((run) => run.kind === "fit")).toHaveLength(1);
    expect(resumeResults.get(job.id)).not.toBeNull();
    expect(applicationDrafts.get(job.id)).not.toBeNull();
  });

  it("rejects a missing profile before calling the provider", async () => {
    const job = jobs.create(jobInput);

    await expect(coordinator.run(job.id)).rejects.toThrow(/profile/i);
    expect(provider.tasks).toEqual([]);
    expect(runs.listForJob(job.id)).toEqual([]);
  });

  it("rejects a missing job before calling the provider", async () => {
    profiles.save(candidate);

    await expect(coordinator.run(999)).rejects.toThrow(/job/i);
    expect(provider.tasks).toEqual([]);
  });
});
