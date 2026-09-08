import type { DiagnosisInput, DeathCoverageResult } from '../types/diagnosis';
import { calcSurvivorLivingCost } from './livingCost';
import { calcRemainingEducationCost } from './education';
import { calcSurvivorPensionTotal } from './pension';
import { FUNERAL_AND_MISC_COST } from './params';

export function calcRequiredDeathCoverage(input: DiagnosisInput): DeathCoverageResult {
  const { basic, asset, existingInsurance } = input;

  const living = calcSurvivorLivingCost(basic);
  const education = calcRemainingEducationCost(basic.children, basic.educationCourse);
  const pension = calcSurvivorPensionTotal(basic);
  const mortgageAddOn = asset.hasMortgageLifeInsurance ? 0 : asset.mortgageBalance;

  const reasons: string[] = [
    ...living.reasons,
    ...education.reasons,
    `葬儀費用等の一時費用: ${FUNERAL_AND_MISC_COST}万円`,
  ];
  if (mortgageAddOn > 0) {
    reasons.push(`団体信用生命保険未加入のため住宅ローン残高${mortgageAddOn}万円を上乗せ`);
  }
  reasons.push(...pension.reasons);
  reasons.push(`控除: 貯蓄${asset.savings}万円 + 保有資産${asset.otherAssets}万円 + 既存死亡保険金${existingInsurance.deathCoverage}万円`);

  const grossNeed = living.phaseA + living.phaseB + education.total + FUNERAL_AND_MISC_COST + mortgageAddOn;
  const deductions = pension.total + asset.savings + asset.otherAssets + existingInsurance.deathCoverage;
  const rawNeeded = grossNeed - deductions;
  const requiredAmount = Math.max(0, rawNeeded);

  // grossNeedに対して実際に不足している割合をリスクスコアとする(既存資産・保険で足りているほど低スコア)
  const riskScore = grossNeed > 0 ? Math.min(100, Math.max(0, (requiredAmount / grossNeed) * 100)) : 0;

  return {
    requiredAmount,
    grossNeed,
    riskScore,
    breakdown: {
      phaseALivingCost: living.phaseA,
      phaseAYears: living.phaseAYears,
      phaseBLivingCost: living.phaseB,
      phaseBYears: living.phaseBYears,
      educationTotal: education.total,
      educationBreakdown: education.breakdown,
      funeralCost: FUNERAL_AND_MISC_COST,
      mortgageAddOn,
      survivorPensionTotal: pension.total,
      savings: asset.savings,
      otherAssets: asset.otherAssets,
      existingDeathCoverage: existingInsurance.deathCoverage,
    },
    reasons,
  };
}
