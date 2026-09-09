import { ClassifyResult, EmbedResult, GenerateResult, ProviderKind } from '../schemas/results.js';

export interface GenerateRequest {
  systemPrompt?: string;
  input: string;
  timeoutMs?: number;
}

export interface ClassifyRequest {
  systemPrompt?: string;
  input: string;
  /** Restrict the model to one of these categories, when known ahead of time. */
  labels?: string[];
  timeoutMs?: number;
}

export interface EmbedRequest {
  input: string;
  timeoutMs?: number;
}

/**
 * Common contract for every model Light One can call, whether it runs
 * locally or behind a third-party API. The Router only ever talks to this
 * interface — it never imports a specific SDK — so swapping
 * "Local -> Gemini" or "GPT -> Claude" is a Router/Registry change, not an
 * application change (spec section 9).
 */
export interface LLMProvider {
  readonly name: string;
  readonly providerKind: ProviderKind;

  generate(request: GenerateRequest): Promise<GenerateResult>;
  classify(request: ClassifyRequest): Promise<ClassifyResult>;
  /** Optional: not every provider/model supports embeddings. */
  embed?(request: EmbedRequest): Promise<EmbedResult>;
}
