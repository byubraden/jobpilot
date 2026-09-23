"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "../app/actions";
import type { CreateJobResult } from "../lib/services/job-service";
import type { ProviderSelectionKind } from "../lib/services/container";
import { ProviderPicker } from "./provider-picker";

type Props = { onCreate: (form: FormData) => Promise<ActionResult<CreateJobResult>> };

export function JobForm({ onCreate }: Props) {
  const [provider, setProvider] = useState<ProviderSelectionKind>("mock");
  const [result, setResult] = useState<ActionResult<CreateJobResult> | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("providerKind", provider);
    startTransition(async () => setResult(await onCreate(form)));
  }

  if (result?.ok) return (
    <div className="card success-panel" role="status">
      <p className="eyebrow">Saved</p><h2>Job saved</h2>
      {result.data.workflowStartFailure ? <p className="notice">{result.data.workflowStartFailure.message}</p> : <p>Your job and available analysis are ready for review.</p>}
      <div className="button-row"><Link className="button button-primary" href={`/jobs/${result.data.job.id}`}>Open saved job</Link><Link className="button button-secondary" href="/profile">Complete profile</Link></div>
    </div>
  );

  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="field"><label htmlFor="description">Job description</label><p className="field-help">Paste the complete posting (at least 200 characters) so the agents have enough context.</p><textarea id="description" name="description" minLength={200} rows={14} required aria-describedby={result && !result.ok && result.fieldErrors?.description ? "description-error" : undefined} />{result && !result.ok && result.fieldErrors?.description && <p className="field-error" id="description-error">{result.fieldErrors.description.join(" ")}</p>}</div>
      <div className="field"><label htmlFor="sourceUrl">Source URL <span className="optional">optional</span></label><input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://company.example/jobs/role" />{result && !result.ok && result.fieldErrors?.sourceUrl && <p className="field-error">{result.fieldErrors.sourceUrl.join(" ")}</p>}</div>
      <ProviderPicker value={provider} onChange={setProvider} />
      {result && !result.ok && result.formError && <p className="field-error" role="alert">{result.formError}</p>}
      <div className="form-actions"><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save job & analyze"}</button><Link href="/" className="text-link">Cancel</Link></div>
    </form>
  );
}
