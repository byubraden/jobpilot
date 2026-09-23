import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobInputSchema } from "../domain/schemas";
import { createDatabase } from "./connection";
import {
  AgentRunRepository,
  ApplicationDraftRepository,
  FitAnalysisRepository,
  JobRepository,
  ProfileRepository,
  ResumeSuggestionsRepository,
} from "./repositories";

const candidate = {
  headline: "Junior full-stack developer",
  education: ["MS Computer Science"],
  internships: [],
  projects: [],
  skills: ["TypeScript"],
  resumeText: "Built a full-stack capstone application.",
};
const jobInput = JobInputSchema.parse({ description: "A software engineering role requiring TypeScript. ".repeat(5) });
const fit = {
  job: { title: "Software Engineer", company: "Example Co", location: "Denver, CO", requiredSkills: ["TypeScript"] },
  score: 82,
  recommendation: "strong" as const,
  strengths: [{ claim: "TypeScript experience", evidence: "Capstone application" }],
  gaps: [],
  concerns: [],
};
const resume = {
  summary: "Full-stack developer",
  skillsToEmphasize: ["TypeScript"],
  bulletSuggestions: [{ originalFact: "Built a capstone app", suggestedBullet: "Built a full-stack app", rationale: "Relevant experience" }],
};
const draft = { coverLetter: "Dear hiring manager...", answers: [{ question: "Why us?", answer: "Your API work." }], needsUserInput: [] };

let db: Database.Database;
let profiles: ProfileRepository;
let jobs: JobRepository;
let runs: AgentRunRepository;

beforeEach(() => {
  db = createDatabase(":memory:");
  profiles = new ProfileRepository(db);
  jobs = new JobRepository(db);
  runs = new AgentRunRepository(db);
});

afterEach(() => db.close());

