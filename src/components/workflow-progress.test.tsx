import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobStatusControl, WorkflowProgress } from "./workflow-progress";

afterEach(cleanup);

describe("WorkflowProgress", () => {
  it("offers a retry for the failed résumé step", () => {
    render(<WorkflowProgress jobId={4} runs={[{
      id: 1, jobId: 4, kind: "resume", provider: "mock", model: "fixture", profileVersion: 1,
      status: "failed", error: "Could not generate", startedAt: "2026-01-01", finishedAt: "2026-01-01",
    }]} />);
    expect(screen.getByRole("button", { name: /retry résumé agent/i })).toBeVisible();
    expect(screen.getByText("Could not generate")).toBeVisible();
  });
});

describe("JobStatusControl", () => {
  it("shows the service rejection for an invalid status change", async () => {
    render(<JobStatusControl jobId={4} status="offer" onUpdate={vi.fn().mockResolvedValue({ ok: false, formError: "Invalid job status transition: offer → applied" })} />);
    fireEvent.change(screen.getByLabelText(/current status/i), { target: { value: "applied" } });
    fireEvent.click(screen.getByRole("button", { name: /save status/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invalid job status transition: offer → applied"));
  });
});
