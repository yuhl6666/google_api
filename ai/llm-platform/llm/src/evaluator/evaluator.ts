import { ClassifyResult, EvaluatedResult } from '../schemas/results.js';

export interface EvaluatorOptions {
  /** Below this, a result is flagged for human review instead of trusted as-is. Default 0.6. */
  confidenceThreshold?: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Post-hoc check on model output (spec section 6/12): a model's
 * self-reported `confidence` is never treated as a calibrated probability.
 * This is deliberately domain-agnostic — it doesn't know what "project" or
 * "engineer" mean — so the same Evaluator works for SES, insurance,
 * succession, or any future domain's classify task.
 */
export class Evaluator {
  static evaluateClassification(
    result: ClassifyResult,
    options: EvaluatorOptions = {},
  ): Omit<EvaluatedResult<ClassifyResult>, 'trace'> {
    const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    const notes: string[] = [];

    let confidence = result.confidence;
    if (!Number.isFinite(confidence)) {
      notes.push('model confidence was not a finite number; treated as 0');
      confidence = 0;
    } else if (confidence < 0 || confidence > 1) {
      notes.push(`model confidence ${result.confidence} was outside [0, 1]; clamped`);
      confidence = Math.min(1, Math.max(0, confidence));
    }

    const category = result.category.trim();
    if (category.length === 0) {
      notes.push('model returned an empty category');
    }

    const needsHumanReview = confidence < threshold || category.length === 0;
    if (confidence < threshold) {
      notes.push(`confidence ${confidence.toFixed(2)} is below the ${threshold} trust threshold -> flagged for human review`);
    }

    const output: ClassifyResult = { ...result, category, confidence };
    return {
      output,
      verified: !needsHumanReview,
      needsHumanReview,
      notes,
    };
  }
}
