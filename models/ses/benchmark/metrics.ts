import { SesCategory } from '../sesEmail.js';

/** One classified (or failed) benchmark example, ready to score. */
export interface BenchmarkOutcome {
  exampleId: string;
  expectedCategory: SesCategory;
  /** null means the provider call errored out entirely (timeout/unavailable/malformed) — never fabricate a category for it. */
  predictedCategory: string | null;
  latencyMs: number;
  /** True for any MalformedOutputError — both "not valid JSON" and "valid JSON but missing fields" count. */
  invalidJson: boolean;
  errorMessage?: string;
}

export interface CategoryMetrics {
  support: number;
  correct: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface BenchmarkReport {
  totalSamples: number;
  accuracy: number;
  invalidJsonRate: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  perCategory: Record<string, CategoryMetrics>;
  /** confusionMatrix[actual][predicted] = count. A failed/errored call is bucketed under "(error)". */
  confusionMatrix: Record<string, Record<string, number>>;
  failureCases: BenchmarkOutcome[];
}

export const ERROR_BUCKET = '(error)';

function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return 0;
  const index = Math.min(sortedAscending.length - 1, Math.floor(p * (sortedAscending.length - 1)));
  return sortedAscending[index];
}

/**
 * Pure scoring function — no model calls, no I/O — so it's testable
 * without a real (or even mocked) LLM. `runBenchmark.ts` is the only
 * caller that needs a real provider; this just turns a list of
 * predictions into the metrics the benchmark report asks for.
 */
export function computeBenchmarkReport(outcomes: BenchmarkOutcome[], categories: readonly SesCategory[]): BenchmarkReport {
  const total = outcomes.length;

  const confusionMatrix: Record<string, Record<string, number>> = {};
  for (const actual of categories) {
    confusionMatrix[actual] = {};
    for (const predicted of [...categories, ERROR_BUCKET]) confusionMatrix[actual][predicted] = 0;
  }

  const truePositives: Record<string, number> = {};
  const falsePositives: Record<string, number> = {};
  const falseNegatives: Record<string, number> = {};
  for (const c of categories) {
    truePositives[c] = 0;
    falsePositives[c] = 0;
    falseNegatives[c] = 0;
  }

  let correct = 0;
  let invalidJsonCount = 0;
  const latencies: number[] = [];
  const failureCases: BenchmarkOutcome[] = [];

  for (const outcome of outcomes) {
    latencies.push(outcome.latencyMs);
    if (outcome.invalidJson) invalidJsonCount++;

    const predictedBucket = outcome.predictedCategory ?? ERROR_BUCKET;
    if (confusionMatrix[outcome.expectedCategory]) {
      confusionMatrix[outcome.expectedCategory][predictedBucket] =
        (confusionMatrix[outcome.expectedCategory][predictedBucket] ?? 0) + 1;
    }

    if (outcome.predictedCategory === outcome.expectedCategory) {
      correct++;
      truePositives[outcome.expectedCategory]++;
    } else {
      falseNegatives[outcome.expectedCategory] = (falseNegatives[outcome.expectedCategory] ?? 0) + 1;
      if (outcome.predictedCategory && falsePositives[outcome.predictedCategory] !== undefined) {
        falsePositives[outcome.predictedCategory]++;
      }
      failureCases.push(outcome);
    }
  }

  const perCategory: Record<string, CategoryMetrics> = {};
  for (const c of categories) {
    const support = outcomes.filter((o) => o.expectedCategory === c).length;
    const tp = truePositives[c];
    const fp = falsePositives[c];
    const fn = falseNegatives[c];
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    perCategory[c] = { support, correct: tp, precision, recall, f1 };
  }

  const sortedLatencies = [...latencies].sort((a, b) => a - b);

  return {
    totalSamples: total,
    accuracy: total > 0 ? correct / total : 0,
    invalidJsonRate: total > 0 ? invalidJsonCount / total : 0,
    averageLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    p50LatencyMs: percentile(sortedLatencies, 0.5),
    p95LatencyMs: percentile(sortedLatencies, 0.95),
    perCategory,
    confusionMatrix,
    failureCases,
  };
}

/**
 * Provisional pass/fail heuristic for "is Local good enough for SES
 * classification". The thresholds below are a documented starting point,
 * not a measured conclusion — this function only ever runs against real
 * numbers once a real model is benchmarked (never against fabricated
 * ones); revisit these specific numbers once that first real run exists,
 * per the instruction not to hardcode a threshold no one has checked
 * against reality yet.
 */
export function suggestConclusion(report: BenchmarkReport): string {
  const ACCURACY_THRESHOLD = 0.9;
  const INVALID_JSON_THRESHOLD = 0.05;
  const PER_CATEGORY_RECALL_THRESHOLD = 0.85;

  const weakCategories = Object.entries(report.perCategory)
    .filter(([, m]) => m.recall < PER_CATEGORY_RECALL_THRESHOLD)
    .map(([category]) => category);

  if (
    report.accuracy >= ACCURACY_THRESHOLD &&
    report.invalidJsonRate <= INVALID_JSON_THRESHOLD &&
    weakCategories.length === 0
  ) {
    return 'Local model appears sufficient for SES classification — no API fallback needed for the categories/cases in this dataset.';
  }

  const reasons: string[] = [];
  if (report.accuracy < ACCURACY_THRESHOLD) {
    reasons.push(`overall accuracy ${(report.accuracy * 100).toFixed(1)}% is below the ${ACCURACY_THRESHOLD * 100}% bar`);
  }
  if (report.invalidJsonRate > INVALID_JSON_THRESHOLD) {
    reasons.push(`invalid JSON rate ${(report.invalidJsonRate * 100).toFixed(1)}% is above the ${INVALID_JSON_THRESHOLD * 100}% bar`);
  }
  if (weakCategories.length > 0) {
    reasons.push(`recall is weak for: ${weakCategories.join(', ')}`);
  }
  return (
    `Local model is not yet sufficient on its own (${reasons.join('; ')}). ` +
    `Suggested fallback: route to an API model when the Evaluator flags needsHumanReview=true ` +
    `(low confidence or an unrecognized category) for ${weakCategories.length > 0 ? weakCategories.join('/') : 'the affected categories'}, ` +
    'rather than sending every SES email to an API by default.'
  );
}
