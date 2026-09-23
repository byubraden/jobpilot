# JobPilot MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first web application that turns a pasted job description and saved candidate profile into a validated fit analysis, résumé suggestions, application drafts, and a tracked application record.

**Architecture:** A Next.js application owns a deterministic coordinator that invokes three bounded AI agents through a provider-neutral interface. SQLite persists profiles, jobs, run state, and validated outputs; Ollama/Qwen3 8B is the default provider, Claude is opt-in, and tests use a deterministic mock.

**Tech Stack:** Next.js App Router, TypeScript, React, SQLite via `better-sqlite3`, Zod, Ollama HTTP API, Anthropic TypeScript SDK, Vitest, Testing Library, Playwright, ESLint

**Spec:** `docs/PROJECT_PLAN.md`

## Global Constraints

- Run locally on the target Apple M1 computer with 16 GB memory.
- Use Ollama with `qwen3:8b` by default and support `qwen3:4b` through configuration.
- Never send candidate or job data to Claude unless the user explicitly selects Claude for that run.
- Never submit applications, automate logins, solve CAPTCHAs, or scrape restricted job boards.
- Never invent candidate skills, employment, education, projects, or accomplishments.
- Save a job before starting AI work and preserve successful steps after later failures.
- Validate every model result before persistence.
- Automated tests must use the mock provider and make no external AI calls.
- Keep API keys in ignored local environment files; never persist or log secrets.
- Work from this plan one task at a time. The coordinator reviews each task before dispatching the next dependent task.

## Coordinator Protocol

For every task, the coordinator will:

1. Record the task start and assigned subagent in `docs/EXPERIMENT_LOG.md`.
2. Give the implementation subagent only the approved spec, this task, relevant existing files, and exact acceptance commands.
3. Require test-first work and a focused commit.
4. Dispatch a fresh specification reviewer to compare the diff with the task requirements.
5. Return gaps to the implementer until the specification reviewer approves.
6. Dispatch a fresh code-quality reviewer.
7. Return quality issues to the implementer until the quality reviewer approves.
8. Run the task's verification commands independently.
9. Record results and observations in the experiment log.

Subagents share one working directory. Only one implementation subagent may edit files at a time. Review agents are read-only. This avoids overlapping writes while still demonstrating coordinator-led delegation.

## Planned File Structure

```text
.
├── .env.example                         # Safe provider configuration template
├── .gitignore                           # Secrets, local database, build artifacts
├── eslint.config.mjs                    # Next.js ESLint rules
├── next-env.d.ts                        # Next.js TypeScript declarations
├── next.config.ts                       # Next.js configuration
├── package.json                         # Pinned scripts and dependencies
├── README.md                            # Local setup and usage
├── tsconfig.json                        # Strict TypeScript configuration
├── docs/
│   ├── PROJECT_PLAN.md                  # Approved product specification
│   ├── IMPLEMENTATION_PLAN.md           # This execution plan
│   ├── EXPERIMENT_LOG.md                # Timestamped process evidence
│   └── FINAL_REPORT_DRAFT.md             # Evidence-based assignment report draft
├── e2e/
│   └── job-workflow.spec.ts             # Browser-level happy path
├── src/
│   ├── app/
│   │   ├── actions.ts                   # Thin server-action adapters
│   │   ├── globals.css                  # Application design system
│   │   ├── layout.tsx                   # Shared shell and navigation
│   │   ├── page.tsx                     # Dashboard
│   │   ├── jobs/
│   │   │   ├── new/page.tsx             # Job intake
│   │   │   └── [id]/page.tsx            # Job analysis and status detail
│   │   └── profile/page.tsx              # Candidate profile editor
│   ├── components/
│   │   ├── application-draft.tsx        # Cover letter and answers
│   │   ├── fit-analysis.tsx              # Fit result presentation
│   │   ├── job-card.tsx                  # Dashboard job summary
│   │   ├── job-form.tsx                  # Job intake client form
│   │   ├── profile-form.tsx              # Profile editor client form
│   │   ├── provider-picker.tsx           # Local/cloud disclosure control
│   │   ├── resume-suggestions.tsx        # Résumé recommendations
│   │   └── workflow-progress.tsx         # Step status and retry controls
│   └── lib/
│       ├── agents/
│       │   ├── application-agent.ts      # Application prompt and validation
│       │   ├── fit-agent.ts              # Extraction and fit prompt
│       │   ├── prompts.test.ts            # Truthfulness policy tests
│       │   └── resume-agent.ts            # Résumé prompt and validation
│       ├── ai/
│       │   ├── anthropic-provider.ts     # Explicit Claude integration
│       │   ├── mock-provider.ts          # Deterministic test implementation
│       │   ├── ollama-provider.ts        # Local structured generation
│       │   ├── provider.test.ts          # Provider behavior tests
│       │   └── provider.ts               # Provider interface and errors
│       ├── db/
│       │   ├── connection.ts             # SQLite creation and migrations
│       │   ├── repositories.test.ts      # In-memory persistence tests
│       │   ├── repositories.ts           # Typed persistence operations
│       │   └── schema.sql                # Idempotent schema
│       ├── domain/
│       │   ├── schemas.test.ts            # Domain validation tests
│       │   └── schemas.ts                 # Zod schemas and inferred types
│       ├── services/
│       │   ├── container.ts               # Server dependency composition
│       │   ├── job-service.test.ts        # Job use-case tests
│       │   ├── job-service.ts             # Job application use cases
│       │   ├── profile-service.test.ts    # Profile use-case tests
│       │   └── profile-service.ts         # Candidate profile use cases
│       └── workflow/
│           ├── coordinator.test.ts       # Orchestration and failure tests
│           └── coordinator.ts            # Deterministic agent sequencing
├── test/
│   └── setup.ts                          # DOM test setup
├── playwright.config.ts                  # Browser test configuration
└── vitest.config.ts                      # Unit/integration test configuration
```

