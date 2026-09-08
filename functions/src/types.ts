/**
 * Types shared by the scoring engine (functions/src/scoring/).
 *
 * This whole `functions/` package is a dormant reference copy of the
 * scoring algorithm — the platform actually runs it client-side, in
 * frontend/src/calc/scoring (same code, same tests), writing results
 * directly to Supabase. See the root README for why (Cloud Functions
 * require Firebase's Blaze billing plan). Kept here, still built and
 * tested, in case a future move to a real backend wants it.
 */

export type SuccessionTimeframe = 'immediate' | '1-3y' | '3-5y' | '5y+';

/** 8-block regional grouping used for the region-proximity table. */
export type RegionBlock =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kinki'
  | 'chugoku'
  | 'shikoku'
  | 'kyushu_okinawa';

export interface Phase1ScoreBreakdown {
  skillFit: number;
  workloadFit: number;
  industryFit: number;
  regionFit: number;
  total: number;
}

export interface Phase2To3ScoreBreakdown {
  engagementDurationScore: number;
  messageVolumeScore: number;
  reviewScore: number;
  phase1Carryover: number;
  total: number;
  eligibleForPhase3: boolean;
}

export interface Phase3ScoreBreakdown {
  successionSeriousness: number;
  fundingFit: number;
  timingFit: number;
  regionFit: number;
  total: number;
}

export interface ScoreBreakdown {
  phase1: Phase1ScoreBreakdown;
  phase2to3?: Phase2To3ScoreBreakdown;
  phase3?: Phase3ScoreBreakdown;
  currentTotal: number;
}
