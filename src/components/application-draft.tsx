import type { ApplicationDraft } from "../lib/domain/schemas";

export function ApplicationDraftView({ result }: { result: { payload: ApplicationDraft; profileVersion: number | null; isStale: boolean } | null }) {
  if (!result) return <section className="card result-card"><h2>Application draft</h2><p className="muted">No draft yet. Run the application agent to prepare a cover letter and answers.</p></section>;
  const { payload, isStale, profileVersion } = result;
  return <section className={`card result-card ${isStale ? "stale-result" : ""}`} aria-label={isStale ? "Previous application draft" : "Current application draft"}>
    <p className="eyebrow">{isStale ? `Previous profile version ${profileVersion ?? "unknown"}` : `Current profile version ${profileVersion}`}</p><h2>Application draft</h2>
    {isStale && <p className="stale-note">This draft uses a previous profile version. Regenerate analysis before using it.</p>}
    <h3>Cover letter</h3><div className="draft-copy">{payload.coverLetter}</div>
    <h3>Application answers</h3>{payload.answers.length ? <dl className="answer-list">{payload.answers.map(({ question, answer }, index) => <div key={index}><dt>{question}</dt><dd>{answer}</dd></div>)}</dl> : <p className="muted">No answers drafted.</p>}
    {payload.needsUserInput.length > 0 && <div className="needs-input"><h3>Needs your input</h3><p>Confirm these details yourself before sending an application.</p><ul>{payload.needsUserInput.map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}</ul></div>}
  </section>;
}