---

### Task 1: Application Skeleton and Domain Contracts

**Owner:** Foundation subagent

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `.env.example`
- Modify: `.gitignore`
- Create: `vitest.config.ts`
- Create: `test/setup.ts`
- Create: `src/lib/domain/schemas.ts`
- Create: `src/lib/domain/schemas.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: approved fields and statuses from `docs/PROJECT_PLAN.md`
- Produces: `ApplicationStatus`, `AgentKind`, `RunStatus`, `ProviderKind`, `CandidateProfileInput`, `JobInput`, `FitAnalysis`, `ResumeSuggestions`, and `ApplicationDraft` Zod schemas and inferred TypeScript types

- [ ] **Step 1: Initialize the root package and install test/runtime dependencies**

Run:

```bash
npm init -y
npm pkg set name=jobpilot private=true
npm install next@latest react@latest react-dom@latest zod better-sqlite3 @anthropic-ai/sdk
npm install --save-dev typescript @types/node @types/react @types/react-dom eslint eslint-config-next vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @types/better-sqlite3 playwright @playwright/test
```

Create strict `tsconfig.json`, the standard `next-env.d.ts`, `next.config.ts`, flat ESLint configuration using `eslint-config-next`, and a minimal App Router layout/page/styles under `src/app`. Expected: `npm run dev` can start Next.js from `src/app`, dependencies are recorded, and no source file contains an API key.

- [ ] **Step 2: Configure Vitest and safe environment defaults**

Create `vitest.config.ts` with jsdom, the `@/` alias, and `test/setup.ts`. Add these exact keys to `.env.example` without values:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
DATABASE_PATH=./data/jobpilot.sqlite
```

Add `.env.local`, `data/*.sqlite*`, and `test-results/` to `.gitignore`. Add scripts `test`, `test:watch`, `typecheck`, and `test:e2e` to `package.json`.

- [ ] **Step 3: Write failing domain-schema tests**

Test these exact behaviors in `schemas.test.ts`:

```ts
expect(ApplicationStatusSchema.options).toEqual([
  "found", "reviewing", "ready", "applied", "interviewing", "rejected", "offer",
]);
expect(() => FitAnalysisSchema.parse({ score: 101 })).toThrow();
expect(CandidateProfileInputSchema.safeParse({ education: [], internships: [], projects: [], skills: [] }).success).toBe(false);
expect(JobInputSchema.parse({ description: "x".repeat(200) }).status).toBe("found");
```

- [ ] **Step 4: Run the schema tests and verify failure**

Run: `npm test -- src/lib/domain/schemas.test.ts`

