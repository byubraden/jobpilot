import Link from "next/link";
import { notFound } from "next/navigation";
import { analyzeJobAction, retryAgentAction, updateJobStatusAction } from "../../actions";
import { ApplicationDraftView } from "../../../components/application-draft";
import { FitAnalysisView } from "../../../components/fit-analysis";
import { ResumeSuggestionsView } from "../../../components/resume-suggestions";
import { JobStatusControl, WorkflowProgress } from "../../../components/workflow-progress";
import { getServices } from "../../../lib/services/container";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) notFound();
  const detail = getServices().jobs.getJobDetail(id);
  if (!detail) notFound();
  const { job, currentProfileVersion, latestAttemptId, runs, fit, resume, application } = detail;
  const hasPreviousProfile = [fit, resume, application].some((result) => result?.isPreviousProfile);
  const hasPreviousAttempt = [fit, resume, application].some((result) => result?.isPreviousAttempt);
  const mockRun = ([
    ["fit", fit], ["resume", resume], ["application", application],
  ] as const).some(([kind, result]) => result && runs.find((run) => run.kind === kind && run.status === "complete" && run.attemptId === result.attemptId)?.provider === "mock");
  return <main className="page-shell detail-page"><nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Pipeline</Link><span aria-hidden="true">/</span><span>Job {job.id}</span></nav>
    <div className="detail-header"><div><p className="eyebrow">Application review</p><h1>Job {job.id}</h1><p>Saved {new Date(job.createdAt).toLocaleDateString()} · Status: <strong>{job.status}</strong></p></div><Link className="button button-secondary" href="/jobs/new">Add another job</Link></div>
    {!currentProfileVersion && <div className="notice"><strong>Profile needed.</strong> <Link href="/profile">Complete your candidate profile</Link> before running agents.</div>}
    {(hasPreviousProfile || hasPreviousAttempt) && <div className="stale-note global-stale" role="note"><strong>{hasPreviousProfile ? "Some results use an older profile version." : "Some results are retained from a previous analysis attempt."}</strong> They are labeled below. Run or regenerate analysis to update them.</div>}
    {mockRun && <div className="notice" role="note"><strong>Mock mode results.</strong> Scores and extracted job facts are deterministic fixtures for demonstration, not an assessment of this role.</div>}
    <div className="detail-layout"><div className="detail-main"><FitAnalysisView result={fit} /><ResumeSuggestionsView result={resume} /><ApplicationDraftView result={application} /><section className="card result-card"><h2>Original job description</h2>{job.sourceUrl && <p><a href={job.sourceUrl} target="_blank" rel="noreferrer">Open source posting <span aria-hidden="true">↗</span></a></p>}<div className="posting-copy">{job.description}</div></section></div><aside className="detail-sidebar"><JobStatusControl jobId={job.id} status={job.status} onUpdate={updateJobStatusAction} /><WorkflowProgress jobId={job.id} runs={runs} latestAttemptId={latestAttemptId} onRetry={retryAgentAction} onAnalyze={analyzeJobAction} /><div className="card profile-version"><p className="eyebrow">Freshness</p><h2>Profile version</h2><p>{currentProfileVersion ? `Current profile: v${currentProfileVersion}` : "No profile saved yet"}</p><p className="muted">Each result shows the profile version that produced it.</p></div></aside></div>
  </main>;
}
