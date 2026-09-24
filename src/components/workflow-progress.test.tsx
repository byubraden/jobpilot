import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobStatusControl, WorkflowProgress } from "./workflow-progress";

afterEach(cleanup);

describe("WorkflowProgress", () => {
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
