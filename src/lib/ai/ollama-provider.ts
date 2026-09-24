import { z } from "zod";
import { AIUnavailableError, AIValidationError, type AIProvider, type AIRequest, type AIResponse } from "./provider";

type OllamaOptions = { baseUrl?: string; model?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number };

const responseSchema = z.object({
  message: z.object({ content: z.string() }),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
});

export class OllamaProvider implements AIProvider {
  readonly kind = "ollama";
  readonly model: string;

  constructor(private readonly options: OllamaOptions = {}) {
    this.model = options.model ?? "qwen3:8b";
  }

  async generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
    const baseUrl = (this.options.baseUrl ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
    let response: Response;
    try {
      response = await (this.options.fetch ?? globalThis.fetch)(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
          format: z.toJSONSchema(request.schema),
        }),
      });
    } catch {
      throw new AIUnavailableError();
    }
    if (!response.ok) throw new AIUnavailableError();

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw error instanceof SyntaxError ? new AIValidationError() : new AIUnavailableError();
    }
    const envelope = responseSchema.safeParse(payload);
    if (!envelope.success) throw new AIValidationError();

    let content: unknown;
    try {
      content = JSON.parse(envelope.data.message.content);
    } catch {
      throw new AIValidationError();
    }
    const parsed = request.schema.safeParse(content);
    if (!parsed.success) throw new AIValidationError();
    return {
      data: parsed.data,
      metadata: {
        provider: this.kind,
        model: this.model,
        inputTokens: envelope.data.prompt_eval_count,
        outputTokens: envelope.data.eval_count,
      },
    };
  }
}
