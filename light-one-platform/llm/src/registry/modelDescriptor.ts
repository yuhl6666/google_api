import { Domain, TaskType } from '../schemas/taskMetadata.js';
import { PrivacyLevel } from '../schemas/taskMetadata.js';
import { ProviderKind } from '../schemas/results.js';

export type ModelStatus = 'active' | 'planned';

export type CapabilityTag =
  | 'classification'
  | 'extraction'
  | 'normalization'
  | 'generation'
  | 'reasoning'
  | 'embedding';

export type CostClass = 'local' | 'low' | 'medium' | 'high';
export type LatencyClass = 'low' | 'medium' | 'high';

export interface OllamaRuntimeConfig {
  kind: 'ollama';
  model: string;
  endpoint?: string;
}

export interface ApiRuntimeConfig {
  kind: 'claude' | 'openai' | 'gemini';
  model: string;
}

export type RuntimeConfig = OllamaRuntimeConfig | ApiRuntimeConfig;

/**
 * One row of the Model Registry (spec section 5). Never hardcoded in
 * application code — loaded from `models.json` (or any other descriptor
 * source) so adding a model is a data change, not a code change.
 */
export interface ModelDescriptor {
  id: string;
  provider: ProviderKind;
  domain: Domain;
  capabilities: CapabilityTag[];
  costClass: CostClass;
  latencyClass: LatencyClass;
  /** Highest privacy level this model is trusted to receive: 'high' for
   * anything local (data never leaves the machine), 'low' for API
   * providers (data leaves to a third party). */
  privacyClass: PrivacyLevel;
  runtime: RuntimeConfig;
  /** 'planned' means the descriptor exists (so the Router/Registry already
   * know about it) but no provider is wired up yet — see spec section 6:
   * we are not building every domain model in Phase 1, only ses-classifier. */
  status: ModelStatus;
}

const CAPABILITY_BY_TASK_TYPE: Record<TaskType, CapabilityTag> = {
  classify: 'classification',
  extract: 'extraction',
  normalize: 'normalization',
  generate: 'generation',
  reason: 'reasoning',
  embed: 'embedding',
};

export function capabilityForTaskType(taskType: TaskType): CapabilityTag {
  return CAPABILITY_BY_TASK_TYPE[taskType];
}

const PRIVACY_ORDER: Record<PrivacyLevel, number> = { low: 0, medium: 1, high: 2 };

/** True when a model trusted up to `modelPrivacyClass` may handle data classified as `taskPrivacyLevel`. */
export function privacySatisfies(modelPrivacyClass: PrivacyLevel, taskPrivacyLevel: PrivacyLevel): boolean {
  return PRIVACY_ORDER[modelPrivacyClass] >= PRIVACY_ORDER[taskPrivacyLevel];
}