Expected: FAIL because the schemas do not exist.

- [ ] **Step 5: Implement the domain schemas**

Define strict Zod objects. Require a candidate headline, at least one education/internship/project fact, at least one skill, and résumé text. Require job descriptions to contain at least 200 characters. Constrain fit scores to integer values from 0 through 100. Model agent outputs with these fields:

```ts
type FitAnalysis = {
  job: { title: string; company: string; location: string; compensation?: string; requiredSkills: string[] };
  score: number;
  recommendation: "strong" | "possible" | "skip";
  strengths: Array<{ claim: string; evidence: string }>;
  gaps: string[];
  concerns: string[];
};

type ResumeSuggestions = {
  summary: string;
  skillsToEmphasize: string[];
  bulletSuggestions: Array<{ originalFact: string; suggestedBullet: string; rationale: string }>;
};

type ApplicationDraft = {
  coverLetter: string;
  answers: Array<{ question: string; answer: string }>;
  needsUserInput: string[];
};
```

- [ ] **Step 6: Verify the foundation**

Run:

```bash
npm test -- src/lib/domain/schemas.test.ts
npm run typecheck
npm run lint
```

Expected: all commands exit successfully.

- [ ] **Step 7: Commit the foundation**

```bash
git add .
git commit -m "chore: scaffold JobPilot and define domain contracts"
```

---

### Task 2: SQLite Persistence and Profile Versioning

**Owner:** Data subagent

**Files:**
- Create: `src/lib/db/schema.sql`
- Create: `src/lib/db/connection.ts`
- Create: `src/lib/db/repositories.ts`
- Create: `src/lib/db/repositories.test.ts`

**Interfaces:**
- Consumes: domain input/output types from `src/lib/domain/schemas.ts`
- Produces: `createDatabase(path)`, `ProfileRepository`, `JobRepository`, `AgentRunRepository`, and result repositories used by the coordinator and server actions

- [ ] **Step 1: Write failing in-memory repository tests**

Cover these behaviors using `createDatabase(":memory:")`:

```ts
const savedProfile = profiles.save(validProfile);
expect(savedProfile.version).toBe(1);
expect(profiles.save({ ...validProfile, headline: "Updated" }).version).toBe(2);

const job = jobs.create(validJob);
expect(job.status).toBe("found");
expect(jobs.updateStatus(job.id, "applied").status).toBe("applied");

const run = runs.start(job.id, "fit", "mock", "mock-v1", savedProfile.version);
expect(runs.complete(run.id).status).toBe("complete");
```

Also test result replacement by job ID and agent kind, rejection of invalid status transitions, and preservation of a completed fit result when a later run fails.

- [ ] **Step 2: Run repository tests and verify failure**

Run: `npm test -- src/lib/db/repositories.test.ts`

Expected: FAIL because persistence modules do not exist.

- [ ] **Step 3: Create the idempotent SQLite schema**

Create tables for `candidate_profiles`, `jobs`, `agent_runs`, `fit_analyses`, `resume_suggestions`, and `application_drafts`. Store structured arrays/objects as JSON text, enable foreign keys, and add indexes on `jobs.status`, `jobs.created_at`, and `agent_runs.job_id`.

Use integer profile versions and store the profile version on every `agent_runs` row. Restrict status and kind values with SQL `CHECK` clauses that match the Zod enums.

- [ ] **Step 4: Implement typed repositories**

Use prepared statements and parse JSON through the matching Zod schema on read. Expose these signatures:

```ts
function createDatabase(path: string): Database.Database;

class ProfileRepository {
  constructor(db: Database.Database);
  getCurrent(): CandidateProfileRecord | null;
  save(input: CandidateProfileInput): CandidateProfileRecord;
}

class JobRepository {
  constructor(db: Database.Database);
  create(input: JobInput): JobRecord;
  get(id: number): JobRecord | null;
  list(): JobRecord[];
  updateStatus(id: number, status: ApplicationStatus): JobRecord;
}
```

Provide equivalent focused methods for starting/completing/failing `AgentRun` rows and upserting/reading each validated result type. Do not expose arbitrary SQL to callers.

- [ ] **Step 5: Verify persistence**

Run:

```bash
npm test -- src/lib/db/repositories.test.ts
npm run typecheck
```

Expected: repository tests pass entirely in memory.

