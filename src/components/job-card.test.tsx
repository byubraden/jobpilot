import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JobCard, JobList } from "./job-card";

afterEach(cleanup);

const job = {
  id: 3, description: "Frontend engineer role ".repeat(15), status: "reviewing" as const,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("JobCard", () => {
  it("links to a saved job and shows its status", () => {
    render(<JobCard job={job} />);
    expect(screen.getByRole("link", { name: /view job 3/i })).toHaveAttribute("href", "/jobs/3");
    expect(screen.getByText(/reviewing/i)).toBeVisible();
  });
});

describe("JobList", () => {
  it("shows an empty pipeline and all seven status filters", () => {
    render(<JobList jobs={[]} />);
    expect(screen.getByRole("heading", { name: /application pipeline/i })).toBeVisible();
    expect(screen.getByText(/your pipeline starts here/i)).toBeVisible();
    for (const status of ["found", "reviewing", "ready", "applied", "interviewing", "rejected", "offer"]) {
      expect(screen.getByRole("button", { name: new RegExp(status) })).toBeVisible();
    }
  });
  it("filters the saved pipeline by status", () => {
    render(<JobList jobs={[job]} />);
    fireEvent.click(screen.getByRole("button", { name: /offer/i }));
    expect(screen.queryByRole("link", { name: /view job 3/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no offer jobs yet/i)).toBeVisible();
  });
});
