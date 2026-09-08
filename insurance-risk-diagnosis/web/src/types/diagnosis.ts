export type RiskLevel = 'low' | 'mid' | 'high';
export type OccupationType = 'employee' | 'public_servant' | 'self_employed';
export type EducationCourse = 'all_public' | 'public_then_private_univ' | 'all_private';

export interface Child {
  currentAge: number;
}

export interface BasicInfo {
  age: number;
  gender: 'male' | 'female' | 'other';
  occupationType: OccupationType;
  occupationRisk: RiskLevel;
  annualIncome: number; // 万円
  hasSpouse: boolean;
  spouseAge?: number;
  children: Child[];
  educationCourse: EducationCourse;
}

export interface AssetInfo {
  savings: number;
  otherAssets: number;
  hasMortgageLifeInsurance: boolean;
  mortgageBalance: number;
}

export interface ExistingInsurance {
  deathCoverage: number;
  hasMedicalCoverage: boolean;
  hasDisabilityCoverage: boolean;
  hasSavingsTypeCoverage: boolean;
}

export interface HealthInfo {
  hasMedicalHistory: boolean;
}

export interface DiagnosisInput {
  basic: BasicInfo;
  asset: AssetInfo;
  existingInsurance: ExistingInsurance;
  health: HealthInfo;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

export interface EducationCostBreakdownItem {
  childIndex: number;
  childAge: number;
  stage: string;
  amount: number;
}

export interface DeathCoverageResult {
  requiredAmount: number;
  grossNeed: number;
  riskScore: number;
  breakdown: {
    phaseALivingCost: number;
    phaseAYears: number;
    phaseBLivingCost: number;
    phaseBYears: number;
    educationTotal: number;
    educationBreakdown: EducationCostBreakdownItem[];
    funeralCost: number;
    mortgageAddOn: number;
    survivorPensionTotal: number;
    savings: number;
    otherAssets: number;
    existingDeathCoverage: number;
  };
  reasons: string[];
}

export interface DiagnosisResult {
  deathCoverage: DeathCoverageResult;
  medicalRisk: ScoreResult;
  disabilityRisk: ScoreResult;
  assetFormation: ScoreResult;
  suggestedProductTypes: string[];
  calculatedAt: string;
}

export interface HistoryItem {
  id: string;
  createdAt: string;
  requiredDeathCoverage: number;
  medicalScore: number;
  disabilityScore: number;
  assetFormationScore: number;
  suggestedProductTypes: string[];
}

export function emptyDiagnosisInput(): DiagnosisInput {
  return {
    basic: {
      age: 30,
      gender: 'male',
      occupationType: 'employee',
      occupationRisk: 'low',
      annualIncome: 500,
      hasSpouse: false,
      spouseAge: undefined,
      children: [],
      educationCourse: 'all_public',
    },
    asset: {
      savings: 100,
      otherAssets: 0,
      hasMortgageLifeInsurance: true,
      mortgageBalance: 0,
    },
    existingInsurance: {
      deathCoverage: 0,
      hasMedicalCoverage: false,
      hasDisabilityCoverage: false,
      hasSavingsTypeCoverage: false,
    },
    health: {
      hasMedicalHistory: false,
    },
  };
}
