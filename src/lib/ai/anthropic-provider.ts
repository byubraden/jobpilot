import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AIUnavailableError, AIValidationError, type AIProvider, type AIRequest, type AIResponse } from "./provider";

type AnthropicOptions = { apiKey: string; model?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number };

export class AnthropicProvider implements AIProvider {
  readonly kind = "claude";
  readonly model: string;
  private readonly client: Anthropic;

  constructor(options: AnthropicOptions) {
    if (!options.apiKey?.trim()) throw new Error("Anthropic API key is required.");
    this.model = options.model ?? "claude-haiku-4-5-20251001";
    this.client = new Anthropic({
      apiKey: options.apiKey,
      fetch: options.fetch,
      timeout: options.timeoutMs ?? 120_000,
      maxRetries: 0,
    });
  }

  async generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
    let response: Anthropic.Messages.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        output_config: { format: zodOutputFormat(request.schema) },
      });
    } catch {
      throw new AIUnavailableError();
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) throw new AIValidationError();
    let content: unknown;
    try {
      content = JSON.parse(text.text);
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
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
