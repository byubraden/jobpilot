import { runApplicationAgent } from "../agents/application-agent";
import { runFitAgent } from "../agents/fit-agent";
import { runResumeAgent } from "../agents/resume-agent";
import type { AIProvider } from "../ai/provider";
import { AIUnavailableError, AIValidationError } from "../ai/provider";
import type {
  AgentResult,
  AgentRunRepository,
  ApplicationDraftRepository,
  CandidateProfileRecord,
  FitAnalysisRepository,
  JobRecord,
  JobRepository,
  ProfileRepository,
  ResumeSuggestionsRepository,
} from "../db/repositories";
import {
  ApplicationDraftSchema,
  FitAnalysisSchema,
  ResumeSuggestionsSchema,
  type AgentKind,
} from "../domain/schemas";

const sequence: AgentKind[] = ["fit", "resume", "application"];

export type WorkflowStep = {
  kind: AgentKind;
  status: "pending" | "complete" | "failed";
  error: string | null;
};

export type WorkflowResult = {
  jobId: number;
  steps: WorkflowStep[];
};

export type JobWorkflowDependencies = {
  provider: AIProvider;
  profiles: ProfileRepository;
  jobs: JobRepository;
  runs: AgentRunRepository;
  fitResults: FitAnalysisRepository;
  resumeResults: ResumeSuggestionsRepository;
  applicationDrafts: ApplicationDraftRepository;
};

function safeError(error: unknown): string {
  if (error instanceof AIUnavailableError || error instanceof AIValidationError) return error.message;
  return "Agent step failed. Try again later.";
}

export class JobWorkflowCoordinator {
  private readonly activeJobs = new Set<number>();

  constructor(private readonly dependencies: JobWorkflowDependencies) {}

  async run(jobId: number): Promise<WorkflowResult> {
    return this.withJobLock(jobId, () => {
      const { profile, job } = this.loadInputs(jobId);
      return this.execute(jobId, profile, job, 0);
    });
  }

  async retry(jobId: number, kind: AgentKind): Promise<WorkflowResult> {
    return this.withJobLock(jobId, () => {
      const { profile, job } = this.loadInputs(jobId);
      const startIndex = sequence.indexOf(kind);
      if (startIndex < 0) throw new Error(`Unknown agent kind: ${kind}`);

      const latestRuns = new Map<AgentKind, ReturnType<AgentRunRepository["listForJob"]>[number]>();
      for (const run of this.dependencies.runs.listForJob(jobId)) {
        if (!latestRuns.has(run.kind)) latestRuns.set(run.kind, run);
      }
      if (latestRuns.get(kind)?.status !== "failed") {
        throw new Error(`No failed ${kind} step to retry for job ${jobId}`);
      }
      for (const priorKind of sequence.slice(0, startIndex)) {
        const prior = latestRuns.get(priorKind);
        const results = this.resultRepository(priorKind);
        if (prior?.status !== "complete" || prior.profileVersion !== profile.version ||
          results.get(jobId) === null || results.getProfileVersion(jobId) !== profile.version) {
          throw new Error(`Cannot retry ${kind} without a completed ${priorKind} step for the current profile`);
        }
      }
      return this.execute(jobId, profile, job, startIndex);
    });
  }

  private async withJobLock<T>(jobId: number, action: () => Promise<T>): Promise<T> {
    if (this.activeJobs.has(jobId)) throw new Error(`Workflow already running for job ${jobId}`);
    this.activeJobs.add(jobId);
    try {
      return await action();
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private loadInputs(jobId: number): { profile: CandidateProfileRecord; job: JobRecord } {
    const job = this.dependencies.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    const profile = this.dependencies.profiles.getCurrent();
    if (!profile) throw new Error("Candidate profile is required before running agents");
    return { profile, job };
  }

  private resultRepository(kind: AgentKind) {
    const { fitResults, resumeResults, applicationDrafts } = this.dependencies;
    switch (kind) {
      case "fit": return fitResults;
      case "resume": return resumeResults;
      case "application": return applicationDrafts;
    }
  }

  private async execute(
    jobId: number,
    profile: CandidateProfileRecord,
    job: JobRecord,
    startIndex: number,
  ): Promise<WorkflowResult> {
    const steps: WorkflowStep[] = sequence.map((kind, index) => ({
      kind,
      status: index < startIndex ? "complete" : "pending",
      error: null,
    }));

    for (let index = startIndex; index < sequence.length; index++) {
      const kind = sequence[index];
      const step = await this.executeStep(jobId, kind, profile, job);
      steps[index] = step;
      if (step.status === "failed") break;
    }
    return { jobId, steps };
  }

  private async executeStep(
    jobId: number,
    kind: AgentKind,
    profile: CandidateProfileRecord,
    job: JobRecord,
  ): Promise<WorkflowStep> {
    const { provider, runs, fitResults } = this.dependencies;
    const run = runs.start(jobId, kind, provider.kind, provider.model, profile.version);
    try {
      let result: AgentResult;
      switch (kind) {
        case "fit": {
          const response = await runFitAgent(provider, profile, job);
          result = { kind, payload: FitAnalysisSchema.parse(response.data) };
          break;
        }
        case "resume": {
          const fit = fitResults.get(jobId);
          if (!fit) throw new Error("Fit result is missing");
          const response = await runResumeAgent(provider, profile, job, fit);
          result = { kind, payload: ResumeSuggestionsSchema.parse(response.data) };
          break;
        }
        case "application": {
          const fit = fitResults.get(jobId);
          if (!fit) throw new Error("Fit result is missing");
          const response = await runApplicationAgent(provider, profile, job, fit);
          result = { kind, payload: ApplicationDraftSchema.parse(response.data) };
          break;
        }
      }
      runs.completeWithResult(run.id, result);
      return { kind, status: "complete", error: null };
    } catch (error) {
      const summary = safeError(error);
      runs.fail(run.id, summary);
      return { kind, status: "failed", error: summary };
    }
  }
}
