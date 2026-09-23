"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "../app/actions";
import type { CandidateProfileRecord } from "../lib/db/repositories";

type Props = { profile: CandidateProfileRecord | null; onSave: (form: FormData) => Promise<ActionResult<CandidateProfileRecord>> };

export function ProfileForm({ profile, onSave }: Props) {
  const [result, setResult] = useState<ActionResult<CandidateProfileRecord> | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => setResult(await onSave(form)));
  }
  return <form className="form-stack" onSubmit={submit}>
    <div className="field"><label htmlFor="headline">Headline</label><input id="headline" name="headline" defaultValue={profile?.headline ?? ""} required placeholder="Frontend engineer focused on accessible products" /></div>
    <div className="field"><label htmlFor="education">Education</label><p className="field-help">One fact per line.</p><textarea id="education" name="education" rows={4} defaultValue={profile?.education.join("\n") ?? ""} /></div>
    <div className="field"><label htmlFor="internships">Internships</label><p className="field-help">One fact per line.</p><textarea id="internships" name="internships" rows={4} defaultValue={profile?.internships.join("\n") ?? ""} /></div>
    <div className="field"><label htmlFor="projects">Projects</label><p className="field-help">One fact per line.</p><textarea id="projects" name="projects" rows={4} defaultValue={profile?.projects.join("\n") ?? ""} /></div>
    <div className="field"><label htmlFor="skills">Skills</label><p className="field-help">One skill per line.</p><textarea id="skills" name="skills" rows={4} defaultValue={profile?.skills.join("\n") ?? ""} required /></div>
    <div className="field"><label htmlFor="preferences">Preferences <span className="optional">optional</span></label><textarea id="preferences" name="preferences" rows={3} defaultValue={profile?.preferences ?? ""} /></div>
    <div className="field"><label htmlFor="resumeText">Résumé text</label><p className="field-help">Paste your current résumé. Drafts use these facts as their source.</p><textarea id="resumeText" name="resumeText" rows={12} defaultValue={profile?.resumeText ?? ""} required /></div>
    {result && !result.ok && <div className="field-error" role="alert">{result.formError && <p>{result.formError}</p>}{Object.entries(result.fieldErrors ?? {}).map(([field, messages]) => <p key={field}>{field}: {messages.join(" ")}</p>)}</div>}
    {result?.ok && <p className="notice success" role="status">Profile version {result.data.version} saved. Re-run analysis on saved jobs to refresh their results.</p>}
    <div className="form-actions"><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button></div>
  </form>;
}