describe("database upgrades", () => {
  it("preserves legacy results with unknown provenance and accepts versioned writes", () => {
    const directory = mkdtempSync(join(tmpdir(), "jobpilot-db-upgrade-"));
    const path = join(directory, "legacy.sqlite");
    let opened: Database.Database | undefined;

    try {
      opened = new Database(path);
      opened.exec(`
        CREATE TABLE jobs (
          id INTEGER PRIMARY KEY, description TEXT NOT NULL, source_url TEXT,
          status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE fit_analyses (
          job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
          payload_json TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE resume_suggestions (
          job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
          payload_json TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE application_drafts (
          job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
          payload_json TEXT NOT NULL, updated_at TEXT NOT NULL
        );
      `);
      opened.prepare("INSERT INTO jobs (id, description, status, created_at, updated_at) VALUES (1, ?, 'found', ?, ?)")
        .run(jobInput.description, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
      opened.prepare("INSERT INTO fit_analyses (job_id, payload_json, updated_at) VALUES (1, ?, ?)")
        .run(JSON.stringify(fit), "2026-01-01T00:00:00.000Z");
      opened.close();
      opened = undefined;

      opened = createDatabase(path);
      const fits = new FitAnalysisRepository(opened);
      expect(fits.get(1)).toEqual(fit);
      expect(fits.getProfileVersion(1)).toBeNull();

      const profile = new ProfileRepository(opened).save(candidate);
      fits.upsert(1, profile.version, { ...fit, score: 91 });
      new ResumeSuggestionsRepository(opened).upsert(1, profile.version, resume);
      new ApplicationDraftRepository(opened).upsert(1, profile.version, draft);
      expect(fits.getProfileVersion(1)).toBe(1);
      expect(new ResumeSuggestionsRepository(opened).getProfileVersion(1)).toBe(1);
      expect(new ApplicationDraftRepository(opened).getProfileVersion(1)).toBe(1);
      opened.close();
      opened = undefined;

      opened = createDatabase(path);
      expect(new FitAnalysisRepository(opened).get(1)?.score).toBe(91);
      expect(new FitAnalysisRepository(opened).getProfileVersion(1)).toBe(1);
    } finally {
      opened?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("profiles", () => {
  it("increments versions and returns the latest profile", () => {
    expect(profiles.getCurrent()).toBeNull();
    const saved = profiles.save(candidate);
    expect(saved.version).toBe(1);
    expect(saved.education).toEqual(["MS Computer Science"]);

    const updated = profiles.save({ ...candidate, headline: "Updated" });
    expect(updated.version).toBe(2);
    expect(profiles.getCurrent()).toEqual(updated);
  });

  it("rejects invalid input without advancing the version", () => {
    expect(() => profiles.save({ ...candidate, skills: [] })).toThrow();
    expect(profiles.save(candidate).version).toBe(1);
  });
});

describe("jobs", () => {
  it("persists the parsed initial status and a status update", () => {
    const job = jobs.create(jobInput);
    expect(job.status).toBe("found");
    expect(jobs.updateStatus(job.id, "applied").status).toBe("applied");
    expect(jobs.get(job.id)?.status).toBe("applied");
    expect(jobs.list()).toHaveLength(1);
  });

  it("rejects backwards and terminal status transitions", () => {
    const job = jobs.create(jobInput);
    jobs.updateStatus(job.id, "applied");
    expect(() => jobs.updateStatus(job.id, "reviewing")).toThrow();
    jobs.updateStatus(job.id, "rejected");
    expect(() => jobs.updateStatus(job.id, "offer")).toThrow();
    expect(jobs.get(job.id)?.status).toBe("rejected");
  });
});

describe("agent runs", () => {
  it("stores model and profile version and completes a run", () => {
    const profile = profiles.save(candidate);
    const job = jobs.create(jobInput);
    const run = runs.start(job.id, "fit", "mock", "mock-v1", profile.version);
    expect(run.status).toBe("running");
    expect(run.profileVersion).toBe(1);
    expect(run.model).toBe("mock-v1");
    expect(runs.complete(run.id).status).toBe("complete");
    expect(runs.get(run.id)?.status).toBe("complete");
  });

  it("records failure without changing a completed fit result", () => {
    const profile = profiles.save(candidate);
    const job = jobs.create(jobInput);
    const results = new FitAnalysisRepository(db);
    const completed = runs.start(job.id, "fit", "mock", "mock-v1", profile.version);
    runs.completeWithResult(completed.id, { kind: "fit", payload: fit });

    const later = runs.start(job.id, "fit", "mock", "mock-v2", profile.version);
    expect(runs.fail(later.id, "Provider unavailable").status).toBe("failed");
    expect(runs.get(later.id)?.error).toBe("Provider unavailable");
    expect(results.get(job.id)).toEqual(fit);
  });

  it("rejects completing a run twice", () => {
    profiles.save(candidate);
    const job = jobs.create(jobInput);
    const run = runs.start(job.id, "fit", "mock", "mock-v1", 1);
    runs.complete(run.id);
    expect(() => runs.complete(run.id)).toThrow();
  });
});

describe("validated results", () => {
  it("reports the source profile version after the profile changes", () => {
    const profile = profiles.save(candidate);
    const job = jobs.create(jobInput);
    const results = new FitAnalysisRepository(db);
    const run = runs.start(job.id, "fit", "mock", "mock-v1", profile.version);
    runs.completeWithResult(run.id, { kind: "fit", payload: fit });

    expect(profiles.save({ ...candidate, headline: "Updated" }).version).toBe(2);
    expect(results.get(job.id)).toEqual(fit);
    expect(results.getProfileVersion(job.id)).toBe(1);
  });

  it("rolls back a retry's result replacement when completion fails", () => {
    const profile = profiles.save(candidate);
    const job = jobs.create(jobInput);
    const results = new FitAnalysisRepository(db);
    const first = runs.start(job.id, "fit", "mock", "mock-v1", profile.version);
    runs.completeWithResult(first.id, { kind: "fit", payload: fit });

    const retry = runs.start(job.id, "fit", "mock", "mock-v2", profile.version);
    db.exec(`CREATE TRIGGER reject_retry_completion BEFORE UPDATE OF status ON agent_runs
      WHEN NEW.id = ${retry.id} AND NEW.status = 'complete'
      BEGIN SELECT RAISE(ABORT, 'simulated completion failure'); END;`);

    expect(() => runs.completeWithResult(retry.id, { kind: "fit", payload: { ...fit, score: 95 } }))
      .toThrow("simulated completion failure");
    expect(results.get(job.id)).toEqual(fit);
    expect(results.getProfileVersion(job.id)).toBe(1);
    expect(runs.get(retry.id)?.status).toBe("running");

    expect(runs.fail(retry.id, "Completion failed").status).toBe("failed");
    expect(results.get(job.id)).toEqual(fit);
  });

  it("replaces fit results for the same job and agent kind", () => {
    const profile = profiles.save(candidate);
    const job = jobs.create(jobInput);
    const results = new FitAnalysisRepository(db);
    results.upsert(job.id, profile.version, fit);
    results.upsert(job.id, profile.version, { ...fit, score: 91 });
    expect(results.get(job.id)?.score).toBe(91);
    expect(db.prepare("SELECT count(*) AS count FROM fit_analyses WHERE job_id = ?").get(job.id)).toEqual({ count: 1 });
  });

  it("keeps each kind's result separate and validates writes", () => {
    const profile = profiles.save(candidate);
    const job = jobs.create(jobInput);
    const fits = new FitAnalysisRepository(db);
    const resumes = new ResumeSuggestionsRepository(db);
    const applications = new ApplicationDraftRepository(db);
    fits.upsert(job.id, profile.version, fit);
    resumes.upsert(job.id, profile.version, resume);
    applications.upsert(job.id, profile.version, draft);
    expect(fits.get(job.id)).toEqual(fit);
    expect(resumes.get(job.id)).toEqual(resume);
    expect(applications.get(job.id)).toEqual(draft);
    expect(() => fits.upsert(job.id, profile.version, { ...fit, score: 101 })).toThrow();
    expect(fits.get(job.id)).toEqual(fit);
  });
});
