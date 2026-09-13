import { describe, expect, it } from 'vitest';
import { SES_BENCHMARK_DATASET } from '../models/ses/benchmark/dataset.js';
import { SES_CATEGORIES } from '../models/ses/sesEmail.js';

describe('SES_BENCHMARK_DATASET', () => {
  it('has at least 50 examples', () => {
    expect(SES_BENCHMARK_DATASET.length).toBeGreaterThanOrEqual(50);
  });

  it('has at least 10 examples per category', () => {
    for (const category of SES_CATEGORIES) {
      const count = SES_BENCHMARK_DATASET.filter((e) => e.expectedCategory === category).length;
      expect(count, `category "${category}"`).toBeGreaterThanOrEqual(10);
    }
  });

  it('has unique ids', () => {
    const ids = SES_BENCHMARK_DATASET.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every example has a non-empty body', () => {
    for (const example of SES_BENCHMARK_DATASET) {
      expect(example.email.body.trim().length, example.id).toBeGreaterThan(0);
    }
  });
});
