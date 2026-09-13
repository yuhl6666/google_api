import { LocalModel } from '../../interfaces/localModel.js';
import { ClassifyRequest, EmbedRequest, GenerateRequest } from '../../interfaces/llmProvider.js';
import { InvalidInputError, MalformedOutputError, ModelTimeoutError, ModelUnavailableError } from '../../interfaces/errors.js';
import { ClassifyResult, EmbedResult, GenerateResult } from '../../schemas/results.js';
import { parseClassifyOutput } from '../shared/parseClassifyOutput.js';

export interface OllamaProviderOptions {
  /** Ollama model tag, e.g. "llama3.1:8b". */
  modelId: string;
  /** Human-readable name used in errors/traces (defaults to modelId). */
  name?: string;
  /** Defaults to http://localhost:11434, or the OLLAMA_HOST env var if set. */
  endpoint?: string;
  defaultTimeoutMs?: number;
}

/**
 * LocalModel adapter for Ollama (https://ollama.com) — see
 * docs/architecture/runtime-comparison.md for why this runtime was chosen
 * first. Talks to Ollama's REST API directly over `fetch`, so it has no
 * SDK dependency and can be swapped for another runtime (llama.cpp server,
 * a vLLM OpenAI-compatible endpoint, ...) by writing a new class with the
 * same LocalModel interface — nothing above this file needs to change.
 */
export class OllamaProvider implements LocalModel {
  readonly providerKind = 'local' as const;
  readonly modelId: string;
  readonly name: string;
  private readonly endpoint: string;
  private readonly defaultTimeoutMs: number;

  constructor(options: OllamaProviderOptions) {
    this.modelId = options.modelId;
    this.name = options.name ?? options.modelId;
    this.endpoint = (options.endpoint ?? process.env.OLLAMA_HOST ?? 'http://localhost:11434').replace(/\/$/, '');
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, { signal: AbortSignal.timeout(2_000) });
      if (!res.ok) return false;
      const data = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
      return Array.isArray(data.models) && data.models.some((m) => m.name === this.modelId || m.model === this.modelId);
    } catch {
      return false;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const raw = await this.callOllama(request.input, request.systemPrompt, request.timeoutMs, false);
    return { text: raw };
  }

  async classify(request: ClassifyRequest): Promise<ClassifyResult> {
    if (!request.input || request.input.trim().length === 0) {
      throw new InvalidInputError(this.name, 'input must not be empty');
    }
    const raw = await this.callOllama(request.input, request.systemPrompt, request.timeoutMs, true);
    return parseClassifyOutput(this.name, raw);
  }

  async embed(request: EmbedRequest): Promise<EmbedResult> {
    if (!request.input || request.input.trim().length === 0) {
      throw new InvalidInputError(this.name, 'input must not be empty');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? this.defaultTimeoutMs);
    try {
      const res = await fetch(`${this.endpoint}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.modelId, prompt: request.input }),
        signal: controller.signal,
      });
      if (!res.ok) throw new ModelUnavailableError(this.name, `Ollama returned HTTP ${res.status}`);
      const data = (await res.json()) as { embedding?: number[] };
      if (!Array.isArray(data.embedding)) throw new MalformedOutputError(this.name, 'Ollama response missing "embedding" field');
      return { vector: data.embedding };
    } catch (err) {
      if (err instanceof MalformedOutputError || err instanceof ModelUnavailableError) throw err;
      if (controller.signal.aborted) throw new ModelTimeoutError(this.name, request.timeoutMs ?? this.defaultTimeoutMs);
      throw new ModelUnavailableError(this.name, `failed to reach Ollama at ${this.endpoint}: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async callOllama(prompt: string, systemPrompt: string | undefined, timeoutMs: number | undefined, json: boolean): Promise<string> {
    const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    let res: Response;
    try {
      res = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.modelId,
          prompt,
          system: systemPrompt,
          stream: false,
          format: json ? 'json' : undefined,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) throw new ModelTimeoutError(this.name, effectiveTimeout);
      throw new ModelUnavailableError(this.name, `failed to reach Ollama at ${this.endpoint}: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 404) {
      throw new ModelUnavailableError(this.name, `model "${this.modelId}" is not pulled in Ollama (run: ollama pull ${this.modelId})`);
    }
    if (!res.ok) {
      throw new ModelUnavailableError(this.name, `Ollama returned HTTP ${res.status}`);
    }

    let data: { response?: unknown };
    try {
      data = (await res.json()) as { response?: unknown };
    } catch {
      throw new MalformedOutputError(this.name, 'Ollama response envelope was not valid JSON');
    }
    if (typeof data.response !== 'string') {
      throw new MalformedOutputError(this.name, 'Ollama response envelope is missing a "response" field');
    }
    return data.response;
  }
}
