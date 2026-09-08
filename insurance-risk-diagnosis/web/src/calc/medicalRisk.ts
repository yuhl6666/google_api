import type { DiagnosisInput, ScoreResult } from '../types/diagnosis';
import { MEDICAL_AGE_SCORE_TABLE, MEDICAL_OCCUPATION_SCORE, MEDICAL_HISTORY_SCORE, ageBand } from './params';

export function calcMedicalRiskScore(input: DiagnosisInput): ScoreResult {
  const { basic, health } = input;
  const band = ageBand(basic.age);
  const ageScore = MEDICAL_AGE_SCORE_TABLE[band];
  const occupationScore = MEDICAL_OCCUPATION_SCORE[basic.occupationRisk];
  const historyScore = health.hasMedicalHistory ? MEDICAL_HISTORY_SCORE : 0;

  const score = Math.min(100, ageScore + occupationScore + historyScore);

  return {
    score,
    reasons: [
      `年齢区分(${band})による加点: ${ageScore}点`,
      `職業危険度(${basic.occupationRisk})による加点: ${occupationScore}点`,
      `既往歴: ${health.hasMedicalHistory ? 'あり' : 'なし'} → ${historyScore}点`,
    ],
  };
}
