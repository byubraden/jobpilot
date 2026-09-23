# JobPilot Product Plan

Date: 2026-09-23
Status: Approved design

## Purpose

JobPilot is a local-first assistant for preparing and tracking applications for entry-level and junior full-stack roles that involve AI integrations, APIs, LLMs, or automation. It reduces repetitive application work while keeping the applicant responsible for reviewing materials and submitting every application.

The initial audience is one graduating master's student with internship experience. The search preference is hybrid work in Oregon, Colorado, Washington, Idaho, Arizona, or Utah, with remote work as a secondary option.

## Assignment Goals

The project is a greenfield application built during an AI-assisted development session of at least two hours. The build will deliberately exercise and document these techniques:

1. **Subagents and a Coordinator Agent:** a coordinator divides implementation into bounded tasks, delegates those tasks, integrates their results, and owns final verification. The product also demonstrates a coordinator orchestrating specialized job-analysis agents.
2. **Spec-Driven Development:** this document and the subsequent implementation plan define scope, interfaces, safety rules, and acceptance criteria before implementation.
3. **Vibe Coding:** the user guides product priorities and reacts to working increments while AI agents accelerate implementation.
4. **Adversarial Cold Review:** Claude will review the integrated application without receiving the development conversation or prior reasoning.

An experiment log will record timestamps, decisions, failures, corrections, and observations. The final assignment report will be based on that evidence and then revised by the student into their own voice.

## MVP User Workflow

1. The user creates or edits a candidate profile containing education, internships, projects, skills, preferences, and résumé text.
2. The user pastes a job description and optionally records its source URL.
3. JobPilot saves the original input before starting AI work.
4. The coordinator runs the Fit Agent, Résumé Agent, and Application Agent sequentially.
5. Each result is validated and saved independently.
6. The user reviews the fit analysis and generated application package.
7. The user applies outside JobPilot and intentionally updates the tracked status.

## Scope

### Included

- A local web dashboard with application counts and jobs organized by status
- Candidate-profile editing with placeholder data until the final résumé is available
- Manual job-description entry with an optional source URL
- Extraction of title, company, location, compensation when present, skills, and requirements
- Fit score with evidence, strengths, gaps, and concerns
- Truthful résumé-tailoring suggestions
- A tailored cover-letter draft
- Suggested answers for common application questions
- Explicit questions when candidate information is missing
- Statuses: Found, Reviewing, Ready to Apply, Applied, Interviewing, Rejected, and Offer
- Independent retry for failed AI steps
- Local persistence in SQLite
- Ollama as the default provider and Claude as a user-selected comparison provider
- Mock AI responses for automated tests
- Basic per-run provider and usage metadata

### Excluded

- Automatic application submission
- Login automation, CAPTCHA handling, or browser impersonation
- Scraping restricted job boards
- Automatic discovery across the public web
- Fabricating or embellishing candidate experience
- Cloud hosting, accounts, team collaboration, notifications, and mobile applications
- Document-format rewriting of an uploaded résumé in the MVP

## Architecture

The application uses Next.js with TypeScript for its browser interface and server-side operations. SQLite stores profile, job, workflow, and generated-material data. AI providers sit behind one application-owned interface so Ollama, Claude, and deterministic test doubles share the same contracts.

The application coordinator is deterministic code rather than an unrestricted autonomous agent. It decides the order of operations, validates outputs, records state, and exposes individual retries. Models perform bounded language tasks inside that workflow.

```text
Candidate profile + pasted job
              |
              v
     Deterministic coordinator
              |
              v
   Fit Agent -> Resume Agent -> Application Agent
              |
              v
    Schema validation and persistence
              |
              v
       Review and tracking UI
```

## Components and Boundaries

### Candidate Profile

Stores only user-approved facts. Agent prompts receive this canonical profile rather than relying on conversational memory. Updates do not silently regenerate existing applications.

### Job Intake

Accepts pasted text and an optional URL. It preserves the original description so extracted fields and AI judgments remain auditable.

### AI Provider Interface

Accepts a system instruction, task input, and output schema. It returns structured output plus provider/model metadata. The initial implementations are:

- Ollama using Qwen3 8B by default
- Claude Haiku as an explicit comparison option
- A deterministic mock for tests and offline UI development

### Fit Agent

Extracts job facts and returns a 0-100 match score, matching evidence, gaps, concerns, and a recommendation. A score is never presented without supporting evidence.

### Résumé Agent

Returns suggested summary, skills, and bullet changes. Every suggestion must be grounded in the candidate profile. It does not claim to generate a finished PDF or DOCX file.

