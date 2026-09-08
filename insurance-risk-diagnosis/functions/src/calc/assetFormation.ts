import { DiagnosisInput, ScoreResult } from './types';
import {
  RETIREMENT_AGE, RETIREMENT_END_AGE, RETIREMENT_MONTHLY_COST, PUBLIC_PENSION_MONTHLY,
  ASSET_FORMATION_MAX_PREP_YEARS,
} from './params';

export function calcAssetFormationScore(input: DiagnosisInput): ScoreResult {
  const { basic, asset } = input;

  const years = RETIREMENT_END_AGE - RETIREMENT_AGE;
  const monthlyGap = RETIREMENT_MONTHLY_COST - PUBLIC_PENSION_MONTHLY;
  const neededTotal = Math.max(0, monthlyGap) * 12 * years;
  const currentAssets = asset.savings + asset.otherAssets;
  const gapRatio = neededTotal > 0
    ? Math.min(1, Math.max(0, (neededTotal - currentAssets) / neededTotal))
    : 0;
  const gapScore = gapRatio * 70;

  const yearsToRetirement = Math.max(0, RETIREMENT_AGE - basic.age);
  const urgencyScore = Math.min(30, Math.max(0, 30 * (1 - yearsToRetirement / ASSET_FORMATION_MAX_PREP_YEARS)));

  const score = Math.min(100, gapScore + urgencyScore);

  return {
    score,
    reasons: [
      `老後必要資金目安: (月${RETIREMENT_MONTHLY_COST}万円 − 公的年金${PUBLIC_PENSION_MONTHLY}万円) × 12ヶ月 × ${years}年 = ${neededTotal.toFixed(1)}万円`,
      `現有資産${currentAssets}万円との不足率 ${(gapRatio * 100).toFixed(0)}% → ${gapScore.toFixed(1)}点`,
      `退職(${RETIREMENT_AGE}歳)まで残り${yearsToRetirement}年 → 準備緊急度 ${urgencyScore.toFixed(1)}点`,
    ],
  };
}
