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
  readonly fixtures: Partial<Record<AgentKind, unknown>> = {};

  generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
    this.tasks.push(request.task);
    return new MockProvider({ errors: this.errors, fixtures: this.fixtures }).generate(request);
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

function makeCoordinator(aiProvider: AIProvider): JobWorkflowCoordinator {
  return new JobWorkflowCoordinator({
    provider: aiProvider, profiles, jobs, runs, fitResults, resumeResults, applicationDrafts,
  });
}

beforeEach(() => {
  db = createDatabase(":memory:");
  provider = new RecordingProvider();
  profiles = new ProfileRepository(db);
  jobs = new JobRepository(db);
  runs = new AgentRunRepository(db);
  fitResults = new FitAnalysisRepository(db);
  resumeResults = new ResumeSuggestionsRepository(db);
  applicationDrafts = new ApplicationDraftRepository(db);
  coordinator = makeCoordinator(provider);
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

  it("retains v1 results as stale when a v2 run fails", async () => {
    const firstProfile = profiles.save(candidate);
    const job = jobs.create(jobInput);
    await coordinator.run(job.id);
    const originalFit = fitResults.get(job.id);
    const originalResume = resumeResults.get(job.id);
    const originalDraft = applicationDrafts.get(job.id);
    const currentProfile = profiles.save({ ...candidate, headline: "Senior developer" });
    provider.errors.fit = new Error("temporary failure");

    const current = await coordinator.run(job.id);

    expect(current.steps.map((step) => step.status)).toEqual(["failed", "pending", "pending"]);
    expect(currentProfile.version).toBe(2);
    expect(fitResults.get(job.id)).toEqual(originalFit);
    expect(resumeResults.get(job.id)).toEqual(originalResume);
    expect(applicationDrafts.get(job.id)).toEqual(originalDraft);
    expect([
      fitResults.getProfileVersion(job.id),
      resumeResults.getProfileVersion(job.id),
      applicationDrafts.getProfileVersion(job.id),
    ]).toEqual([firstProfile.version, firstProfile.version, firstProfile.version]);
    expect(runs.listForJob(job.id)[0]).toMatchObject({ kind: "fit", status: "failed", profileVersion: currentProfile.version });
  });

  it("rejects an overlapping call across coordinator instances while another job can proceed", async () => {
    profiles.save(candidate);
    const firstJob = jobs.create(jobInput);
    const secondJob = jobs.create(JobInputSchema.parse({ description: "A different engineering role requiring React. ".repeat(5) }));
    let signalStarted!: () => void;
    let releaseFit!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const gate = new Promise<void>((resolve) => { releaseFit = resolve; });
    const entered: AgentKind[] = [];
    const gatedProvider: AIProvider = {
      kind: "mock",
      model: "deterministic",
      async generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
        entered.push(request.task);
        if (request.task === "fit" && entered.length === 1) {
          signalStarted();
          await gate;
        }
        return provider.generate(request);
      },
    };
    coordinator = makeCoordinator(gatedProvider);
    const secondCoordinator = makeCoordinator(gatedProvider);

    const first = coordinator.run(firstJob.id);
    await started;
    try {
      await expect(secondCoordinator.run(firstJob.id)).rejects.toThrow(/already running/i);
      await expect(secondCoordinator.retry(firstJob.id, "resume")).rejects.toThrow(/already running/i);
      expect(entered).toEqual(["fit"]);
      expect(runs.listForJob(firstJob.id)).toHaveLength(1);

      const independent = secondCoordinator.run(secondJob.id);
      expect(entered).toEqual(["fit", "fit"]);
      expect((await independent).steps.map((step) => step.status)).toEqual(["complete", "complete", "complete"]);
      expect(runs.listForJob(firstJob.id)[0].status).toBe("running");
    } finally {
      releaseFit();
      await first;
    }

    expect(runs.listForJob(firstJob.id).map((run) => run.status)).toEqual(["complete", "complete", "complete"]);
    expect((await secondCoordinator.run(firstJob.id)).steps.map((step) => step.status)).toEqual(["complete", "complete", "complete"]);
  });

  it("rolls back a generated result when run completion fails", async () => {
    const firstProfile = profiles.save(candidate);
    const job = jobs.create(jobInput);
    await coordinator.run(job.id);
    const originalFit = fitResults.get(job.id);
    const nextProfile = profiles.save({ ...candidate, headline: "Updated developer" });
    provider.fixtures.fit = { ...originalFit, score: 91 };
    db.exec(`CREATE TRIGGER reject_fit_completion BEFORE UPDATE OF status ON agent_runs
      WHEN NEW.job_id = ${job.id} AND NEW.kind = 'fit' AND NEW.profile_version = ${nextProfile.version} AND NEW.status = 'complete'
      BEGIN SELECT RAISE(ABORT, 'simulated completion failure'); END;`);

    const result = await coordinator.run(job.id);

    expect(result.steps.map((step) => step.status)).toEqual(["failed", "pending", "pending"]);
    expect(fitResults.get(job.id)).toEqual(originalFit);
    expect(fitResults.getProfileVersion(job.id)).toBe(firstProfile.version);
    expect(runs.listForJob(job.id)[0]).toMatchObject({ kind: "fit", status: "failed", profileVersion: nextProfile.version });
  });
});