- [ ] **Step 6: Commit persistence**

```bash
git add src/lib/db
git commit -m "feat: add versioned SQLite persistence"
```

---

### Task 3: AI Provider Contract, Mock, and Agent Policies

**Owner:** AI contracts subagent

**Files:**
- Create: `src/lib/ai/provider.ts`
- Create: `src/lib/ai/mock-provider.ts`
- Create: `src/lib/ai/provider.test.ts`
- Create: `src/lib/agents/fit-agent.ts`
- Create: `src/lib/agents/resume-agent.ts`
- Create: `src/lib/agents/application-agent.ts`
- Create: `src/lib/agents/prompts.test.ts`

**Interfaces:**
- Consumes: Zod schemas and domain types
- Produces: `AIProvider.generate`, `MockProvider`, `runFitAgent`, `runResumeAgent`, and `runApplicationAgent`

- [ ] **Step 1: Write failing provider and prompt-policy tests**

Test the provider contract:

```ts
const response = await mock.generate({
  task: "fit",
  system: "policy",
  prompt: "job and profile",
  schema: FitAnalysisSchema,
});
expect(FitAnalysisSchema.parse(response.data).score).toBe(82);
expect(response.metadata.provider).toBe("mock");
```

Test that every exported agent system prompt includes the phrases `Do not invent`, `candidate profile`, and `missing information`. Test that invalid mock fixtures raise `AIValidationError` rather than returning unvalidated data.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/lib/ai/provider.test.ts src/lib/agents/prompts.test.ts`

Expected: FAIL because provider and agent modules do not exist.

- [ ] **Step 3: Implement the provider contract and errors**

```ts
export type AIRequest<T> = {
  task: AgentKind;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
};

export type AIResponse<T> = {
  data: T;
  metadata: { provider: ProviderKind; model: string; inputTokens?: number; outputTokens?: number };
};

