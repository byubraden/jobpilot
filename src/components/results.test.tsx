import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FitAnalysisView } from "./fit-analysis";
import { ApplicationDraftView } from "./application-draft";

afterEach(cleanup);

describe("result review", () => {
  it("labels stale score as previous profile data", () => {
    render(<FitAnalysisView result={{ payload: {
      job: { title: "Engineer", company: "Acme", location: "Remote", requiredSkills: ["React"] },
      score: 83, recommendation: "possible", strengths: [{ claim: "React", evidence: "Built a project" }], gaps: [], concerns: [],
    }, profileVersion: 1, isStale: true }} />);
    expect(screen.getByText("Previous profile version 1")).toBeVisible();
    expect(screen.getByText(/regenerate analysis/i)).toBeVisible();
    expect(screen.getByText(/83/)).toBeVisible();
  });

  it("calls out unanswered questions", () => {
    render(<ApplicationDraftView result={{ payload: {
      coverLetter: "Hello hiring manager", answers: [], needsUserInput: ["What is your start date?"],
    }, profileVersion: 2, isStale: false }} />);
    expect(screen.getByText("What is your start date?")).toBeVisible();
    expect(screen.getByText(/needs your input/i)).toBeVisible();
  });

  it("labels a retained same-profile draft as belonging to a previous attempt", () => {
    render(<ApplicationDraftView result={{ payload: {
      coverLetter: "Old draft", answers: [], needsUserInput: [],
    }, profileVersion: 2, isStale: true, isPreviousAttempt: true }} />);
    expect(screen.getByText(/^previous analysis attempt/i)).toBeVisible();
    expect(screen.getByText(/regenerate analysis before using it/i)).toBeVisible();
  });
});
