import type { FitAnalysis } from "../lib/domain/schemas";

export function FitAnalysisView({ result }: { result: { payload: FitAnalysis; profileVersion: number | null; isStale: boolean; isPreviousAttempt?: boolean } | null }) {
  if (!result) return <section className="card result-card"><h2>Fit analysis</h2><p className="muted">No fit analysis yet. Run the workflow to see a score with evidence.</p></section>;
  const { payload, isStale, profileVersion, isPreviousAttempt } = result;
  return <section className={`card result-card ${isStale ? "stale-result" : ""}`} aria-label={isStale ? "Previous fit analysis" : "Current fit analysis"}>
    <div className="section-heading compact"><div><p className="eyebrow">{isPreviousAttempt ? `Previous analysis attempt · profile version ${profileVersion ?? "unknown"}` : isStale ? `Previous profile version ${profileVersion ?? "unknown"}` : `Current profile version ${profileVersion}`}</p><h2>Fit analysis</h2></div><div className="score" aria-label={`Fit score ${payload.score} out of 100`}>{payload.score}<span>/100</span></div></div>
    {isStale && <p className="stale-note">{isPreviousAttempt ? "This result is retained from a previous analysis attempt. Regenerate analysis to replace it." : "This result is from a previous profile version. Regenerate analysis to see a current assessment."}</p>}
    <p className="recommendation">Recommendation: <strong>{payload.recommendation}</strong></p>
    <dl className="facts"><div><dt>Role</dt><dd>{payload.job.title}</dd></div><div><dt>Company</dt><dd>{payload.job.company}</dd></div><div><dt>Location</dt><dd>{payload.job.location}</dd></div>{payload.job.compensation && <div><dt>Compensation</dt><dd>{payload.job.compensation}</dd></div>}</dl>
    {payload.job.requiredSkills.length > 0 && <div><h3>Required skills</h3><div className="tags">{payload.job.requiredSkills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></div>}
    <div className="result-columns"><div><h3>Evidence of fit</h3>{payload.strengths.length ? <ul>{payload.strengths.map(({ claim, evidence }, index) => <li key={`${claim}-${index}`}><strong>{claim}</strong><p>{evidence}</p></li>)}</ul> : <p className="muted">No strengths identified.</p>}</div><div><h3>Gaps & concerns</h3>{payload.gaps.length || payload.concerns.length ? <ul>{[...payload.gaps, ...payload.concerns].map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="muted">No gaps or concerns recorded.</p>}</div></div>
  </section>;
}
