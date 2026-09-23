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
