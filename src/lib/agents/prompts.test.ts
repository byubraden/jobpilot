import { describe, expect, it } from "vitest";
import type { AIProvider, AIRequest, AIResponse } from "../ai/provider";
import { MockProvider } from "../ai/mock-provider";
import {
  ApplicationDraftSchema,
  FitAnalysisSchema,
  ResumeSuggestionsSchema,
  type CandidateProfileInput,
  type JobInput,
} from "../domain/schemas";
import { APPLICATION_SYSTEM_PROMPT, runApplicationAgent } from "./application-agent";
import { FIT_SYSTEM_PROMPT, runFitAgent } from "./fit-agent";
import { RESUME_SYSTEM_PROMPT, runResumeAgent } from "./resume-agent";

const profile: CandidateProfileInput = {
  headline: "Junior developer",
  education: ["BS Computer Science"],
  internships: ["Built TypeScript APIs at Acme"],
  projects: ["Created a React dashboard"],
  skills: ["TypeScript", "React"],
  preferences: "Remote preferred",
  resumeText: "Built TypeScript APIs at Acme and a React dashboard.",
};
const job: JobInput = {
  description: "Software engineer role requiring TypeScript and React. ".repeat(5),
  sourceUrl: "https://example.com/job",
  status: "found",
};

class RecordingProvider implements AIProvider {
  readonly kind = "mock";
  readonly model = "recording";
  readonly requests: AIRequest<unknown>[] = [];
  private readonly mock = new MockProvider();

  generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
    this.requests.push(request);
    return this.mock.generate(request);
  }
}

describe("agent prompt policy", () => {
  it.each([FIT_SYSTEM_PROMPT, RESUME_SYSTEM_PROMPT, APPLICATION_SYSTEM_PROMPT])(
    "requires evidence and explicit missing-information handling",
    (system) => {
      expect(system).toContain("Do not invent");
      expect(system).toContain("candidate profile");
      expect(system).toContain("missing information");
      expect(system).toContain("JSON");
    },
  );

  it("sends only labeled profile and job facts to the fit task", async () => {
    const provider = new RecordingProvider();
    const result = await runFitAgent(provider, profile, job);
    const sent = provider.requests[0];

    expect(FitAnalysisSchema.safeParse(result.data).success).toBe(true);
    expect(sent.task).toBe("fit");
    expect(sent.schema).toBe(FitAnalysisSchema);
    expect(sent.system).toBe(FIT_SYSTEM_PROMPT);
    expect(sent.prompt).toContain('"headline": "Junior developer"');
    expect(sent.prompt).toContain('"description": "Software engineer');
    expect(sent.prompt).not.toContain("Fit analysis:");
  });

  it("provides the fit evidence to resume suggestions", async () => {
    const provider = new RecordingProvider();
    const fit = (await new MockProvider().generate({ task: "fit", system: "", prompt: "", schema: FitAnalysisSchema })).data;
    const result = await runResumeAgent(provider, profile, job, fit);
    const sent = provider.requests[0];

    expect(ResumeSuggestionsSchema.safeParse(result.data).success).toBe(true);
    expect(sent.task).toBe("resume");
    expect(sent.schema).toBe(ResumeSuggestionsSchema);
    expect(sent.prompt).toContain('"score": 82');
    expect(sent.prompt).toContain('"resumeText": "Built TypeScript APIs');
  });

  it("provides the fit evidence to application drafting", async () => {
    const provider = new RecordingProvider();
    const fit = (await new MockProvider().generate({ task: "fit", system: "", prompt: "", schema: FitAnalysisSchema })).data;
    const result = await runApplicationAgent(provider, profile, job, fit);
    const sent = provider.requests[0];

    expect(ApplicationDraftSchema.safeParse(result.data).success).toBe(true);
    expect(sent.task).toBe("application");
    expect(sent.schema).toBe(ApplicationDraftSchema);
    expect(sent.prompt).toContain('"score": 82');
    expect(sent.prompt).toContain('"description": "Software engineer');
  });
});
