import { MalformedOutputError } from '../../interfaces/errors.js';
import { ClassifyResult } from '../../schemas/results.js';

/** Shared by every provider: turn a model's raw text response into a
 * ClassifyResult, or throw a MalformedOutputError describing exactly what
 * was wrong (invalid JSON vs. missing/invalid fields). */
export function parseClassifyOutput(providerName: string, raw: string): ClassifyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MalformedOutputError(providerName, 'model output was not valid JSON', raw);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new MalformedOutputError(providerName, 'model output was not a JSON object', raw);
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.category !== 'string' || obj.category.length === 0) {
    throw new MalformedOutputError(providerName, 'model output is missing a non-empty "category" field', raw);
  }

  const confidence = typeof obj.confidence === 'number' && Number.isFinite(obj.confidence) ? obj.confidence : 0;
  const reason = typeof obj.reason === 'string' ? obj.reason : undefined;

  return { category: obj.category, confidence, reason };
}
