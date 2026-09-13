export type JapaneseLevel = 'none' | 'N4' | 'N3' | 'N2' | 'N1' | 'business' | 'native';

export const JAPANESE_LEVEL_LABELS: Record<JapaneseLevel, string> = {
  none: '不問',
  N4: 'N4',
  N3: 'N3',
  N2: 'N2',
  N1: 'N1',
  business: 'ビジネスレベル',
  native: 'ネイティブレベル',
};

export interface RequiredSkill {
  name: string;
  minYears: number;
  required: boolean;
}

export interface EngineerSkill {
  name: string;
  years: number;
}

export interface Project {
  id: string;
  name: string;
  requiredSkills: RequiredSkill[];
  rateMin: number;
  rateMax: number;
  location: string;
  remoteAllowed: boolean;
  startDate: string;
  durationMonths: number | null;
  commercialTier: number | null;
  japaneseLevel: JapaneseLevel;
  sourceEmailBody: string;
}

export interface Engineer {
  id: string;
  name: string;
  skills: EngineerSkill[];
  desiredRateMin: number;
  desiredRateMax: number;
  desiredLocations: string[];
  remoteDesired: boolean;
  availableFrom: string;
  japaneseLevel: JapaneseLevel;
  sourceSkillSheetBody: string;
}

export type MatchStatus = '未対応' | '提案済' | '成約' | '却下';

export interface ScoreWeights {
  skillWeight: number;
  rateWeight: number;
  locationWeight: number;
  timingWeight: number;
}

export interface ScoreBreakdown {
  skillScore: number;
  rateScore: number;
  locationScore: number;
  timingScore: number;
  weightsUsed: ScoreWeights;
}

export interface MatchResult {
  id: string;
  projectId: string;
  engineerId: string;
  projectName: string;
  engineerName: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  status: MatchStatus;
}

export interface FeedbackLog {
  id: string;
  matchId: string;
  projectId: string;
  engineerId: string;
  decision: '採用' | '却下';
  reasonNote: string;
}
