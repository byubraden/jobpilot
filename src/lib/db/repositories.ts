import type Database from "better-sqlite3";
import type { ZodType } from "zod";
import {
  AgentKindSchema,
  ApplicationDraftSchema,
  ApplicationStatusSchema,
  CandidateProfileInputSchema,
  FitAnalysisSchema,
  JobInputSchema,
  ProviderKindSchema,
  ResumeSuggestionsSchema,
  RunStatusSchema,
  type AgentKind,
  type ApplicationDraft,
  type ApplicationStatus,
  type CandidateProfileInput,
  type FitAnalysis,
  type JobInput,
  type ProviderKind,
  type ResumeSuggestions,
  type RunStatus,
} from "../domain/schemas";

export type CandidateProfileRecord = CandidateProfileInput & {
  id: number;
  version: number;
  createdAt: string;
};

export type JobRecord = JobInput & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export type AgentRunRecord = {
  id: number;
  jobId: number;
  kind: AgentKind;
  provider: ProviderKind;
  model: string;
  profileVersion: number;
  status: RunStatus;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type AgentResult =
  | { kind: "fit"; payload: FitAnalysis }
  | { kind: "resume"; payload: ResumeSuggestions }
  | { kind: "application"; payload: ApplicationDraft };

type ProfileRow = {
  id: number; version: number; headline: string; education_json: string;
  internships_json: string; projects_json: string; skills_json: string;
  preferences: string | null; resume_text: string; created_at: string;
};
type JobRow = {
  id: number; description: string; source_url: string | null;
  status: string; created_at: string; updated_at: string;
};
type RunRow = {
  id: number; job_id: number; kind: string; provider: string; model: string;
  profile_version: number; status: string; error: string | null;
  started_at: string; finished_at: string | null;
};

function mapProfile(row: ProfileRow): CandidateProfileRecord {
  const input = CandidateProfileInputSchema.parse({
    headline: row.headline,
    education: JSON.parse(row.education_json),
    internships: JSON.parse(row.internships_json),
    projects: JSON.parse(row.projects_json),
    skills: JSON.parse(row.skills_json),
    ...(row.preferences === null ? {} : { preferences: row.preferences }),
    resumeText: row.resume_text,
  });
  return { ...input, id: row.id, version: row.version, createdAt: row.created_at };
}

function mapJob(row: JobRow): JobRecord {
  const input = JobInputSchema.parse({
    description: row.description,
    ...(row.source_url === null ? {} : { sourceUrl: row.source_url }),
    status: row.status,
  });
  return { ...input, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapRun(row: RunRow): AgentRunRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    kind: AgentKindSchema.parse(row.kind),
    provider: ProviderKindSchema.parse(row.provider),
    model: row.model,
    profileVersion: row.profile_version,
    status: RunStatusSchema.parse(row.status),
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export class ProfileRepository {
  constructor(private readonly db: Database.Database) {}

  getCurrent(): CandidateProfileRecord | null {
    const row = this.db.prepare("SELECT * FROM candidate_profiles ORDER BY version DESC LIMIT 1").get() as ProfileRow | undefined;
    return row ? mapProfile(row) : null;
  }

  save(input: CandidateProfileInput): CandidateProfileRecord {
    const profile = CandidateProfileInputSchema.parse(input);
    return this.db.transaction(() => {
      const version = (this.getCurrent()?.version ?? 0) + 1;
      this.db.prepare(`INSERT INTO candidate_profiles
        (version, headline, education_json, internships_json, projects_json, skills_json, preferences, resume_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        version, profile.headline, JSON.stringify(profile.education), JSON.stringify(profile.internships),
        JSON.stringify(profile.projects), JSON.stringify(profile.skills), profile.preferences ?? null,
        profile.resumeText, new Date().toISOString(),
      );
      return this.getCurrent()!;
    })();
  }
}

const statusOrder: ApplicationStatus[] = ["found", "reviewing", "ready", "applied", "interviewing", "offer"];

function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return true;
  if (from === "rejected" || from === "offer") return false;
  if (to === "rejected") return true;
  return statusOrder.indexOf(to) > statusOrder.indexOf(from);
}

export class JobRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: JobInput): JobRecord {
    const job = JobInputSchema.parse(input);
    const now = new Date().toISOString();
    const result = this.db.prepare("INSERT INTO jobs (description, source_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(job.description, job.sourceUrl ?? null, job.status, now, now);
    return this.get(Number(result.lastInsertRowid))!;
  }

  get(id: number): JobRecord | null {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
    return row ? mapJob(row) : null;
  }

  list(): JobRecord[] {
    return (this.db.prepare("SELECT * FROM jobs ORDER BY created_at DESC, id DESC").all() as JobRow[]).map(mapJob);
  }

  updateStatus(id: number, status: ApplicationStatus): JobRecord {
    const next = ApplicationStatusSchema.parse(status);
    const current = this.get(id);
    if (!current) throw new Error(`Job ${id} not found`);
    if (!canTransition(current.status, next)) throw new Error(`Invalid job status transition: ${current.status} → ${next}`);
    this.db.prepare("UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?")
      .run(next, new Date().toISOString(), id);
    return this.get(id)!;
  }
}

export class AgentRunRepository {
  constructor(private readonly db: Database.Database) {}

  start(jobId: number, kind: AgentKind, provider: ProviderKind, model: string, profileVersion: number): AgentRunRecord {
    const validKind = AgentKindSchema.parse(kind);
    const validProvider = ProviderKindSchema.parse(provider);
    if (!model.trim()) throw new Error("Model is required");
    if (!Number.isInteger(profileVersion) || profileVersion < 1) throw new Error("Valid profile version is required");
    const result = this.db.prepare(`INSERT INTO agent_runs
      (job_id, kind, provider, model, profile_version, status, started_at)
      VALUES (?, ?, ?, ?, ?, 'running', ?)`).run(jobId, validKind, validProvider, model, profileVersion, new Date().toISOString());
    return this.get(Number(result.lastInsertRowid))!;
  }

  get(id: number): AgentRunRecord | null {
    const row = this.db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as RunRow | undefined;
    return row ? mapRun(row) : null;
  }

  listForJob(jobId: number): AgentRunRecord[] {
    return (this.db.prepare("SELECT * FROM agent_runs WHERE job_id = ? ORDER BY id DESC").all(jobId) as RunRow[]).map(mapRun);
  }

  complete(id: number): AgentRunRecord {
    return this.finish(id, "complete", null);
  }

  completeWithResult(id: number, result: AgentResult): AgentRunRecord {
    return this.db.transaction(() => {
      const run = this.get(id);
      if (!run || run.status !== "running") throw new Error(`Running agent run ${id} not found`);
      if (run.kind !== result.kind) throw new Error(`Result kind ${result.kind} does not match run kind ${run.kind}`);

      switch (result.kind) {
        case "fit":
          new FitAnalysisRepository(this.db).upsert(run.jobId, run.profileVersion, result.payload);
          break;
        case "resume":
          new ResumeSuggestionsRepository(this.db).upsert(run.jobId, run.profileVersion, result.payload);
          break;
        case "application":
          new ApplicationDraftRepository(this.db).upsert(run.jobId, run.profileVersion, result.payload);
          break;
      }
      return this.complete(id);
    })();
  }

  fail(id: number, error: string): AgentRunRecord {
    if (!error.trim()) throw new Error("Failure reason is required");
    return this.finish(id, "failed", error);
  }

  private finish(id: number, status: "complete" | "failed", error: string | null): AgentRunRecord {
    const result = this.db.prepare(`UPDATE agent_runs SET status = ?, error = ?, finished_at = ?
      WHERE id = ? AND status = 'running'`).run(status, error, new Date().toISOString(), id);
    if (result.changes !== 1) throw new Error(`Running agent run ${id} not found`);
    return this.get(id)!;
  }
}

class ResultRepository<T> {
  constructor(private readonly db: Database.Database, private readonly table: string, private readonly schema: ZodType<T>) {}

  upsert(jobId: number, profileVersion: number, input: T): T {
    const value = this.schema.parse(input);
    if (!Number.isInteger(profileVersion) || profileVersion < 1) throw new Error("Valid profile version is required");
    this.db.prepare(`INSERT INTO ${this.table} (job_id, profile_version, payload_json, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET profile_version = excluded.profile_version,
        payload_json = excluded.payload_json, updated_at = excluded.updated_at`)
      .run(jobId, profileVersion, JSON.stringify(value), new Date().toISOString());
    return value;
  }

  get(jobId: number): T | null {
    const row = this.db.prepare(`SELECT payload_json FROM ${this.table} WHERE job_id = ?`).get(jobId) as { payload_json: string } | undefined;
    return row ? this.schema.parse(JSON.parse(row.payload_json)) : null;
  }

  getProfileVersion(jobId: number): number | null {
    const row = this.db.prepare(`SELECT profile_version FROM ${this.table} WHERE job_id = ?`).get(jobId) as { profile_version: number } | undefined;
    return row?.profile_version ?? null;
  }
}

export class FitAnalysisRepository extends ResultRepository<FitAnalysis> {
  constructor(db: Database.Database) { super(db, "fit_analyses", FitAnalysisSchema); }
}

export class ResumeSuggestionsRepository extends ResultRepository<ResumeSuggestions> {
  constructor(db: Database.Database) { super(db, "resume_suggestions", ResumeSuggestionsSchema); }
}

export class ApplicationDraftRepository extends ResultRepository<ApplicationDraft> {
  constructor(db: Database.Database) { super(db, "application_drafts", ApplicationDraftSchema); }
}
