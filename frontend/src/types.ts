/**
 * Frontend-side mirror of the Firestore domain types (functions/src/types.ts).
 * Kept as plain data types (Firestore Timestamps arrive as {seconds,nanoseconds}
 * objects from the client SDK, exposed here as `unknown` and converted at the
 * display layer via toDateLabel()).
 */

export type WorkStyle = 'remote' | 'onsite' | 'both';
export type SuccessionTimeframe = 'immediate' | '1-3y' | '3-5y' | '5y+';
export type FinancialHealth = 'good' | 'average' | 'needs_improvement';
export type MatchPhase = 1 | 2 | 3;
export type MatchStatus = 'active' | 'declined' | 'completed';
export type SenderRole = 'talent' | 'company';
export type Role = 'talent' | 'company';

export interface Talent {
  id: string;
  uid: string;
  name: string;
  skills: string[];
  interestedIndustries: string[];
  weeklyAvailableHours: number;
  workStyle: WorkStyle;
  relocatable: boolean;
  prefecture: string;
  successionInterestLevel: 1 | 2 | 3 | 4 | 5;
  fundingCapacity: number;
  bio?: string;
}

export interface Company {
  id: string;
  uid: string;
  name: string;
  industry: string;
  prefecture: string;
  overview: string;
  financialHealth: FinancialHealth;
  wantedPersonaTags: string[];
  wantedPersonaTagWeights?: Record<string, number>;
  sideJobAcceptable: boolean;
  requiredWeeklyHours: { min: number; max: number };
  successionTimeframe: SuccessionTimeframe;
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
  continuationIntent?: { talent?: boolean; company?: boolean };
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  senderRole: SenderRole;
  body: string;
  createdAt: unknown;
}

export interface PhaseHistoryEntry {
  id: string;
  matchId: string;
  fromPhase: MatchPhase | null;
  toPhase: MatchPhase | MatchStatus;
  reason: string;
  changedBy: string;
  scoreAtChange: number;
  createdAt: unknown;
}
