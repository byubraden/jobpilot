"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "../app/actions";
import type { AgentRunRecord } from "../lib/db/repositories";
import { ApplicationStatusSchema, type ApplicationStatus, type AgentKind } from "../lib/domain/schemas";
import type { ProviderSelectionKind } from "../lib/services/container";
import { ProviderPicker } from "./provider-picker";

const steps: { kind: AgentKind; label: string }[] = [
  { kind: "fit", label: "Fit analysis" },
  { kind: "resume", label: "Résumé agent" },
  { kind: "application", label: "Application draft" },
];

type Mutation = (form: FormData) => Promise<ActionResult<unknown>>;

export function WorkflowProgress({ jobId, runs, onRetry, onAnalyze }: { jobId: number; runs: AgentRunRecord[]; onRetry?: Mutation; onAnalyze?: Mutation }) {
  const [provider, setProvider] = useState<ProviderSelectionKind>("mock");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: Mutation | undefined, kind?: AgentKind) {
    if (!action) return;
    const form = new FormData();
    form.set("jobId", String(jobId));
    form.set("providerKind", provider);
    if (kind) form.set("kind", kind);
    setError(null);
    startTransition(async () => {
      const result = await action(form);
      if (!result.ok) setError(result.formError || Object.values(result.fieldErrors ?? {}).flat().join(" ") || "Unable to run analysis.");
    });
  }

  return (
    <section className="card workflow" aria-labelledby="workflow-heading">
      <div className="section-heading compact"><div><p className="eyebrow">AI assistance</p><h2 id="workflow-heading">Workflow progress</h2></div></div>
      <ol className="step-list">
        {steps.map(({ kind, label }) => {
          const latest = runs.find((run) => run.kind === kind);
          return <li key={kind} className="step"><div className="step-info"><strong>{label}</strong><span className={`status status-${latest?.status ?? "pending"}`}>{latest?.status ?? "not started"}</span>{latest?.provider === "mock" && <small className="fixture-note">Mock fixture result</small>}{latest?.status === "failed" && latest.error && <p className="field-error">{latest.error}</p>}</div>{latest?.status === "failed" && <button type="button" className="button button-secondary" disabled={pending} onClick={() => run(onRetry, kind)}>Retry {label}</button>}</li>;
        })}
      </ol>
      <div className="workflow-actions"><ProviderPicker value={provider} onChange={setProvider} name="workflowProviderKind" /><button type="button" className="button button-primary" disabled={pending} onClick={() => run(onAnalyze)}>{pending ? "Working…" : "Run or regenerate analysis"}</button>{error && <p className="field-error" role="alert">{error}</p>}</div>
    </section>
  );
}

export function JobStatusControl({ jobId, status, onUpdate }: { jobId: number; status: ApplicationStatus; onUpdate: Mutation }) {
  const [selected, setSelected] = useState<ApplicationStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function save() {
    const form = new FormData();
    form.set("jobId", String(jobId));
    form.set("status", selected);
    setError(null);
    startTransition(async () => {
      const result = await onUpdate(form);
      if (!result.ok) setError(result.formError ?? "Unable to update status.");
    });
  }
  return <div className="card status-control"><h2>Application status</h2><p className="field-help">Change this when you take the next step. Status transitions are checked on save.</p><div className="inline-form"><label htmlFor="job-status">Current status</label><select id="job-status" value={selected} onChange={(event) => setSelected(event.target.value as ApplicationStatus)}>{ApplicationStatusSchema.options.map((option) => <option key={option} value={option}>{option}</option>)}</select><button type="button" className="button button-secondary" disabled={pending || selected === status} onClick={save}>{pending ? "Saving…" : "Save status"}</button></div>{error && <p className="field-error" role="alert">{error}</p>}</div>;
}
