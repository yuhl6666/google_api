import type { Timestamp } from 'firebase-admin/firestore';
import { EngineerInput, JapaneseLevel, ProjectInput, RequiredSkill, EngineerSkill, ScoreWeights } from './scoring/types';

export interface ProjectDoc extends ProjectInput {
  id: string;
  name: string;
  durationMonths: number | null;
  commercialTier: number | null; // 何次請けか
  sourceEmailBody: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EngineerDoc extends EngineerInput {
  id: string;
  name: string;
  sourceSkillSheetBody: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MatchStatus = '未対応' | '提案済' | '成約' | '却下';

export interface MatchResultDoc {
  id: string;
  projectId: string;
  engineerId: string;
  projectName: string;
  engineerName: string;
  totalScore: number;
  scoreBreakdown: {
    skillScore: number;
    rateScore: number;
    locationScore: number;
    timingScore: number;
    weightsUsed: ScoreWeights;
  };
  status: MatchStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type FeedbackDecision = '採用' | '却下';

export interface FeedbackLogDoc {
  id: string;
  matchId: string;
  projectId: string;
  engineerId: string;
  decision: FeedbackDecision;
  reasonNote: string;
  scoreBreakdownAtFeedback: MatchResultDoc['scoreBreakdown'];
  createdAt: Timestamp;
}

export interface WeightsSettingsDoc extends ScoreWeights {
  updatedAt: Timestamp;
}

export type { RequiredSkill, EngineerSkill, JapaneseLevel };
