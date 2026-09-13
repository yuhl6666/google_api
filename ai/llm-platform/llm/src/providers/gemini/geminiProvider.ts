import { LLMProvider, ClassifyRequest, GenerateRequest } from '../../interfaces/llmProvider.js';
import { InvalidInputError, MalformedOutputError, ModelTimeoutError, ModelUnavailableError } from '../../interfaces/errors.js';
import { ClassifyResult, GenerateResult } from '../../schemas/results.js';
import { parseClassifyOutput } from '../shared/parseClassifyOutput.js';

export interface GeminiProviderOptions {
  /** Defaults to process.env.GEMINI_API_KEY. */
  apiKey?: string;
  model: string;
  name?: string;
  defaultTimeoutMs?: number;
}

const JSON_INSTRUCTION =
  'Respond with a single JSON object only — no markdown fences, no prose — of the shape ' +
  '{"category": string, "confidence": number between 0 and 1, "reason": string}.';

/** Thin `fetch`-based wrapper around Gemini's generateContent API — see ClaudeProvider for the design rationale. */
export class GeminiProvider implements LLMProvider {
  readonly providerKind = 'gemini' as const;
  readonly name: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly defaultTimeoutMs: number;

  constructor(options: GeminiProviderOptions) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    this.model = options.model;
    this.name = options.name ?? `gemini:${options.model}`;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const text = await this.callGenerateContent(request.input, request.systemPrompt, request.timeoutMs);
    return { text };
  }

  async classify(request: ClassifyRequest): Promise<ClassifyResult> {
    if (!request.input || request.input.trim().length === 0) {
      throw new InvalidInputError(this.name, 'input must not be empty');
    }
    const system = [request.systemPrompt, JSON_INSTRUCTION].filter(Boolean).join('\n\n');
    const raw = await this.callGenerateContent(request.input, system, request.timeoutMs);
    return parseClassifyOutput(this.name, raw);
  }

  private async callGenerateContent(input: string, system: string | undefined, timeoutMs: number | undefined): Promise<string> {
    if (!this.apiKey) {
      throw new ModelUnavailableError(this.name, 'GEMINI_API_KEY is not configured');
    }
    const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: input }] }],
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          }),
          signal: controller.signal,
        },
      );
    } catch (err) {
      if (controller.signal.aborted) throw new ModelTimeoutError(this.name, effectiveTimeout);
      throw new ModelUnavailableError(this.name, `failed to reach Gemini API: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new ModelUnavailableError(this.name, `Gemini API returned HTTP ${res.status}`);
    }
    let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      throw new MalformedOutputError(this.name, 'Gemini API response was not valid JSON');
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new MalformedOutputError(this.name, 'Gemini API response had no text part');
    }
    return text;
  }
}
