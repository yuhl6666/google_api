/**
 * Core vocabulary shared by every task that flows through the LLM Router.
 *
 * Kept intentionally small (string unions, not open-ended strings) so the
 * rule-based router in `router/llmRouter.ts` can pattern-match on these
 * values instead of parsing free text.
 */

export type TaskType =
  | 'classify'
  | 'extract'
  | 'normalize'
  | 'generate'
  | 'reason'
  | 'embed';

export type Domain =
  | 'general'
  | 'ses'
  | 'insurance'
  | 'succession'
  | 'gym';

export type Complexity = 'low' | 'medium' | 'high';

/** How fast the caller needs a result. 'low' = needs to be fast (low tolerance for latency). */
export type LatencyRequirement = 'low' | 'medium' | 'high';

export type AccuracyRequirement = 'low' | 'medium' | 'high';

/**
 * How sensitive the input data is. 'high' means the input must never leave
 * the local environment (PII, contract terms, SES案件情報, スキルシート, 保険情報, etc.)
 * — the Router treats this as a hard constraint, not a preference.
 */
export type PrivacyLevel = 'low' | 'medium' | 'high';

export interface TaskMetadata {
  taskType: TaskType;
  domain: Domain;
  complexity: Complexity;
  latencyRequirement: LatencyRequirement;
  accuracyRequirement: AccuracyRequirement;
  privacyLevel: PrivacyLevel;
  /** Rough size of the input (characters). Used later for cost/latency estimates. */
  expectedInputSize: number;
}

export const DEFAULT_TASK_METADATA: Omit<TaskMetadata, 'taskType' | 'domain' | 'expectedInputSize'> = {
  complexity: 'low',
  latencyRequirement: 'medium',
  accuracyRequirement: 'medium',
  privacyLevel: 'medium',
};
