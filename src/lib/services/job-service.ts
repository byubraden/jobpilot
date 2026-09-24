import type {
  AgentRunRepository, ApplicationDraftRepository, FitAnalysisRepository, JobRepository,
  JobRecord, ProfileRepository, ResumeSuggestionsRepository,
} from "../db/repositories";
import { AgentKindSchema, ApplicationStatusSchema, JobInputSchema, type AgentKind } from "../domain/schemas";
import type { JobWorkflowCoordinator, WorkflowResult } from "../workflow/coordinator";
import type { ProviderSelectionKind } from "./container";

type Dependencies = {
  profiles: ProfileRepository;
  jobs: JobRepository;
  runs: AgentRunRepository;
  fitResults: FitAnalysisRepository;
  resumeResults: ResumeSuggestionsRepository;
  applicationDrafts: ApplicationDraftRepository;
  createCoordinator: (providerKind: ProviderSelectionKind) => JobWorkflowCoordinator;
};

export type CreateJobResult = {
  job: JobRecord;
  workflow: WorkflowResult | null;
  workflowStartFailure: { code: "profile_required" | "retry_analysis"; message: string } | null;
};

function safeStartupFailure(error: unknown): NonNullable<CreateJobResult["workflowStartFailure"]> {
  if (error instanceof Error && error.message === "Candidate profile is required before running agents") {
    return { code: "profile_required", message: "Complete your candidate profile before analyzing this job." };
  }
  return { code: "retry_analysis", message: "Analysis could not start. Retry from the saved job." };
}

function resultView<T>(payload: T | null, profileVersion: number | null, currentProfileVersion: number | null, attemptId: number | null, latestAttemptId: number | null) {
  if (payload === null) return null;
  const isPreviousAttempt = latestAttemptId !== null && attemptId !== latestAttemptId;
  const isPreviousProfile = profileVersion === null || profileVersion !== currentProfileVersion;
  return {
    payload,
    profileVersion,
    attemptId,
    isPreviousAttempt,
    isPreviousProfile,
    isStale: isPreviousProfile || isPreviousAttempt,
  };
}

export class JobService {
  constructor(private readonly dependencies: Dependencies) {}

  listJobs() {
    return this.dependencies.jobs.list();
  }

  getJobDetail(id: number) {
    const { profiles, jobs, runs, fitResults, resumeResults, applicationDrafts } = this.dependencies;
    const job = jobs.get(id);
    if (!job) return null;
    const currentProfileVersion = profiles.getCurrent()?.version ?? null;
    const jobRuns = runs.listForJob(id);
    const latestAttemptId = jobRuns[0]?.attemptId ?? null;
    return {
      job,
      currentProfileVersion,
      latestAttemptId,
      runs: jobRuns,
      fit: resultView(fitResults.get(id), fitResults.getProfileVersion(id), currentProfileVersion, fitResults.getAttemptId(id), latestAttemptId),
      resume: resultView(resumeResults.get(id), resumeResults.getProfileVersion(id), currentProfileVersion, resumeResults.getAttemptId(id), latestAttemptId),
      application: resultView(applicationDrafts.get(id), applicationDrafts.getProfileVersion(id), currentProfileVersion, applicationDrafts.getAttemptId(id), latestAttemptId),
    };
  }

  async createJob(input: unknown, providerKind: ProviderSelectionKind): Promise<CreateJobResult> {
    const parsed = JobInputSchema.parse(input);
    const job = this.dependencies.jobs.create(parsed);
    try {
      const coordinator = this.dependencies.createCoordinator(providerKind);
      const workflow = await coordinator.run(job.id);
      return { job, workflow, workflowStartFailure: null };
    } catch (error) {
      return { job, workflow: null, workflowStartFailure: safeStartupFailure(error) };
    }
  }

  async analyzeJob(id: number, providerKind: ProviderSelectionKind) {
    const workflow = await this.dependencies.createCoordinator(providerKind).run(id);
    return this.withStoredJob(id, workflow);
  }

  async retryAgent(id: number, kind: AgentKind, providerKind: ProviderSelectionKind) {
    const validKind = AgentKindSchema.parse(kind);
    const workflow = await this.dependencies.createCoordinator(providerKind).retry(id, validKind);
    return this.withStoredJob(id, workflow);
  }

  changeJobStatus(id: number, status: unknown) {
    return this.dependencies.jobs.updateStatus(id, ApplicationStatusSchema.parse(status));
  }

  private withStoredJob(id: number, workflow: WorkflowResult) {
    const job = this.dependencies.jobs.get(id);
    if (!job) throw new Error(`Job ${id} not found`);
    return { job, workflow, detail: this.getJobDetail(id) };
  }
}
