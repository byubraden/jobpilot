import type { ResumeSuggestions } from "../lib/domain/schemas";

export function ResumeSuggestionsView({ result }: { result: { payload: ResumeSuggestions; profileVersion: number | null; isStale: boolean } | null }) {
  if (!result) return <section className="card result-card"><h2>Résumé suggestions</h2><p className="muted">No suggestions yet. Run the résumé agent to see grounded edits.</p></section>;
  const { payload, isStale, profileVersion } = result;
  return <section className={`card result-card ${isStale ? "stale-result" : ""}`} aria-label={isStale ? "Previous résumé suggestions" : "Current résumé suggestions"}>
    <p className="eyebrow">{isStale ? `Previous profile version ${profileVersion ?? "unknown"}` : `Current profile version ${profileVersion}`}</p><h2>Résumé suggestions</h2>
    {isStale && <p className="stale-note">These suggestions use a previous profile version. Regenerate analysis for current suggestions.</p>}
    <p>{payload.summary}</p>
    {payload.skillsToEmphasize.length > 0 && <><h3>Skills to emphasize</h3><div className="tags">{payload.skillsToEmphasize.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></>}
    <h3>Suggested bullets</h3>{payload.bulletSuggestions.length ? <div className="suggestion-list">{payload.bulletSuggestions.map((bullet, index) => <div key={index} className="suggestion"><p className="eyebrow">From your profile</p><p>{bullet.originalFact}</p><p className="eyebrow">Suggested wording</p><p><strong>{bullet.suggestedBullet}</strong></p><p className="muted">{bullet.rationale}</p></div>)}</div> : <p className="muted">No bullet suggestions recorded.</p>}
  </section>;
}
