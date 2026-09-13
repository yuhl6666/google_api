import { describe, test, expect } from 'vitest';
import { runDiagnosis } from './index';
import type { DiagnosisInput } from '../types/diagnosis';

function baseInput(overrides: Partial<DiagnosisInput> = {}): DiagnosisInput {
  return {
    basic: {
      age: 35,
      gender: 'male',
      occupationType: 'employee',
      occupationRisk: 'low',
      annualIncome: 600,
      hasSpouse: false,
      children: [],
      educationCourse: 'all_public',
      ...overrides.basic,
    },
    asset: {
      savings: 200,
      otherAssets: 0,
      hasMortgageLifeInsurance: true,
      mortgageBalance: 0,
      ...overrides.asset,
    },
    existingInsurance: {
      deathCoverage: 0,
      hasMedicalCoverage: false,
      hasDisabilityCoverage: false,
      hasSavingsTypeCoverage: false,
      ...overrides.existingInsurance,
    },
    health: {
      hasMedicalHistory: false,
      ...overrides.health,
    },
  };
}

describe('runDiagnosis - 家族構成パターン', () => {
  test('独身・子供なし: 遺族生活費と教育費が発生しない', () => {
    const result = runDiagnosis(baseInput());
    expect(result.deathCoverage.breakdown.phaseALivingCost).toBe(0);
    expect(result.deathCoverage.breakdown.phaseBLivingCost).toBe(0);
    expect(result.deathCoverage.breakdown.educationTotal).toBe(0);
    // 葬儀費用のみ、貯蓄200万円で相殺され0円になる想定
    expect(result.deathCoverage.requiredAmount).toBe(0);
  });

  test('夫婦のみ(子供なし): Phase Bのみ発生しPhase Aは0', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33 } as any,
    }));
    expect(result.deathCoverage.breakdown.phaseAYears).toBe(0);
    expect(result.deathCoverage.breakdown.phaseBLivingCost).toBeGreaterThan(0);
    expect(result.deathCoverage.breakdown.educationTotal).toBe(0);
  });

  test('夫婦+子供1人(幼児): Phase A・教育費ともに発生', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 2 }] } as any,
    }));
    expect(result.deathCoverage.breakdown.phaseAYears).toBe(20); // 22 - 2
    expect(result.deathCoverage.breakdown.educationTotal).toBeGreaterThan(0);
    expect(result.deathCoverage.requiredAmount).toBeGreaterThan(0);
  });

  test('夫婦+子供2人(小学生・高校生): 教育費は残り年数のみ按分計上', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 40, children: [{ currentAge: 8 }, { currentAge: 16 }] } as any,
    }));
    const breakdown = result.deathCoverage.breakdown.educationBreakdown;
    // 高校生(16歳)は幼稚園・小学校・中学校のステージが計上されない
    expect(breakdown.some((b) => b.childIndex === 1 && b.stage === '幼稚園')).toBe(false);
    expect(breakdown.some((b) => b.childIndex === 1 && b.stage === '高校')).toBe(true);
    expect(breakdown.some((b) => b.childIndex === 0 && b.stage === '小学校')).toBe(true);
  });

  test('ひとり親+子供1人: 配偶者なしでもPhase Aと教育費・遺族基礎年金は発生', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: false, children: [{ currentAge: 5 }] } as any,
    }));
    expect(result.deathCoverage.breakdown.phaseALivingCost).toBeGreaterThan(0);
    expect(result.deathCoverage.breakdown.phaseBLivingCost).toBe(0); // 配偶者がいないためPhase Bはなし
    expect(result.deathCoverage.breakdown.survivorPensionTotal).toBeGreaterThan(0);
  });

  test('資産が十分なケース: 必要保障額は0円未満にならず0になる', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 60, children: [] } as any,
      asset: { savings: 10000, otherAssets: 10000, hasMortgageLifeInsurance: true, mortgageBalance: 0 },
    }));
    expect(result.deathCoverage.requiredAmount).toBe(0);
    expect(result.deathCoverage.riskScore).toBe(0);
  });

  test('団信未加入の住宅ローンは必要保障額に上乗せされる', () => {
    const withMortgage = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 5 }] } as any,
      asset: { savings: 200, otherAssets: 0, hasMortgageLifeInsurance: false, mortgageBalance: 2000 },
    }));
    const withoutMortgage = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 5 }] } as any,
      asset: { savings: 200, otherAssets: 0, hasMortgageLifeInsurance: true, mortgageBalance: 2000 },
    }));
    expect(withMortgage.deathCoverage.requiredAmount).toBeGreaterThan(withoutMortgage.deathCoverage.requiredAmount);
  });

  test('自営業は遺族厚生年金が発生しない分、会社員より必要保障額が大きい', () => {
    const employee = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, occupationType: 'employee', children: [{ currentAge: 5 }] } as any,
    }));
    const selfEmployed = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, occupationType: 'self_employed', children: [{ currentAge: 5 }] } as any,
    }));
    expect(selfEmployed.deathCoverage.requiredAmount).toBeGreaterThan(employee.deathCoverage.requiredAmount);
  });
});

describe('runDiagnosis - スコア系', () => {
  test('医療リスクスコアは年齢・職業危険度・既往歴の合計で0-100に収まる', () => {
    const result = runDiagnosis(baseInput({
      basic: { age: 62, occupationRisk: 'high' } as any,
      health: { hasMedicalHistory: true },
    }));
    expect(result.medicalRisk.score).toBe(100); // 40+30+30
  });

  test('就業不能リスクスコアは貯蓄が少ないほど高くなる', () => {
    const lowSavings = runDiagnosis(baseInput({ asset: { savings: 10, otherAssets: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0 } }));
    const highSavings = runDiagnosis(baseInput({ asset: { savings: 2000, otherAssets: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0 } }));
    expect(lowSavings.disabilityRisk.score).toBeGreaterThan(highSavings.disabilityRisk.score);
  });

  test('資産形成ニーズスコアは資産が少ないほど高くなる', () => {
    const lowAsset = runDiagnosis(baseInput({ asset: { savings: 0, otherAssets: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0 } }));
    const highAsset = runDiagnosis(baseInput({ asset: { savings: 5000, otherAssets: 5000, hasMortgageLifeInsurance: true, mortgageBalance: 0 } }));
    expect(lowAsset.assetFormation.score).toBeGreaterThan(highAsset.assetFormation.score);
  });

  test('すべてのスコアが0-100の範囲に収まる', () => {
    const result = runDiagnosis(baseInput({
      basic: { age: 55, occupationRisk: 'high', hasSpouse: true, spouseAge: 50, children: [{ currentAge: 10 }, { currentAge: 15 }] } as any,
      health: { hasMedicalHistory: true },
    }));
    for (const s of [result.medicalRisk.score, result.disabilityRisk.score, result.assetFormation.score, result.deathCoverage.riskScore]) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  test('提案される保険種類はスコア閾値(50点)以上のもののみ', () => {
    const result = runDiagnosis(baseInput({
      basic: { age: 45, occupationRisk: 'high', hasSpouse: true, spouseAge: 43, children: [{ currentAge: 3 }] } as any,
      health: { hasMedicalHistory: true },
      asset: { savings: 10, otherAssets: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0 },
    }));
    expect(result.suggestedProductTypes).toContain('死亡保障');
    expect(result.suggestedProductTypes).toContain('医療保険');
    // 商品名・会社名を含まないこと
    for (const p of result.suggestedProductTypes) {
      expect(p).not.toMatch(/生命|損保|会社/);
    }
  });
});
