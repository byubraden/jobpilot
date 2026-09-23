import type {
  AgentRunRepository, ApplicationDraftRepository, FitAnalysisRepository, JobRepository,
  ProfileRepository, ResumeSuggestionsRepository,
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

function resultView<T>(payload: T | null, profileVersion: number | null, currentProfileVersion: number | null) {
  if (payload === null) return null;
  return {
    payload,
    profileVersion,
    isStale: profileVersion === null || profileVersion !== currentProfileVersion,
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
    return {
      job,
      currentProfileVersion,
      runs: runs.listForJob(id),
      fit: resultView(fitResults.get(id), fitResults.getProfileVersion(id), currentProfileVersion),
      resume: resultView(resumeResults.get(id), resumeResults.getProfileVersion(id), currentProfileVersion),
      application: resultView(applicationDrafts.get(id), applicationDrafts.getProfileVersion(id), currentProfileVersion),
    };
  }

  async createJob(input: unknown, providerKind: ProviderSelectionKind) {
    const parsed = JobInputSchema.parse(input);
    const coordinator = this.dependencies.createCoordinator(providerKind);
    const job = this.dependencies.jobs.create(parsed);
    const workflow = await coordinator.run(job.id);
    return { job, workflow, detail: this.getJobDetail(job.id) };
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
