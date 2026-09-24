import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const job = { id: 2, description: "Engineer position ".repeat(18), status: "found" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
vi.mock("../lib/services/container", () => ({ getServices: () => ({
  jobs: { listJobs: () => [job], getJobDetail: () => ({ job, currentProfileVersion: 2, runs: [], fit: null, resume: null, application: null }) },
  profiles: { getCurrentProfile: () => null },
}) }));
vi.mock("./actions", () => ({ createJobAction: vi.fn(), saveProfileAction: vi.fn(), analyzeJobAction: vi.fn(), retryAgentAction: vi.fn(), updateJobStatusAction: vi.fn() }));

import Home from "./page";
import NewJobPage from "./jobs/new/page";
import JobDetailPage from "./jobs/[id]/page";
import ProfilePage from "./profile/page";

afterEach(cleanup);

describe("main routes", () => {
  it("shows the saved pipeline on the dashboard", async () => {
    render(await Home());
    expect(screen.getByRole("heading", { name: /application pipeline/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /view job 2/i })).toBeVisible();
  });
  it("exposes the intake and profile editors", async () => {
    render(await NewJobPage());
    expect(screen.getByRole("textbox", { name: "Job description" })).toBeVisible();
    cleanup();
    render(await ProfilePage());
    expect(screen.getByRole("textbox", { name: /résumé text/i })).toBeVisible();
  });
  it("shows the original posting and review controls", async () => {
    render(await JobDetailPage({ params: Promise.resolve({ id: "2" }) }));
    expect(screen.getByRole("heading", { name: /job 2/i })).toBeVisible();
    expect(screen.getByText((_, element) => element?.classList.contains("posting-copy") === true && element.textContent === job.description)).toBeVisible();
    expect(screen.getByRole("button", { name: /save status/i })).toBeVisible();
  });
});
