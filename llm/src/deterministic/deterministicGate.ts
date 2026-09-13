import { ClassifyResult } from '../schemas/results.js';

export interface DeterministicOutcome {
  handled: boolean;
  result?: ClassifyResult;
  reason: string;
}

/**
 * Consulted by the Router before any model (local or API) is called — spec
 * section 3: "LLMでできる、からといってLLMを使わない". This is intentionally
 * tiny for Phase 1: the one case that is unambiguously deterministic for
 * *any* classify task is "there is nothing to classify". Domain-specific
 * deterministic shortcuts (e.g. a sender-domain allowlist for SES mail)
 * belong next to that domain's model, not here — see
 * `models/ses/sesClassifier.ts` for where that would plug in.
 */
export function tryDeterministicClassify(input: string): DeterministicOutcome {
  if (!input || input.trim().length === 0) {
    return {
      handled: true,
      result: { category: 'other', confidence: 1, reason: 'empty input — handled deterministically, no model call made' },
      reason: 'deterministic: empty input',
    };
  }
  return { handled: false, reason: 'no deterministic rule matched' };
}
