import {
  AccuracyRequirement,
  DEFAULT_TASK_METADATA,
  Domain,
  LatencyRequirement,
  PrivacyLevel,
  TaskMetadata,
  TaskType,
} from './taskMetadata.js';

/**
 * Wire format used by callers outside this package (the Automation Engine,
 * future Ruby/Node callers, etc.) — see spec section 8. Snake_case on
 * purpose: it is the JSON shape other services will actually send.
 */
export interface LLMTaskRequest {
  task_type: TaskType;
  domain: Domain;
  input: unknown;
  requirements?: {
    accuracy?: AccuracyRequirement;
    latency?: LatencyRequirement;
    privacy?: PrivacyLevel;
    complexity?: 'low' | 'medium' | 'high';
  };
}

/** Internal, normalized representation used by the Router and everything downstream. */
export interface LLMTask {
  input: unknown;
  metadata: TaskMetadata;
}

function estimateInputSize(input: unknown): number {
  if (typeof input === 'string') return input.length;
  try {
    return JSON.stringify(input ?? '').length;
  } catch {
    return 0;
  }
}

/** Normalizes the external wire format into the internal LLMTask shape. */
export function parseLLMTaskRequest(request: LLMTaskRequest): LLMTask {
  const requirements = request.requirements ?? {};
  const metadata: TaskMetadata = {
    taskType: request.task_type,
    domain: request.domain,
    complexity: requirements.complexity ?? DEFAULT_TASK_METADATA.complexity,
    latencyRequirement: requirements.latency ?? DEFAULT_TASK_METADATA.latencyRequirement,
    accuracyRequirement: requirements.accuracy ?? DEFAULT_TASK_METADATA.accuracyRequirement,
    privacyLevel: requirements.privacy ?? DEFAULT_TASK_METADATA.privacyLevel,
    expectedInputSize: estimateInputSize(request.input),
  };
  return { input: request.input, metadata };
}
