# JobPilot Experiment Log

This log records factual evidence for the assignment report. Times use America/Denver. Entries must describe observed events rather than reconstructed claims.

## 2026-09-23

- Project discovery: aligned on a local-first assistant for hybrid entry-level and junior full-stack/AI-integration jobs in western US states.
- Scope decision: limited the MVP to pasted job descriptions, AI-assisted preparation, and manual status tracking. Automatic discovery and submission were deferred because they add scraping, authentication, reliability, and consent risks.
- AI decision: selected Ollama with Qwen3 8B as the default on an M1 Mac with 16 GB memory. Selected Qwen3 4B as a fallback and Claude Haiku as an explicit comparison/cold-review provider.
- Technique decision: selected Spec-Driven Development, Subagents and a Coordinator Agent, Vibe Coding, and an Adversarial Cold Review using another model family.
- Design checkpoint: committed the approved product specification as commit `c7dccff`.
- Planning checkpoint: decomposed implementation into nine reviewed tasks with one editing subagent at a time because all agents share the working directory.

## Build Session

- Start: 2026-09-23 14:19:07 MDT.
- Task 1 dispatched to the foundation implementation subagent after creating the isolated `feature/jobpilot-mvp` worktree and completing the dependency/interface preflight scan.

The coordinator will append the end timestamp, verification results, failures, corrections, model calls, and review outcomes here during execution.

## 2026-09-24 — Task 8 browser and live-model smoke

- The first `npm run test:e2e -- e2e/job-workflow.spec.ts` attempt could not bind `127.0.0.1:3109` in the restricted sandbox (`listen EPERM`). With loopback access, the same Playwright command passed one test in 5.7 seconds. It used mock mode and a fresh temporary database, edited the profile to version 2, saved a 200+ character job, displayed score 82 plus résumé and application sections, and kept Applied status after reload.
- Initial `npm test` found 93 passing unit tests but failed the suite because Vitest discovered the Playwright spec and Playwright rejected `test()` outside its runner. Scoping Vitest to `src/**/*.test.{ts,tsx}` restored a clean run: 14 files and 93 tests passed.
- The first `npm run build` succeeded but warned that dynamic `DATABASE_PATH` resolution caused Turbopack to trace the whole project. Adding its documented ignore annotation to the `path.resolve` call removed the warning on a second successful build. Runtime database path resolution remained unchanged.
- Live Ollama smoke used a fresh database at `/var/folders/1l/rvd0rxgn627dk5vg1njbhnp40000gn/T/jobpilot-task8-live-1x4Jjb/jobpilot.sqlite`, the UI on `127.0.0.1:3111`, Ollama at `127.0.0.1:11434`, and `qwen3:8b`. The profile and job were explicitly fictional placeholders; no real candidate facts or keys were used. The job was submitted through the browser with Ollama selected.
- Exact run start: `2026-09-24T13:58:36.856Z` (`07:58:36.856 MDT`). End: `2026-09-24T14:01:36.793Z` (`08:01:36.793 MDT`). Elapsed browser submission time: **179.9 seconds**. The server reported `createJobAction` at 179323 ms. No retries were needed or attempted. The temporary database recorded exactly three complete `agent_runs`, one each for fit, résumé, and application, all with provider `ollama`, model `qwen3:8b`, and no error.
- Observed quality: the fit result extracted “Junior Software Engineer,” “Example Company,” remote location, and the posting's TypeScript/React/API skills. Its displayed score was **0/100** while its recommendation was **“strong”**. Both values were accepted by the current structured schema; their contradiction means this score should not be trusted without review. Résumé suggestions reflected the sample coursework and noted the lack of practical experience. The application draft referenced the posting and explicitly acknowledged missing internship/project experience. These are observations of one local generation, not reliability claims.
- After stopping and restarting the development server with the same database, `/jobs/1` loaded and showed all three workflow steps as complete and the fit section visible. The temporary browser driver was removed after the run. Claude was not invoked.
