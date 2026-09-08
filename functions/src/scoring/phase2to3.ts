import { Phase2To3ScoreBreakdown } from '../types';
import { round } from './phase1';

export interface Phase2To3Input {
  /** Days elapsed since the match entered phase 1 (or phase 2, whichever the caller wants to measure). */
  engagementDurationDays: number;
  messageCount: number;
  /** Average of the two 1-5 mutual reviews, if both have been given. */
  talentRating?: number;
  companyRating?: number;
  /** Phase 1 total score (0-1), carried over so a weak initial fit still counts against promotion. */
  phase1Total: number;
}

/**
 * Phase 2→3 promotion weights: engagement depth (time + message volume) and
 * mutual satisfaction (reviews) now matter more than the original skill/
 * workload fit, which is why phase1Total is carried forward at a reduced
 * weight rather than dominating the decision.
 */
export const PHASE2TO3_WEIGHTS = {
  engagementDuration: 0.3,
  messageVolume: 0.25,
  review: 0.25,
  phase1Carryover: 0.2,
} as const;

export const PHASE2TO3_PROMOTION_THRESHOLD = 0.7;

/** Engagement is considered "mature" at 90 days of active relationship. */
const ENGAGEMENT_MATURITY_DAYS = 90;
/** Message volume is considered "rich" at 40 exchanged messages. */
const MESSAGE_VOLUME_MATURITY = 40;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function computeEngagementDurationScore(days: number): number {
  return clamp01(days / ENGAGEMENT_MATURITY_DAYS);
}

export function computeMessageVolumeScore(messageCount: number): number {
  return clamp01(messageCount / MESSAGE_VOLUME_MATURITY);
}

export function computeReviewScore(talentRating?: number, companyRating?: number): number {
  const ratings = [talentRating, companyRating].filter((r): r is number => typeof r === 'number');
  if (ratings.length === 0) return 0;
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return clamp01((avg - 1) / 4); // maps 1..5 -> 0..1
}

export function scorePhase2To3(input: Phase2To3Input): Phase2To3ScoreBreakdown {
  const engagementDurationScore = computeEngagementDurationScore(input.engagementDurationDays);
  const messageVolumeScore = computeMessageVolumeScore(input.messageCount);
  const reviewScore = computeReviewScore(input.talentRating, input.companyRating);
  const phase1Carryover = clamp01(input.phase1Total);

  const total =
    engagementDurationScore * PHASE2TO3_WEIGHTS.engagementDuration +
    messageVolumeScore * PHASE2TO3_WEIGHTS.messageVolume +
    reviewScore * PHASE2TO3_WEIGHTS.review +
    phase1Carryover * PHASE2TO3_WEIGHTS.phase1Carryover;

  return {
    engagementDurationScore: round(engagementDurationScore),
    messageVolumeScore: round(messageVolumeScore),
    reviewScore: round(reviewScore),
    phase1Carryover: round(phase1Carryover),
    total: round(total),
    eligibleForPhase3: total >= PHASE2TO3_PROMOTION_THRESHOLD,
  };
}
