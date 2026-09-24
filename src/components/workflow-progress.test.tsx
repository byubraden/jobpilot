import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobStatusControl, WorkflowProgress } from "./workflow-progress";
import { MockProvider } from "../lib/ai/mock-provider";
import { createDatabase } from "../lib/db/connection";
import {
  AgentRunRepository, ApplicationDraftRepository, FitAnalysisRepository, JobRepository,
  ProfileRepository, ResumeSuggestionsRepository,
} from "../lib/db/repositories";
import { JobService } from "../lib/services/job-service";
import { JobWorkflowCoordinator } from "../lib/workflow/coordinator";

afterEach(cleanup);

describe("WorkflowProgress", () => {
  it("renders reused fit as complete after a successful résumé retry", async () => {
    const db = createDatabase(":memory:");
    try {
      const profiles = new ProfileRepository(db);
      const jobs = new JobRepository(db);
      const runs = new AgentRunRepository(db);
      const fitResults = new FitAnalysisRepository(db);
      const resumeResults = new ResumeSuggestionsRepository(db);
      const applicationDrafts = new ApplicationDraftRepository(db);
      let provider = new MockProvider({ errors: { resume: new Error("offline") } });
      const service = new JobService({
        profiles, jobs, runs, fitResults, resumeResults, applicationDrafts,
        createCoordinator() {
          return new JobWorkflowCoordinator({ provider, profiles, jobs, runs, fitResults, resumeResults, applicationDrafts });
        },
      });
      profiles.save({
        headline: "Developer", education: ["MS Information Systems"], internships: [], projects: [],
        skills: ["TypeScript"], resumeText: "Built a web application.",
      });
      const created = await service.createJob({ description: "A TypeScript web development role. ".repeat(8) }, "mock");
      provider = new MockProvider();
      const retried = await service.retryAgent(created.job.id, "resume", "mock");
      if (!retried.detail) throw new Error("Expected stored job detail");

      render(<WorkflowProgress jobId={created.job.id} runs={retried.detail.runs} latestAttemptId={retried.detail.latestAttemptId} />);

      expect(screen.getByText("Fit analysis").closest("li")).toHaveTextContent("complete");
      expect(screen.getByText("Résumé agent").closest("li")).toHaveTextContent("complete");
      expect(screen.getByText("Application draft").closest("li")).toHaveTextContent("complete");
    } finally {
      db.close();
    }
  });

  it("defaults regeneration to local Ollama and submits that selection", async () => {
    const onAnalyze = vi.fn().mockResolvedValue({ ok: true, data: {} });
    render(<WorkflowProgress jobId={4} runs={[]} onAnalyze={onAnalyze} />);
    expect(screen.getByRole("radio", { name: /ollama/i })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /run or regenerate/i }));
    await waitFor(() => expect(onAnalyze).toHaveBeenCalledOnce());
    expect(onAnalyze.mock.calls[0][0].get("providerKind")).toBe("ollama");
  });

  it("shows only the latest attempt and leaves its blocked downstream step pending", () => {
    render(<WorkflowProgress jobId={4} latestAttemptId={2} runs={[
      { id: 5, jobId: 4, attemptId: 2, kind: "resume", provider: "mock", model: "fixture", profileVersion: 1, status: "failed", error: "Could not generate", startedAt: "2026-01-02", finishedAt: "2026-01-02" },
      { id: 4, jobId: 4, attemptId: 2, kind: "fit", provider: "mock", model: "fixture", profileVersion: 1, status: "complete", error: null, startedAt: "2026-01-02", finishedAt: "2026-01-02" },
      { id: 3, jobId: 4, attemptId: 1, kind: "application", provider: "mock", model: "fixture", profileVersion: 1, status: "complete", error: null, startedAt: "2026-01-01", finishedAt: "2026-01-01" },
    ]} />);
    expect(screen.getByText("Application draft").closest("li")).toHaveTextContent("not started");
    expect(screen.getByText("Application draft").closest("li")).not.toHaveTextContent("complete");
  });

  it("offers a retry for the failed résumé step", () => {
    render(<WorkflowProgress jobId={4} runs={[{
      id: 1, jobId: 4, attemptId: 1, kind: "resume", provider: "mock", model: "fixture", profileVersion: 1,
      status: "failed", error: "Could not generate", startedAt: "2026-01-01", finishedAt: "2026-01-01",
    }]} />);
    expect(screen.getByRole("button", { name: /retry résumé agent/i })).toBeVisible();
    expect(screen.getByText("Could not generate")).toBeVisible();
  });

  it("keeps local and Claude disclosures visible in the detail workflow picker", () => {
    render(<WorkflowProgress jobId={4} runs={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: /ollama/i }));
    expect(screen.getByRole("note")).toHaveTextContent("Runs locally with Ollama. Your profile and job description stay on this machine.");
    fireEvent.click(screen.getByRole("radio", { name: /claude/i }));
    expect(screen.getByRole("note")).toHaveTextContent("This sends your profile and job description to Claude and uses API credit.");
  });
});

describe("JobStatusControl", () => {
  it("shows the service rejection for an invalid status change", async () => {
    render(<JobStatusControl jobId={4} status="offer" onUpdate={vi.fn().mockResolvedValue({ ok: false, formError: "Invalid job status transition: offer → applied" })} />);
    fireEvent.change(screen.getByLabelText(/current status/i), { target: { value: "applied" } });
    fireEvent.click(screen.getByRole("button", { name: /save status/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invalid job status transition: offer → applied"));
    expect(screen.getByLabelText(/current status/i)).toHaveValue("offer");
    expect(screen.getByRole("button", { name: /save status/i })).toBeDisabled();
  });

  it("adopts the persisted status returned by a successful update", async () => {
    render(<JobStatusControl jobId={4} status="found" onUpdate={vi.fn().mockResolvedValue({ ok: true, data: { status: "applied" } })} />);
    fireEvent.change(screen.getByLabelText(/current status/i), { target: { value: "applied" } });
    fireEvent.click(screen.getByRole("button", { name: /save status/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /save status/i })).toBeDisabled());
    expect(screen.getByLabelText(/current status/i)).toHaveValue("applied");
  });
});
