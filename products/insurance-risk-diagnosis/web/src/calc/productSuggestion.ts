import { SUGGESTION_THRESHOLD } from './params';

export interface SuggestionScores {
  deathCoverageRiskScore: number;
  medicalScore: number;
  disabilityScore: number;
  assetFormationScore: number;
}

// 商品「種類」のみを提案する。特定の商品名・保険会社名は一切出さない。
export function suggestProductTypes(scores: SuggestionScores): string[] {
  const suggestions: string[] = [];
  if (scores.deathCoverageRiskScore >= SUGGESTION_THRESHOLD) suggestions.push('死亡保障');
  if (scores.medicalScore >= SUGGESTION_THRESHOLD) suggestions.push('医療保険');
  if (scores.disabilityScore >= SUGGESTION_THRESHOLD) suggestions.push('就業不能保険');
  if (scores.assetFormationScore >= SUGGESTION_THRESHOLD) suggestions.push('資産形成型保険');
  return suggestions;
}