### Application Agent

Returns a cover-letter draft, draft responses to common questions, and a list of questions requiring the user's input. It must not guess sensitive or unknown facts.

### Coordinator

Runs agents sequentially, validates results, records each step's status, and stops dependent work when required input is invalid. Completed steps remain saved after later failures.

### Tracking Dashboard

Displays pipeline stages, job details, generation progress, errors, and materials. Status changes require an intentional user action.

## Data Model

The minimum persistent entities are:

- `CandidateProfile`: identity-neutral career facts, preferences, skills, résumé text, and update timestamp
- `Job`: original description, source URL, extracted fields, application status, and timestamps
- `AgentRun`: job, agent type, provider, model, run status, error summary, and timestamps
- `FitAnalysis`: score, recommendation, evidence, gaps, and concerns
- `ResumeSuggestions`: proposed summary, skill changes, bullet suggestions, and evidence references
- `ApplicationDraft`: cover letter, common answers, and questions for the user

Generated results are linked to the profile version used for generation so stale materials can be identified after the profile changes.

## AI and Privacy Rules

- Ollama is the default provider and runs locally with Qwen3 8B.
- Qwen3 4B is the supported lower-memory fallback.
- Claude is used only after an explicit user selection for that run.
- The interface identifies which provider will receive data before generation begins.
- API keys remain in ignored local environment files and are never stored in SQLite, logs, fixtures, or commits.
- Prompts instruct agents to distinguish supported facts, inferences, and missing information.
- Structured results are rejected when required fields are missing or malformed.
- No provider may submit an application or change a job's application status.

## Error Handling

- A job is saved before model execution begins.
- Each agent step has pending, running, complete, and failed states.
- Provider unavailability, timeouts, invalid output, and validation failures produce distinct user-facing errors.
- Retrying one step does not erase successful prior steps.
- Downstream steps do not run when a required upstream result is invalid.
- Claude never becomes an automatic fallback because that could transmit data and spend credit without approval.

## User Interface

The MVP contains four primary views:

1. **Dashboard:** summary counts and jobs grouped or filtered by application status.
2. **Add Job:** job-description textarea, optional URL, and provider choice.
3. **Job Detail:** original job information, coordinator progress, fit analysis, résumé suggestions, application drafts, retries, and status controls.
4. **Candidate Profile:** structured career information, preferences, and résumé text.

The interface favors a clear review workflow over decorative complexity. It must work on a laptop-sized screen and remain usable at narrow widths.

## Testing Strategy

- Unit tests for schema validation, fit-score boundaries, status transitions, and coordinator branching
- Prompt-policy tests asserting that all agent instructions prohibit invented experience
- Integration tests using the mock provider for the complete intake-to-application-package workflow
- Failure tests for unavailable providers, invalid structured output, and partial coordinator completion
- UI tests for job creation, profile editing, job details, and manual status changes
- Manual smoke tests against Ollama on the target M1 Mac with 16 GB memory
- A small, deliberate Claude comparison rather than Claude calls during the automated suite

## Acceptance Criteria

The MVP is complete when:

1. A user can save and edit a candidate profile.
2. A user can paste and save a job description with an optional URL.
3. The mock provider can complete the entire coordinator workflow deterministically.
4. Ollama can complete the workflow with Qwen3 8B and validated outputs.
5. Fit analysis includes a bounded score and evidence tied to the supplied profile and job.
6. Résumé suggestions and application drafts contain no facts absent from the supplied profile.
7. Failed steps are visible and individually retryable without losing completed work.
8. A user can review outputs and move a job through the defined statuses.
9. Claude cannot be invoked without deliberate selection.
10. Automated tests pass without calling or charging any external AI provider.
11. Setup instructions allow the app to run locally without undocumented steps.
12. The experiment log contains enough evidence to write the required process report honestly.

## Development Coordination

The implementation plan will define small tasks with explicit ownership and acceptance checks. The coordinator owns shared contracts and integration. Subagents will work only on tasks whose file boundaries and dependencies are clear, and the coordinator will review and test all contributed work before it is accepted.

Because all agents share one working directory, parallel tasks must avoid overlapping files. Dependent tasks will run sequentially. Git checkpoints will mark the approved specification, completed vertical slices, and the final reviewed state.

## Deferred Roadmap

After the MVP is validated, possible additions include permitted job feeds, company-career-page ingestion, résumé document export, saved search preferences, duplicate detection, interview preparation, reminders, and optional cloud deployment. These are not prerequisites for the assignment build.
