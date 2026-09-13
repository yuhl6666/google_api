import { computeRegionScore } from './regions';
import { round } from './phase1';
import { Phase3ScoreBreakdown, SuccessionTimeframe } from '../types';

/**
 * Phase 3 (承継検討) weights: by this stage skill/workload fit has already
 * been proven out over phases 1-2, so the decisive factors become how
 * serious the talent is about actually taking over the business and
 * whether they can financially back it, with timing/region as secondary
 * gating factors.
 */
export const PHASE3_WEIGHTS = {
  successionSeriousness: 0.4,
  fundingFit: 0.25,
  timingFit: 0.2,
  regionFit: 0.15,
} as const;

/** Funding capacity (万円) considered "fully sufficient" for a typical small-business handover. */
const FUNDING_SUFFICIENCY_CAP = 1000;

const TIMEFRAME_URGENCY: Record<SuccessionTimeframe, number> = {
  immediate: 1,
  '1-3y': 0.75,
  '3-5y': 0.5,
  '5y+': 0.25,
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Talent's own stated interest in eventually succeeding a business, 1-5 -> 0-1. */
export function computeSuccessionSeriousness(successionInterestLevel: 1 | 2 | 3 | 4 | 5): number {
  return clamp01((successionInterestLevel - 1) / 4);
}

/** Diminishing-returns fit between the talent's funding capacity and a typical handover cost. */
export function computeFundingFit(fundingCapacity: number): number {
  return clamp01(fundingCapacity / FUNDING_SUFFICIENCY_CAP);
}

/** How close the company wants to hand over the business (urgency). */
export function computeTimingFit(successionTimeframe: SuccessionTimeframe): number {
  return TIMEFRAME_URGENCY[successionTimeframe];
}

export interface Phase3Input {
  successionInterestLevel: 1 | 2 | 3 | 4 | 5;
  fundingCapacity: number;
  successionTimeframe: SuccessionTimeframe;
  talentPrefecture: string;
  companyPrefecture: string;
  relocatable: boolean;
}

export function scorePhase3(input: Phase3Input): Phase3ScoreBreakdown {
  const successionSeriousness = computeSuccessionSeriousness(input.successionInterestLevel);
  const fundingFit = computeFundingFit(input.fundingCapacity);
  const timingFit = computeTimingFit(input.successionTimeframe);
  // Taking over a local business is inherently an on-site commitment, so we
  // evaluate region fit as if working style were "onsite" regardless of how
  // the phase-1 side job was conducted.
  const regionFit = computeRegionScore({
    talentPrefecture: input.talentPrefecture,
    companyPrefecture: input.companyPrefecture,
    relocatable: input.relocatable,
    workStyle: 'onsite',
  });

  const total =
    successionSeriousness * PHASE3_WEIGHTS.successionSeriousness +
    fundingFit * PHASE3_WEIGHTS.fundingFit +
    timingFit * PHASE3_WEIGHTS.timingFit +
    regionFit * PHASE3_WEIGHTS.regionFit;

  return {
    successionSeriousness: round(successionSeriousness),
    fundingFit: round(fundingFit),
    timingFit: round(timingFit),
    regionFit: round(regionFit),
    total: round(total),
  };
}
