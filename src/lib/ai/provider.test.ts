import { describe, expect, it } from "vitest";
import { ApplicationDraftSchema, FitAnalysisSchema, ResumeSuggestionsSchema } from "../domain/schemas";
import { MockProvider } from "./mock-provider";
import { AIUnavailableError, AIValidationError } from "./provider";

const request = <T>(task: "fit" | "resume" | "application", schema: import("zod").ZodType<T>) => ({
  task,
  system: "policy",
  prompt: "job and profile",
  schema,
});

describe("MockProvider", () => {
  it("returns a deterministic, schema-validated fit analysis", async () => {
    const mock = new MockProvider();
    const response = await mock.generate(request("fit", FitAnalysisSchema));

    expect(FitAnalysisSchema.parse(response.data).score).toBe(82);
    expect(response.metadata).toMatchObject({ provider: "mock", model: "deterministic" });
    expect(mock.kind).toBe("mock");
  });

  it("returns schema-valid resume and application fixtures", async () => {
    const mock = new MockProvider();

    expect(ResumeSuggestionsSchema.safeParse((await mock.generate(request("resume", ResumeSuggestionsSchema))).data).success).toBe(true);
    expect(ApplicationDraftSchema.safeParse((await mock.generate(request("application", ApplicationDraftSchema))).data).success).toBe(true);
  });

  it("does not present invented profile evidence as a mock suggestion", async () => {
    const mock = new MockProvider();
    const fit = await mock.generate(request("fit", FitAnalysisSchema));
    const resume = await mock.generate(request("resume", ResumeSuggestionsSchema));

    expect(fit.data.strengths).toEqual([]);
    expect(resume.data.skillsToEmphasize).toEqual([]);
    expect(resume.data.bulletSuggestions).toEqual([]);
  });

  it("rejects an injected fixture that fails the requested schema", async () => {
    const mock = new MockProvider({ fixtures: { fit: { score: 101 } } });

    await expect(mock.generate(request("fit", FitAnalysisSchema))).rejects.toBeInstanceOf(AIValidationError);
  });

  it("uses the caller's requested schema even for an otherwise valid fixture", async () => {
    const mock = new MockProvider();

    await expect(mock.generate(request("fit", ResumeSuggestionsSchema))).rejects.toBeInstanceOf(AIValidationError);
  });

  it("injects errors only for the selected task", async () => {
    const failure = new AIUnavailableError();
    const mock = new MockProvider({ errors: { fit: failure } });

    await expect(mock.generate(request("fit", FitAnalysisSchema))).rejects.toBe(failure);
    await expect(mock.generate(request("resume", ResumeSuggestionsSchema))).resolves.toMatchObject({ metadata: { provider: "mock" } });
  });
});

describe("AI errors", () => {
  it("does not echo potentially sensitive details", () => {
    expect(new AIUnavailableError("api-key-secret").message).not.toContain("api-key-secret");
    expect(new AIValidationError("api-key-secret").message).not.toContain("api-key-secret");
  });
});