export interface AIProvider {
  readonly kind: ProviderKind;
  readonly model: string;
  generate<T>(request: AIRequest<T>): Promise<AIResponse<T>>;
}
```

Add distinct `AIUnavailableError` and `AIValidationError` classes with safe messages that cannot include API keys.

- [ ] **Step 4: Implement deterministic mock responses**

Return schema-valid fixed results for `fit`, `resume`, and `application`. Permit tests to inject an invalid fixture or a task-specific error. Always validate fixtures through the requested schema.

- [ ] **Step 5: Implement bounded agents**

Each agent accepts an `AIProvider` plus only the inputs it needs. Build prompts from serialized, labeled profile/job facts. Require JSON-only output and explicitly forbid unsupported claims. Export:

```ts
runFitAgent(provider, profile, job): Promise<AIResponse<FitAnalysis>>;
runResumeAgent(provider, profile, job, fit): Promise<AIResponse<ResumeSuggestions>>;
runApplicationAgent(provider, profile, job, fit): Promise<AIResponse<ApplicationDraft>>;
```

- [ ] **Step 6: Verify AI contracts and policies**

Run:

```bash
npm test -- src/lib/ai/provider.test.ts src/lib/agents/prompts.test.ts
npm run typecheck
```

Expected: tests pass without network access.

- [ ] **Step 7: Commit AI contracts**

```bash
git add src/lib/ai src/lib/agents
git commit -m "feat: define validated AI agents and mock provider"
```

---

### Task 4: Deterministic Coordinator and Partial-Failure Recovery

**Owner:** Workflow subagent

**Files:**
- Create: `src/lib/workflow/coordinator.ts`
- Create: `src/lib/workflow/coordinator.test.ts`

**Interfaces:**
- Consumes: repositories, `AIProvider`, and the three agent functions
- Produces: `JobWorkflowCoordinator.run(jobId)` and `JobWorkflowCoordinator.retry(jobId, agentKind)`

- [ ] **Step 1: Write failing happy-path coordinator test**

Arrange an in-memory database with a profile and job, then execute:

```ts
const result = await coordinator.run(job.id);
expect(result.steps.map((step) => step.status)).toEqual(["complete", "complete", "complete"]);
expect(fitResults.get(job.id)?.score).toBe(82);
expect(resumeResults.get(job.id)).not.toBeNull();
expect(applicationDrafts.get(job.id)).not.toBeNull();
```

- [ ] **Step 2: Write failing partial-failure tests**

Configure the mock to fail on `resume`. Assert that fit remains complete, résumé becomes failed, application remains pending, and `retry(job.id, "resume")` completes résumé and application without rerunning fit.

Also assert that missing profiles and jobs fail before any provider call.

- [ ] **Step 3: Run coordinator tests and verify failure**

Run: `npm test -- src/lib/workflow/coordinator.test.ts`

Expected: FAIL because the coordinator does not exist.

- [ ] **Step 4: Implement coordinator sequencing**

Construct the coordinator with explicit dependencies:

```ts
new JobWorkflowCoordinator({
  provider,
  profiles,
  jobs,
  runs,
  fitResults,
  resumeResults,
  applicationDrafts,
});
```

Start an `AgentRun` before each agent call, validate the result, persist it, then complete the run. On failure, record a safe error summary and stop dependent steps. `retry` begins at the requested failed step and preserves prior successful results.

- [ ] **Step 5: Verify orchestration**

Run:

```bash
npm test -- src/lib/workflow/coordinator.test.ts
npm test
npm run typecheck
```

Expected: all tests pass with no external provider calls.

- [ ] **Step 6: Commit workflow**

```bash
git add src/lib/workflow
git commit -m "feat: orchestrate recoverable application workflows"
```

---

### Task 5: Candidate Profile and Job-Tracking Application Services

**Owner:** Application-services subagent

**Files:**
- Create: `src/lib/services/job-service.ts`
- Create: `src/lib/services/job-service.test.ts`
- Create: `src/lib/services/profile-service.ts`
- Create: `src/lib/services/profile-service.test.ts`
- Create: `src/lib/services/container.ts`
- Create: `src/app/actions.ts`

**Interfaces:**
- Consumes: repositories, coordinator, domain schemas, configured provider factory
- Produces: framework-neutral profile/job services and thin server actions used by pages/forms

- [ ] **Step 1: Write failing service tests**

Test that `saveProfile` validates input and increments its version; `createJob` saves before coordinator invocation; `changeJobStatus` rejects unknown statuses; and `analyzeJob` returns the stored job even when the coordinator reports a failed step.

- [ ] **Step 2: Run service tests and verify failure**

Run: `npm test -- src/lib/services`

Expected: FAIL because the service modules do not exist.

- [ ] **Step 3: Implement services and dependency container**

Keep Next.js imports out of service modules. `container.ts` opens the configured database once per server process and constructs repositories. It must expose a provider factory that requires an explicit `providerKind` argument; it must never turn an Ollama error into a Claude call.

- [ ] **Step 4: Implement thin server actions**

Export `saveProfileAction`, `createJobAction`, `analyzeJobAction`, `retryAgentAction`, and `updateJobStatusAction`. Parse `FormData`, call services, return serializable field/form errors, and use `revalidatePath` after successful mutations.

- [ ] **Step 5: Verify application services**

Run:

```bash
npm test -- src/lib/services
npm run typecheck
npm run lint
```

Expected: services pass with in-memory dependencies and no network access.

- [ ] **Step 6: Commit services**

```bash
git add src/lib/services src/app/actions.ts
git commit -m "feat: add profile and job application services"
```

---

### Task 6: Review-Focused Local Web Interface

**Owner:** UI subagent

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/jobs/new/page.tsx`
- Create: `src/app/jobs/[id]/page.tsx`
- Create: `src/app/profile/page.tsx`
- Create: all files under `src/components/` listed in Planned File Structure
- Create: `src/components/job-form.test.tsx`
- Create: `src/components/provider-picker.test.tsx`
- Create: `src/components/workflow-progress.test.tsx`
- Create: `src/components/job-card.test.tsx`

**Interfaces:**
- Consumes: records from repositories and mutations from `src/app/actions.ts`
- Produces: accessible dashboard, intake, detail, and profile workflows

- [ ] **Step 1: Write failing component tests**

Cover these visible behaviors:

```ts
expect(screen.getByRole("heading", { name: /application pipeline/i })).toBeVisible();
expect(screen.getByLabelText(/job description/i)).toHaveAttribute("minLength", "200");
expect(screen.getByText(/runs locally with ollama/i)).toBeVisible();
expect(screen.getByText(/sending to claude uses api credit/i)).toBeVisible();
expect(screen.getByRole("button", { name: /retry résumé agent/i })).toBeVisible();
```

