import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const ApplicationStatusSchema = z.enum([
  "found",
  "reviewing",
  "ready",
  "applied",
  "interviewing",
  "rejected",
  "offer",
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const AgentKindSchema = z.enum(["fit", "resume", "application"]);
export type AgentKind = z.infer<typeof AgentKindSchema>;

export const RunStatusSchema = z.enum(["pending", "running", "complete", "failed"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const ProviderKindSchema = z.enum(["ollama", "claude", "mock"]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const CandidateProfileInputSchema = z.strictObject({
  headline: nonEmptyText,
  education: z.array(nonEmptyText),
  internships: z.array(nonEmptyText),
  projects: z.array(nonEmptyText),
  skills: z.array(nonEmptyText).min(1),
  preferences: nonEmptyText.optional(),
  resumeText: nonEmptyText,
}).refine(
  ({ education, internships, projects }) =>
    education.length + internships.length + projects.length > 0,
  { message: "Add at least one education, internship, or project fact", path: ["education"] },
);
export type CandidateProfileInput = z.infer<typeof CandidateProfileInputSchema>;

export const JobInputSchema = z.strictObject({
  description: z.string().min(200),
  sourceUrl: z.url().optional(),
  status: ApplicationStatusSchema.default("found"),
});
export type JobInput = z.infer<typeof JobInputSchema>;

export const FitAnalysisSchema = z.strictObject({
  job: z.strictObject({
    title: nonEmptyText,
    company: nonEmptyText,
    location: nonEmptyText,
    compensation: nonEmptyText.optional(),
    requiredSkills: z.array(nonEmptyText),
  }),
  score: z.int().min(0).max(100),
  recommendation: z.enum(["strong", "possible", "skip"]),
  strengths: z.array(z.strictObject({
    claim: nonEmptyText,
    evidence: nonEmptyText,
  })),
  gaps: z.array(nonEmptyText),
  concerns: z.array(nonEmptyText),
}).refine(
  ({ strengths, gaps, concerns }) => strengths.length + gaps.length + concerns.length > 0,
  { message: "Fit analysis must include at least one supported strength, gap, or concern" },
);
export type FitAnalysis = z.infer<typeof FitAnalysisSchema>;

export const ResumeSuggestionsSchema = z.strictObject({
  summary: nonEmptyText,
  skillsToEmphasize: z.array(nonEmptyText),
  bulletSuggestions: z.array(z.strictObject({
    originalFact: nonEmptyText,
    suggestedBullet: nonEmptyText,
    rationale: nonEmptyText,
  })),
});
export type ResumeSuggestions = z.infer<typeof ResumeSuggestionsSchema>;

export const ApplicationDraftSchema = z.strictObject({
  coverLetter: nonEmptyText,
  answers: z.array(z.strictObject({
    question: nonEmptyText,
    answer: nonEmptyText,
  })),
  needsUserInput: z.array(nonEmptyText),
});
export type ApplicationDraft = z.infer<typeof ApplicationDraftSchema>;
