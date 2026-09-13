import { LLMProvider, ClassifyRequest, GenerateRequest } from '../../interfaces/llmProvider.js';
import { InvalidInputError, MalformedOutputError, ModelTimeoutError, ModelUnavailableError } from '../../interfaces/errors.js';
import { ClassifyResult, GenerateResult } from '../../schemas/results.js';
import { parseClassifyOutput } from '../shared/parseClassifyOutput.js';

export interface OpenAIProviderOptions {
  /** Defaults to process.env.OPENAI_API_KEY. */
  apiKey?: string;
  model: string;
  name?: string;
  defaultTimeoutMs?: number;
}

const JSON_INSTRUCTION =
  'Respond with a single JSON object only — no markdown fences, no prose — of the shape ' +
  '{"category": string, "confidence": number between 0 and 1, "reason": string}.';

/** Thin `fetch`-based wrapper around OpenAI's Chat Completions API — see ClaudeProvider for the design rationale. */
export class OpenAIProvider implements LLMProvider {
  readonly providerKind = 'openai' as const;
  readonly name: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly defaultTimeoutMs: number;

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = options.model;
    this.name = options.name ?? `openai:${options.model}`;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const text = await this.callChatApi(request.input, request.systemPrompt, request.timeoutMs);
    return { text };
  }

  async classify(request: ClassifyRequest): Promise<ClassifyResult> {
    if (!request.input || request.input.trim().length === 0) {
      throw new InvalidInputError(this.name, 'input must not be empty');
    }
    const system = [request.systemPrompt, JSON_INSTRUCTION].filter(Boolean).join('\n\n');
    const raw = await this.callChatApi(request.input, system, request.timeoutMs);
    return parseClassifyOutput(this.name, raw);
  }

  private async callChatApi(input: string, system: string | undefined, timeoutMs: number | undefined): Promise<string> {
    if (!this.apiKey) {
      throw new ModelUnavailableError(this.name, 'OPENAI_API_KEY is not configured');
    }
    const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: input },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) throw new ModelTimeoutError(this.name, effectiveTimeout);
      throw new ModelUnavailableError(this.name, `failed to reach OpenAI API: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new ModelUnavailableError(this.name, `OpenAI API returned HTTP ${res.status}`);
    }
    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      throw new MalformedOutputError(this.name, 'OpenAI API response was not valid JSON');
    }
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      throw new MalformedOutputError(this.name, 'OpenAI API response had no message content');
    }
    return text;
  }
}
