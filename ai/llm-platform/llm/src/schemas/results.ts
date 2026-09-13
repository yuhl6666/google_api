/** Result of a `classify` task. `confidence` is the model's own self-reported
 * score — never treat it as a calibrated probability; the Evaluator is what
 * decides whether the result can be trusted as-is. */
export interface ClassifyResult {
  category: string;
  confidence: number;
  reason?: string;
}

export interface GenerateResult {
  text: string;
}

export interface EmbedResult {
  vector: number[];
}

export type ProviderKind = 'local' | 'claude' | 'openai' | 'gemini' | 'deterministic';

/** What actually produced a result, plus enough detail to debug routing decisions. */
export interface ExecutionTrace {
  providerKind: ProviderKind;
  modelId: string;
  routedReason: string;
  durationMs: number;
}

export interface EvaluatedResult<T> {
  output: T;
  trace: ExecutionTrace;
  /** true when the Evaluator judges the output trustworthy enough to use as-is. */
  verified: boolean;
  needsHumanReview: boolean;
  notes: string[];
}
