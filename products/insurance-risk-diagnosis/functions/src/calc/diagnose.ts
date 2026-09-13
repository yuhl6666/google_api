import { DiagnosisInput, DiagnosisResult } from './types';
import { calcRequiredDeathCoverage } from './deathCoverage';
import { calcMedicalRiskScore } from './medicalRisk';
import { calcDisabilityRiskScore } from './disabilityRisk';
import { calcAssetFormationScore } from './assetFormation';
import { suggestProductTypes } from './productSuggestion';

export function runDiagnosis(input: DiagnosisInput): DiagnosisResult {
  const deathCoverage = calcRequiredDeathCoverage(input);
  const medicalRisk = calcMedicalRiskScore(input);
  const disabilityRisk = calcDisabilityRiskScore(input);
  const assetFormation = calcAssetFormationScore(input);

  const suggestedProductTypes = suggestProductTypes({
    deathCoverageRiskScore: deathCoverage.riskScore,
    medicalScore: medicalRisk.score,
    disabilityScore: disabilityRisk.score,
    assetFormationScore: assetFormation.score,
  });

  return {
    deathCoverage,
    medicalRisk,
    disabilityRisk,
    assetFormation,
    suggestedProductTypes,
    calculatedAt: new Date().toISOString(),
  };
}
