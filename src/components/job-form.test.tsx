import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobForm } from "./job-form";

afterEach(cleanup);

describe("JobForm", () => {
  it("requires a substantial description and exposes optional URL", () => {
    render(<JobForm onCreate={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Job description" })).toHaveAttribute("minLength", "200");
    expect(screen.getByLabelText(/source url/i)).not.toBeRequired();
  });

  it("keeps a saved job visible when workflow startup fails", async () => {
    const onCreate = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        job: { id: 9, description: "A".repeat(200), status: "found", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, workflow: null,
        workflowStartFailure: { code: "profile_required", message: "Complete your candidate profile before analyzing this job." },
      },
    });
    render(<JobForm onCreate={onCreate} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Job description" }), { target: { value: "A".repeat(200) } });
    fireEvent.submit(screen.getByRole("button", { name: /save job/i }).closest("form")!);
    await waitFor(() => expect(screen.getByText(/job saved/i)).toBeVisible());
    expect(screen.getByText("Complete your candidate profile before analyzing this job.")).toBeVisible();
    expect(screen.getByRole("link", { name: /open saved job/i })).toHaveAttribute("href", "/jobs/9");
    expect(screen.getByRole("link", { name: /complete profile/i })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("button", { name: /save job/i })).not.toBeInTheDocument();
  });

  it("warns about a failed workflow step after the job is saved and directs the user to retry", async () => {
    const onCreate = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        job: { id: 12, description: "B".repeat(200), status: "found", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        workflowStartFailure: null,
        workflow: { jobId: 12, steps: [
          { kind: "fit", status: "complete", error: null },
          { kind: "resume", status: "failed", error: "AI response did not match the required format." },
          { kind: "application", status: "pending", error: null },
        ] },
      },
    });
    render(<JobForm onCreate={onCreate} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Job description" }), { target: { value: "B".repeat(200) } });
    fireEvent.submit(screen.getByRole("button", { name: /save job/i }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Job saved" })).toBeVisible());
    expect(screen.getByText(/résumé agent failed/i)).toBeVisible();
    expect(screen.getByText(/AI response did not match the required format/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /review and retry agents/i })).toHaveAttribute("href", "/jobs/12");
    expect(screen.queryByText(/analysis are ready for review/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save job/i })).not.toBeInTheDocument();
  });
});
