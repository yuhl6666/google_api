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
  savings: number; // 万円
  otherAssets: number; // 万円
  hasMortgageLifeInsurance: boolean;
  mortgageBalance: number; // 万円
}

export interface ExistingInsurance {
  deathCoverage: number; // 万円
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
  score: number; // 0-100
  reasons: string[];
}

export interface EducationCostBreakdownItem {
  childIndex: number;
  childAge: number;
  stage: string;
  amount: number;
}

export interface DeathCoverageResult {
  requiredAmount: number; // 万円、0円未満は0
  grossNeed: number; // 控除前の総費用(生活費+教育費+一時費用+ローン)
  riskScore: number; // 0-100、grossNeedに対するrequiredAmountの割合
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
  calculatedAt: string; // ISO文字列
}
