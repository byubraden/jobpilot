# JobPilot Process Report Draft

This is an evidence-based starting point. The student must revise it into their own words before submission.

## What I Built

JobPilot is a local-first web app for saving pasted job descriptions, preparing application material, and manually tracking status. A candidate profile and original posting are stored in SQLite. A deterministic coordinator runs fit, résumé, and application agents in sequence, validates and saves each result, and allows a failed step to be retried. The UI displays the generated package for human review; it neither discovers jobs nor submits applications. Ollama is the default local AI option, Claude is an explicit optional provider, and mock mode supports repeatable tests.

## Techniques I Used

- **Worktree-based Development:** Implementation took place in the `feature/jobpilot-mvp` worktree, separate from `main`. This isolated the project changes while the coordinator integrated them; it was process infrastructure, not a product feature.
- **Spec-Driven Development:** The approved product plan set the workflow, privacy boundaries, and 12 acceptance criteria before implementation. A nine-task plan gave each development subagent defined files and checks.
- **Subagents and a Coordinator Agent:** The development coordinator assigned bounded tasks, reviewed contributions, and integrated the pieces. This development workflow is distinct from JobPilot's runtime coordinator and three bounded AI agents.

The log also records a limited Vibe Coding style: conversational decisions shaped the local-first scope, provider choices, and deferral of automatic discovery and submission while AI agents implemented the plan. It does not record the user reviewing each working UI increment or a complete user-feedback loop, so I cannot claim that part of the technique was exercised.

## What Helped

The written contract made agent handoffs concrete: data, AI, workflow, service, UI, and provider work could be checked against the same plan. Review loops caught actual defects. For example, a database regression exposed lost result provenance and led to atomic run completion and migration fixes. A workflow concurrency test caught overlapping runs from separate coordinator instances. Provider tests caught a Claude request schema with unsupported keywords; the wire format was corrected without a live API call. These are observed improvements in the task reports and commits, not a claim that all defects were found.

## What Hurt or Slowed Me Down

Integration needed repair after the browser test was added: Vitest collected the Playwright spec and failed even though 93 unit tests passed; scoping Vitest to unit files fixed it. The first browser attempt could not bind the local port in the restricted sandbox, then passed with loopback access. A build warning about database-path tracing required a targeted fix. These failures cost extra verification and show that passing component tests did not automatically mean the full workflow worked. Mock mode also returns fixed sample facts and score, so it cannot establish real-model output quality.

## Local Ollama vs. Claude Observations

The one recorded live `qwen3:8b` Ollama run took **179.9 seconds** to submit through the browser. Three agent runs completed and persisted without retries, and their outputs recognized the fictional posting and noted missing candidate experience. The fit view nevertheless showed **0/100** with a **“strong”** recommendation. Both values passed the structural schema, so this is a direct semantic-coherence concern, not proof of reliable fit assessment. Claude provider behavior was tested with mocked transport, but no live Claude comparison or adversarial cold review was performed. The planned review was skipped at the user's request on 2026-09-24, with no review API calls or cost.

## What I Learned

Structured output validation checks format and ranges but does not guarantee that fields agree. Persisting each step and its profile version made partial failures and stale results reviewable. A deterministic coordinator kept model work bounded, while test-first regressions and integrated browser checks exposed problems at different boundaries. The experiment log's same-day project checkpoint windows, including approved spec and planning work, total just over two hours. Long idle gaps are excluded; the windows do not prove continuous keyboard work.

## What I Would Do Next

Review the 0/100 versus “strong” case as a product decision: define how conflicting model judgments should be presented or checked, then test the chosen behavior with realistic cases. I would not add an arbitrary score cutoff. I would also complete a permissioned Claude cold review if desired, triage its actual findings, and have the student verify the report against the repository before submitting their own version.
