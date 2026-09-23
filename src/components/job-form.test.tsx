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
        job: { id: 9 }, workflow: null,
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
});
