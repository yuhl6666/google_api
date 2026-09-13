/**
 * Example deterministic tools (spec section 3): numeric/date/threshold/
 * dedupe work that must never go through an LLM. Domain models call these
 * directly instead of asking a model to "figure out" something a few lines
 * of TypeScript already computes exactly and for free.
 */

export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

export function exceedsThreshold(value: number, threshold: number): boolean {
  return value >= threshold;
}

/** Case/whitespace-insensitive check for "is this the same message we've already seen". */
export function isDuplicateText(a: string, b: string): boolean {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalize(a) === normalize(b);
}