Also test empty states, score presentation, missing-information warnings, and status controls.

- [ ] **Step 2: Run component tests and verify failure**

Run: `npm test -- src/components`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Build the shared shell and visual system**

Use semantic HTML, visible keyboard focus, sufficient contrast, responsive layout, and system fonts. Define a restrained palette and reusable CSS classes in `globals.css`; do not add a component library.

- [ ] **Step 4: Build the profile and intake flows**

The profile form must expose headline, education, internships, projects, skills, preferences, and résumé text. The job form must expose description, optional URL, and provider choice. Selecting Claude must reveal the exact disclosure `This sends your profile and job description to Claude and uses API credit.`

- [ ] **Step 5: Build dashboard and job detail**

Show counts and filters for all seven statuses. Job detail must show the original description, profile-version freshness, workflow progress, fit evidence, résumé suggestions, cover letter, answers, user questions, retry buttons, and a manual status control.

- [ ] **Step 6: Verify the interface**

Run:

```bash
npm test -- src/components
npm run typecheck
npm run lint
npm run build
```

Expected: all commands succeed and pages render without provider access.

- [ ] **Step 7: Commit the interface**

```bash
git add src/app src/components
git commit -m "feat: add JobPilot review and tracking interface"
```

---

### Task 7: Ollama and Explicit Claude Providers

**Owner:** Provider-integration subagent

**Files:**
- Create: `src/lib/ai/ollama-provider.ts`
- Create: `src/lib/ai/anthropic-provider.ts`
- Modify: `src/lib/ai/provider.test.ts`
- Modify: `src/lib/services/container.ts`

**Interfaces:**
- Consumes: `AIProvider`, Zod schemas, environment configuration
- Produces: validated `OllamaProvider` and `AnthropicProvider` implementations selected only by explicit provider kind

- [ ] **Step 1: Write failing HTTP-mocked provider tests**

Stub `fetch` for Ollama and the Anthropic client transport. Assert valid JSON is parsed through the requested schema; malformed JSON raises `AIValidationError`; connection errors raise `AIUnavailableError`; and error messages contain neither request prompts nor API keys.

Assert that `createProvider("ollama")` never reads `ANTHROPIC_API_KEY`, while `createProvider("anthropic")` fails with a configuration error when the key is absent.

- [ ] **Step 2: Run provider tests and verify failure**

Run: `npm test -- src/lib/ai/provider.test.ts`

Expected: FAIL because live provider implementations do not exist.

- [ ] **Step 3: Implement Ollama structured generation**

POST to `${OLLAMA_BASE_URL}/api/chat` with `stream: false`, the configured model, system/user messages, and a JSON schema format derived from the request schema. Parse `message.content`, validate it, and return provider/model metadata. Apply an abort timeout and map connection, timeout, JSON, and validation failures to the defined errors.

- [ ] **Step 4: Implement explicit Claude generation**

Use the Anthropic Messages API with the configured Haiku model. Request JSON-only output using the same schema description, parse the first text block, validate it, and map usage token counts into metadata. The constructor must require a non-empty key.

- [ ] **Step 5: Wire explicit provider selection**

Implement:

```ts
function createProvider(kind: "ollama" | "anthropic" | "mock"): AIProvider;
```

No catch block may call `createProvider("anthropic")` after an Ollama failure.

- [ ] **Step 6: Verify provider integrations without live charges**

Run:

```bash
npm test -- src/lib/ai/provider.test.ts
npm test
npm run typecheck
npm run lint
```

Expected: all tests pass with HTTP/client mocks and zero live requests.

- [ ] **Step 7: Commit providers**

```bash
git add src/lib/ai src/lib/services/container.ts
git commit -m "feat: integrate local Ollama and opt-in Claude providers"
```

---

### Task 8: End-to-End Workflow, Setup Documentation, and Local Smoke Test

