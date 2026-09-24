import { describe, expect, it } from "vitest";
import {
  ApplicationDraftSchema,
  ApplicationStatusSchema,
  CandidateProfileInputSchema,
  FitAnalysisSchema,
  JobInputSchema,
  ResumeSuggestionsSchema,
} from "./schemas";

const candidate = {
  headline: "Junior full-stack developer",
  education: ["MS Computer Science"],
  internships: [],
  projects: [],
  skills: ["TypeScript"],
  resumeText: "Built a full-stack capstone application.",
};

const fit = {
  job: {
    title: "Software Engineer",
    company: "Example Co",
    location: "Portland, OR",
    requiredSkills: ["TypeScript"],
  },
  score: 80,
  recommendation: "strong",
  strengths: [{ claim: "TypeScript experience", evidence: "Capstone application" }],
  gaps: [],
  concerns: [],
};

describe("application status", () => {
  it("exposes the approved tracking progression", () => {
    expect(ApplicationStatusSchema.options).toEqual([
      "found", "reviewing", "ready", "applied", "interviewing", "rejected", "offer",
    ]);
  });
});

describe("candidate profile input", () => {
  it("rejects a profile with no headline, career facts, skills, or résumé text", () => {
    expect(CandidateProfileInputSchema.safeParse({ education: [], internships: [], projects: [], skills: [] }).success).toBe(false);
  });

  it("requires at least one career fact across education, internships, and projects", () => {
    expect(CandidateProfileInputSchema.safeParse({ ...candidate, education: [] }).success).toBe(false);
    expect(CandidateProfileInputSchema.safeParse(candidate).success).toBe(true);
  });

  it("rejects missing skills or résumé text", () => {
    expect(CandidateProfileInputSchema.safeParse({ ...candidate, skills: [] }).success).toBe(false);
    expect(CandidateProfileInputSchema.safeParse({ ...candidate, resumeText: "" }).success).toBe(false);
  });
});

describe("job input", () => {
  it("defaults a valid new job to found", () => {
    expect(JobInputSchema.parse({ description: "x".repeat(200) }).status).toBe("found");
  });

  it("rejects descriptions shorter than 200 characters", () => {
    expect(JobInputSchema.safeParse({ description: "x".repeat(199) }).success).toBe(false);
  });
});

describe("agent output", () => {
  it("rejects fit scores above 100", () => {
    expect(() => FitAnalysisSchema.parse({ score: 101 })).toThrow();
    expect(FitAnalysisSchema.safeParse({ ...fit, score: 101 }).success).toBe(false);
  });

  it("accepts the score boundaries and rejects fractional scores", () => {
    expect(FitAnalysisSchema.safeParse({ ...fit, score: 0 }).success).toBe(true);
    expect(FitAnalysisSchema.safeParse({ ...fit, score: 100 }).success).toBe(true);
    expect(FitAnalysisSchema.safeParse({ ...fit, score: 50.5 }).success).toBe(false);
  });

  it("requires evidence for each strength", () => {
    expect(FitAnalysisSchema.safeParse({ ...fit, strengths: [{ claim: "TypeScript" }] }).success).toBe(false);
  });

  it("rejects a fit analysis with no strengths, gaps, or concerns", () => {
    expect(FitAnalysisSchema.safeParse({ ...fit, strengths: [], gaps: [], concerns: [] }).success).toBe(false);
    expect(FitAnalysisSchema.safeParse({ ...fit, strengths: [], gaps: ["No professional React evidence supplied"], concerns: [] }).success).toBe(true);
  });

  it("requires original fact references in résumé bullet suggestions", () => {
    expect(ResumeSuggestionsSchema.safeParse({
      summary: "Full-stack developer",
      skillsToEmphasize: ["TypeScript"],
      bulletSuggestions: [{ originalFact: "Built a capstone app", suggestedBullet: "Built a full-stack app", rationale: "Relevant experience" }],
    }).success).toBe(true);
    expect(ResumeSuggestionsSchema.safeParse({ summary: "Full-stack developer", skillsToEmphasize: [], bulletSuggestions: [{ suggestedBullet: "Invented experience", rationale: "Relevant" }] }).success).toBe(false);
  });

  it("validates application drafts and missing-information questions", () => {
    expect(ApplicationDraftSchema.safeParse({ coverLetter: "Dear hiring manager...", answers: [{ question: "Why us?", answer: "Your API work." }], needsUserInput: ["Preferred start date?"] }).success).toBe(true);
    expect(ApplicationDraftSchema.safeParse({ coverLetter: "Dear hiring manager...", answers: [{ question: "Why us?" }], needsUserInput: [] }).success).toBe(false);
  });
});
