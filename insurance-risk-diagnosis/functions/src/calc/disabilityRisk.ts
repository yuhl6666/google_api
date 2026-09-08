import { DiagnosisInput, ScoreResult } from './types';
import { LIVING_COST_RATIO, DISABILITY_OCCUPATION_SCORE, DISABILITY_AGE_SCORE_TABLE, ageBand } from './params';

function bufferScoreFromMonths(months: number): number {
  if (months < 3) return 40;
  if (months < 6) return 30;
  if (months < 12) return 15;
  return 5;
}

export function calcDisabilityRiskScore(input: DiagnosisInput): ScoreResult {
  const { basic, asset } = input;
  const band = ageBand(basic.age);
  const occupationScore = DISABILITY_OCCUPATION_SCORE[basic.occupationRisk];
  const ageScore = DISABILITY_AGE_SCORE_TABLE[band];

  const monthlyLivingCost = (basic.annualIncome * LIVING_COST_RATIO) / 12;
  const bufferMonths = monthlyLivingCost > 0 ? asset.savings / monthlyLivingCost : 99;
  const bufferScore = bufferScoreFromMonths(bufferMonths);

  const score = Math.min(100, occupationScore + ageScore + bufferScore);

  return {
    score,
    reasons: [
      `職業危険度(${basic.occupationRisk})による加点: ${occupationScore}点`,
      `年齢区分(${band})による加点: ${ageScore}点`,
      `生活防衛資金 約${bufferMonths.toFixed(1)}ヶ月分(貯蓄${asset.savings}万円 ÷ 月間生活費${monthlyLivingCost.toFixed(1)}万円) → ${bufferScore}点`,
    ],
  };
}
