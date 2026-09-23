import type { AgentKind } from "../domain/schemas";
import { AIValidationError, type AIProvider, type AIRequest, type AIResponse } from "./provider";

type MockOptions = {
  fixtures?: Partial<Record<AgentKind, unknown>>;
  errors?: Partial<Record<AgentKind, Error>>;
};

const defaultFixtures: Record<AgentKind, unknown> = {
  fit: {
    job: {
      title: "Software Engineer",
      company: "Example Company",
      location: "Remote",
      requiredSkills: ["TypeScript"],
    },
    score: 82,
    recommendation: "strong",
    strengths: [],
    gaps: [],
    concerns: ["Mock result: review all facts before use"],
  },
  resume: {
    summary: "Review the candidate profile for role-relevant experience.",
    skillsToEmphasize: [],
    bulletSuggestions: [],
  },
  application: {
    coverLetter: "Dear hiring team, I am interested in this role. Please review my verified experience before sending this draft.",
    answers: [],
    needsUserInput: ["Confirm the company, role, and any unanswered application questions."],
  },
};

export class MockProvider implements AIProvider {
  readonly kind = "mock";
  readonly model = "deterministic";

  constructor(private readonly options: MockOptions = {}) {}

  async generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
    const error = this.options.errors?.[request.task];
    if (error) throw error;

    const fixture = Object.hasOwn(this.options.fixtures ?? {}, request.task)
      ? this.options.fixtures?.[request.task]
      : defaultFixtures[request.task];
    const parsed = request.schema.safeParse(fixture);
    if (!parsed.success) throw new AIValidationError();

    return {
      data: parsed.data,
      metadata: { provider: this.kind, model: this.model },
    };
  }
}
