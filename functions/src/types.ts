/**
 * Shared domain types for the side-job-to-succession matching platform.
 * Mirrors the Firestore collections: talents, companies, matches, messages, phaseHistory.
 */

export type WorkStyle = 'remote' | 'onsite' | 'both';

export type SuccessionTimeframe = 'immediate' | '1-3y' | '3-5y' | '5y+';

export type FinancialHealth = 'good' | 'average' | 'needs_improvement';

export type MatchPhase = 1 | 2 | 3;

export type MatchStatus = 'active' | 'declined' | 'completed';

export type SenderRole = 'talent' | 'company';

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

export interface Talent {
  id: string;
  uid: string;
  name: string;
  /** Free-form skill/experience tags, e.g. ["経理", "EC運営", "Webマーケ"]. */
  skills: string[];
  /** Industries the talent is interested in, e.g. ["製造業", "農業"]. */
  interestedIndustries: string[];
  weeklyAvailableHours: number;
  workStyle: WorkStyle;
  relocatable: boolean;
  prefecture: string;
  /** 1 (low) - 5 (high) interest in eventually taking over a business. */
  successionInterestLevel: 1 | 2 | 3 | 4 | 5;
  /** Rough available funding capacity, in units of 10k JPY (万円). */
  fundingCapacity: number;
  bio?: string;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

export interface Company {
  id: string;
  uid: string;
  name: string;
  industry: string;
  prefecture: string;
  overview: string;
  financialHealth: FinancialHealth;
  /** Tags describing the desired candidate persona, e.g. ["経理経験", "EC運営"]. */
  wantedPersonaTags: string[];
  /** Optional per-tag importance weight (default 1 when absent). Higher = more important. */
  wantedPersonaTagWeights?: Record<string, number>;
  sideJobAcceptable: boolean;
  requiredWeeklyHours: { min: number; max: number };
  successionTimeframe: SuccessionTimeframe;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

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

export interface MatchReviews {
  talentRating?: 1 | 2 | 3 | 4 | 5;
  talentComment?: string;
  companyRating?: 1 | 2 | 3 | 4 | 5;
  companyComment?: string;
}

export interface Match {
  id: string;
  talentId: string;
  companyId: string;
  phase: MatchPhase;
  status: MatchStatus;
  scoreBreakdown: ScoreBreakdown;
  reviews: MatchReviews;
  messageCount: number;
  /** Per-side "I want to continue" flag, gating promotion from phase 1 to phase 2. */
  continuationIntent?: { talent?: boolean; company?: boolean };
  firstMessageAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  lastMessageAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  phaseEnteredAt: Partial<Record<MatchPhase, FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue>>;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  senderRole: SenderRole;
  body: string;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

export interface PhaseHistoryEntry {
  id: string;
  matchId: string;
  fromPhase: MatchPhase | null;
  toPhase: MatchPhase | MatchStatus;
  reason: string;
  changedBy: string;
  scoreAtChange: number;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}
