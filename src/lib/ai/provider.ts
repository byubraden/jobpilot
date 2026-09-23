import type { z } from "zod";
import type { AgentKind, ProviderKind } from "../domain/schemas";

export type AIRequest<T> = {
  task: AgentKind;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
};

export type AIResponse<T> = {
  data: T;
  metadata: {
    provider: ProviderKind;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
  };
};

export interface AIProvider {
  readonly kind: ProviderKind;
  readonly model: string;
  generate<T>(request: AIRequest<T>): Promise<AIResponse<T>>;
}

export class AIUnavailableError extends Error {
  constructor(details?: unknown) {
    super("AI provider is unavailable. Try again later.");
    this.name = "AIUnavailableError";
    void details;
  }
}

export class AIValidationError extends Error {
  constructor(details?: unknown) {
    super("AI response did not match the expected format.");
    this.name = "AIValidationError";
    void details;
  }
}
