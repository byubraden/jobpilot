"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { AgentKindSchema, ApplicationStatusSchema, CandidateProfileInputSchema, JobInputSchema } from "../lib/domain/schemas";
import { getServices, parseProviderSelection } from "../lib/services/container";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };

function listField(form: FormData, key: string) {
  const values: unknown[] = [];
  for (const value of form.getAll(key)) {
    if (typeof value === "string") values.push(...value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    else values.push(value);
  }
  return values;
}

function optionalText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" && value.trim() === "" ? undefined : value ?? undefined;
}

const jobIdSchema = z.coerce.number().int().positive();

function fieldError(error: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string") (fieldErrors[field] ??= []).push(issue.message);
    else formErrors.push(issue.message);
  }
  return {
    ok: false,
    ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
    ...(formErrors.length ? { formError: formErrors.join(" ") } : {}),
  };
}

function safeFormError(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) return fieldError(error);
  if (error instanceof Error && /^(?:Select an AI provider|Unknown AI provider selection|(?:ollama|anthropic) provider is not yet configured|Candidate profile is required|Job \d+ not found|Invalid job status transition|No failed|Cannot retry|Workflow already running|AI provider is unavailable|AI response did not match)/.test(error.message)) {
    return { ok: false, formError: error.message };
  }
  return { ok: false, formError: "Unable to complete the request. Try again." };
}

async function perform<T>(action: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    return safeFormError(error);
  }
}

export async function saveProfileAction(form: FormData) {
  return perform(() => {
    const input = CandidateProfileInputSchema.parse({
      headline: form.get("headline"),
      education: listField(form, "education"),
      internships: listField(form, "internships"),
      projects: listField(form, "projects"),
      skills: listField(form, "skills"),
      preferences: optionalText(form, "preferences"),
      resumeText: form.get("resumeText"),
    });
    const profile = getServices().profiles.saveProfile(input);
    revalidatePath("/");
    revalidatePath("/profile");
    return profile;
  });
}

export async function createJobAction(form: FormData) {
  return perform(async () => {
    const providerKind = parseProviderSelection(form.get("providerKind"));
    const input = JobInputSchema.parse({
      description: form.get("description"),
      sourceUrl: optionalText(form, "sourceUrl"),
    });
    const result = await getServices().jobs.createJob(input, providerKind);
    revalidatePath("/");
    revalidatePath(`/jobs/${result.job.id}`);
    return result;
  });
}

export async function analyzeJobAction(form: FormData) {
  return perform(async () => {
    const id = jobIdSchema.parse(form.get("jobId"));
    const providerKind = parseProviderSelection(form.get("providerKind"));
    const result = await getServices().jobs.analyzeJob(id, providerKind);
    revalidatePath("/");
    revalidatePath(`/jobs/${id}`);
    return result;
  });
}

export async function retryAgentAction(form: FormData) {
  return perform(async () => {
    const id = jobIdSchema.parse(form.get("jobId"));
    const kind = AgentKindSchema.parse(form.get("kind"));
    const providerKind = parseProviderSelection(form.get("providerKind"));
    const result = await getServices().jobs.retryAgent(id, kind, providerKind);
    revalidatePath("/");
    revalidatePath(`/jobs/${id}`);
    return result;
  });
}

export async function updateJobStatusAction(form: FormData) {
  return perform(() => {
    const id = jobIdSchema.parse(form.get("jobId"));
    const status = ApplicationStatusSchema.parse(form.get("status"));
    const job = getServices().jobs.changeJobStatus(id, status);
    revalidatePath("/");
    revalidatePath(`/jobs/${id}`);
    return job;
  });
}