**Owner:** Integration subagent

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/job-workflow.spec.ts`
- Modify: `README.md`
- Modify: `docs/EXPERIMENT_LOG.md`

**Interfaces:**
- Consumes: complete application with mock and Ollama provider paths
- Produces: reproducible local setup, browser-level workflow proof, and runtime observations

- [ ] **Step 1: Write the failing Playwright workflow**

Use `AI_PROVIDER=mock` and a temporary database. The test must edit the profile, add a 200+ character job description, run analysis, observe score `82`, see résumé and application sections, change status to Applied, reload, and confirm persistence.

- [ ] **Step 2: Run the browser test and verify failure**

Run: `npm run test:e2e -- e2e/job-workflow.spec.ts`

Expected: FAIL until configuration or integration gaps are resolved.

- [ ] **Step 3: Fix only integration defects revealed by the test**

Keep fixes within existing boundaries. Do not add deferred features. Re-run the single failing test after each change.

- [ ] **Step 4: Write complete local setup documentation**

README instructions must include Node/npm prerequisites, dependency installation, Ollama installation link, `ollama pull qwen3:8b`, `.env.local` creation, development command, test commands, database location, optional Claude setup, privacy disclosure, and troubleshooting for an unavailable Ollama server or invalid structured output.

- [ ] **Step 5: Run the live Ollama smoke test**

With Ollama running, create one sample profile and job through the UI, run all three agents, confirm persisted validated results, restart the app, and confirm the job remains. Record model, elapsed time, any retries, and observed output quality in `docs/EXPERIMENT_LOG.md`.

- [ ] **Step 6: Run the full local verification suite**

Run:

```bash
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits successfully.

- [ ] **Step 7: Commit the integrated MVP**

```bash
git add README.md playwright.config.ts e2e docs/EXPERIMENT_LOG.md
git commit -m "test: verify complete local JobPilot workflow"
```

---

### Task 9: Adversarial Claude Review and Assignment Report Evidence

**Owner:** Coordinator, with Claude as an external cold reviewer

**Files:**
- Create: `docs/COLD_REVIEW.md`
- Create: `docs/FINAL_REPORT_DRAFT.md`
- Modify: files required by accepted review findings
- Modify: `docs/EXPERIMENT_LOG.md`

**Interfaces:**
- Consumes: committed repository, approved spec, verification results, and experiment log
- Produces: independent review findings, verified fixes, and a concise evidence-based report draft

- [ ] **Step 1: Prepare a reasoning-free cold-review packet**

Send Claude the product spec, repository tree, source/test files, and verification output. Do not send this conversation, the implementation plan's commentary, or explanations of why decisions were made. Ask it to identify correctness, privacy, truthfulness, test, and maintainability failures and to rank them by severity.

- [ ] **Step 2: Save the unedited findings and cost metadata**

Write `docs/COLD_REVIEW.md` with the exact review prompt, model, timestamp, token usage/cost when available, and Claude's response. Never include the API key.

- [ ] **Step 3: Triage every finding with evidence**

For each finding, mark `accepted`, `rejected`, or `deferred`. Cite the relevant file/test evidence and explain the decision in one or two sentences. Implement accepted MVP-scope fixes with a failing regression test first.

- [ ] **Step 4: Re-run full verification after review fixes**

Run:

```bash
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: every command exits successfully.

- [ ] **Step 5: Draft the assignment report from recorded evidence**

Create `docs/FINAL_REPORT_DRAFT.md` with these sections:

```markdown
# JobPilot Process Report Draft

## What I Built
## Techniques I Used
## What Helped
## What Hurt or Slowed Me Down
## Local Ollama vs. Claude Observations
## What I Learned
## What I Would Do Next
```

Use concrete events from `EXPERIMENT_LOG.md`; do not claim that a technique helped or harmed the process without an observed example. Add a note that the student must revise the draft into their own words before submission.

- [ ] **Step 6: Commit review and report artifacts**

```bash
git add docs src e2e
git commit -m "docs: record cold review and project observations"
```

## Final Completion Gate

Before calling the project complete, the coordinator must confirm:

- All twelve acceptance criteria in `docs/PROJECT_PLAN.md` have direct evidence.
- The development session duration recorded in `docs/EXPERIMENT_LOG.md` is at least two hours; elapsed time must not be invented or rounded upward.
- Git contains no `.env.local`, API key, local database, generated build output, or secret-bearing logs.
- The final verification suite was run after the last code change.
- Claude usage stayed within the user-approved credit budget.
- The report accurately distinguishes development subagents from the product's runtime agents.
