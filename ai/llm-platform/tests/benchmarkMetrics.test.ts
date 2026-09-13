import { describe, expect, it } from 'vitest';
import { BenchmarkOutcome, computeBenchmarkReport, ERROR_BUCKET, suggestConclusion } from '../models/ses/benchmark/metrics.js';
import { SES_CATEGORIES } from '../models/ses/sesEmail.js';

// These outcomes are hand-constructed numbers, not real model predictions —
// this file only proves the scoring math is correct, independent of
// whether any model is available.
function outcome(overrides: Partial<BenchmarkOutcome> & Pick<BenchmarkOutcome, 'exampleId' | 'expectedCategory'>): BenchmarkOutcome {
  return { predictedCategory: overrides.expectedCategory, latencyMs: 100, invalidJson: false, ...overrides };
}

describe('computeBenchmarkReport', () => {
  it('computes 100% accuracy when every prediction matches', () => {
    const outcomes: BenchmarkOutcome[] = [
      outcome({ exampleId: '1', expectedCategory: 'project' }),
      outcome({ exampleId: '2', expectedCategory: 'engineer' }),
    ];
    const report = computeBenchmarkReport(outcomes, SES_CATEGORIES);
    expect(report.accuracy).toBe(1);
    expect(report.failureCases).toHaveLength(0);
  });

  it('computes precision/recall/F1 correctly for a known confusion pattern', () => {
    // project: 3 examples, 2 correctly predicted 'project', 1 predicted 'sales' (false negative for project, false positive for sales)
    // sales: 1 example, correctly predicted 'sales'
    const outcomes: BenchmarkOutcome[] = [
      outcome({ exampleId: 'p1', expectedCategory: 'project', predictedCategory: 'project' }),
      outcome({ exampleId: 'p2', expectedCategory: 'project', predictedCategory: 'project' }),
      outcome({ exampleId: 'p3', expectedCategory: 'project', predictedCategory: 'sales' }),
      outcome({ exampleId: 's1', expectedCategory: 'sales', predictedCategory: 'sales' }),
    ];
    const report = computeBenchmarkReport(outcomes, SES_CATEGORIES);

    // project: TP=2, FP=0, FN=1 -> precision=1, recall=2/3, f1=2*1*(2/3)/(1+2/3)=0.8
    expect(report.perCategory.project.precision).toBe(1);
    expect(report.perCategory.project.recall).toBeCloseTo(2 / 3, 5);
    expect(report.perCategory.project.f1).toBeCloseTo(0.8, 5);

    // sales: TP=1, FP=1 (the misclassified project), FN=0 -> precision=1/2, recall=1
    expect(report.perCategory.sales.precision).toBeCloseTo(0.5, 5);
    expect(report.perCategory.sales.recall).toBe(1);

    expect(report.confusionMatrix.project.sales).toBe(1);
    expect(report.confusionMatrix.project.project).toBe(2);
    expect(report.accuracy).toBe(3 / 4);
    expect(report.failureCases).toHaveLength(1);
    expect(report.failureCases[0].exampleId).toBe('p3');
  });

  it('buckets a failed/errored call under the error bucket instead of guessing a category', () => {
    const outcomes: BenchmarkOutcome[] = [
      outcome({ exampleId: 'e1', expectedCategory: 'other', predictedCategory: null, errorMessage: 'timeout' }),
    ];
    const report = computeBenchmarkReport(outcomes, SES_CATEGORIES);
    expect(report.confusionMatrix.other[ERROR_BUCKET]).toBe(1);
    expect(report.accuracy).toBe(0);
    expect(report.perCategory.other.recall).toBe(0);
  });

  it('computes invalid JSON rate and latency percentiles', () => {
    const outcomes: BenchmarkOutcome[] = [10, 20, 30, 40, 100].map((latencyMs, i) =>
      outcome({ exampleId: `l${i}`, expectedCategory: 'other', latencyMs, invalidJson: i === 0 }),
    );
    const report = computeBenchmarkReport(outcomes, SES_CATEGORIES);
    expect(report.invalidJsonRate).toBe(1 / 5);
    expect(report.averageLatencyMs).toBeCloseTo((10 + 20 + 30 + 40 + 100) / 5, 5);
    expect(report.p50LatencyMs).toBe(30);
    // nearest-rank at index floor(0.95 * (n-1)) for n=5 lands on index 3, not the max
    expect(report.p95LatencyMs).toBe(40);
  });
});

describe('suggestConclusion', () => {
  it('declares the local model sufficient when accuracy/invalidJson/recall all clear the bar', () => {
    const outcomes: BenchmarkOutcome[] = Array.from({ length: 40 }, (_, i) =>
      outcome({ exampleId: `ok${i}`, expectedCategory: SES_CATEGORIES[i % 4] }),
    );
    const report = computeBenchmarkReport(outcomes, SES_CATEGORIES);
    expect(suggestConclusion(report)).toMatch(/sufficient/);
  });

  it('flags a fallback suggestion naming the weak category when recall is poor', () => {
    const outcomes: BenchmarkOutcome[] = [
      ...Array.from({ length: 10 }, (_, i) => outcome({ exampleId: `proj${i}`, expectedCategory: 'project' })),
      // engineer: only 2/10 correct -> low recall
      ...Array.from({ length: 2 }, (_, i) => outcome({ exampleId: `eng-ok${i}`, expectedCategory: 'engineer' })),
      ...Array.from({ length: 8 }, (_, i) =>
        outcome({ exampleId: `eng-bad${i}`, expectedCategory: 'engineer', predictedCategory: 'sales' }),
      ),
    ];
    const report = computeBenchmarkReport(outcomes, SES_CATEGORIES);
    const conclusion = suggestConclusion(report);
    expect(conclusion).toMatch(/not yet sufficient/);
    expect(conclusion).toMatch(/engineer/);
  });
});
