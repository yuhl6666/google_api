import { LLMProvider, ClassifyRequest, GenerateRequest } from '../../interfaces/llmProvider.js';
import { InvalidInputError, MalformedOutputError, ModelTimeoutError, ModelUnavailableError } from '../../interfaces/errors.js';
import { ClassifyResult, GenerateResult } from '../../schemas/results.js';
import { parseClassifyOutput } from '../shared/parseClassifyOutput.js';

export interface ClaudeProviderOptions {
  /** Defaults to process.env.ANTHROPIC_API_KEY. */
  apiKey?: string;
  model: string;
  name?: string;
  defaultTimeoutMs?: number;
}

const JSON_INSTRUCTION =
  'Respond with a single JSON object only — no markdown fences, no prose — of the shape ' +
  '{"category": string, "confidence": number between 0 and 1, "reason": string}.';

/**
 * Thin `fetch`-based wrapper around Anthropic's Messages API. Implements
 * the same LLMProvider contract as every local model so the Router can
 * swap Local <-> Claude by changing a registry entry, never application
 * code (spec section 9). No SDK dependency on purpose — this is meant to
 * stay easy to audit and to keep this package's own dependency footprint
 * at zero runtime packages.
 */
export class ClaudeProvider implements LLMProvider {
  readonly providerKind = 'claude' as const;
  readonly name: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly defaultTimeoutMs: number;

  constructor(options: ClaudeProviderOptions) {
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.model = options.model;
    this.name = options.name ?? `claude:${options.model}`;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const text = await this.callMessagesApi(request.input, request.systemPrompt, request.timeoutMs);
    return { text };
  }

  async classify(request: ClassifyRequest): Promise<ClassifyResult> {
    if (!request.input || request.input.trim().length === 0) {
      throw new InvalidInputError(this.name, 'input must not be empty');
    }
    const system = [request.systemPrompt, JSON_INSTRUCTION].filter(Boolean).join('\n\n');
    const raw = await this.callMessagesApi(request.input, system, request.timeoutMs);
    return parseClassifyOutput(this.name, raw);
  }

  private async callMessagesApi(input: string, system: string | undefined, timeoutMs: number | undefined): Promise<string> {
    if (!this.apiKey) {
      throw new ModelUnavailableError(this.name, 'ANTHROPIC_API_KEY is not configured');
    }
    const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system,
          messages: [{ role: 'user', content: input }],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) throw new ModelTimeoutError(this.name, effectiveTimeout);
      throw new ModelUnavailableError(this.name, `failed to reach Anthropic API: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new ModelUnavailableError(this.name, `Anthropic API returned HTTP ${res.status}`);
    }
    let data: { content?: Array<{ type?: string; text?: string }> };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      throw new MalformedOutputError(this.name, 'Anthropic API response was not valid JSON');
    }
    const text = data.content?.find((block) => block.type === 'text')?.text;
    if (typeof text !== 'string') {
      throw new MalformedOutputError(this.name, 'Anthropic API response had no text content block');
    }
    return text;
  }
}
