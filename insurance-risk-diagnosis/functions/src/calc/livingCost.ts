import { BasicInfo } from './types';
import {
  LIVING_COST_RATIO, PHASE_A_RATIO, PHASE_B_RATIO, INDEPENDENCE_AGE, SPOUSE_LIFE_EXPECTANCY,
} from './params';

export interface SurvivorLivingCostResult {
  phaseA: number;
  phaseAYears: number;
  phaseB: number;
  phaseBYears: number;
  reasons: string[];
}

export function calcSurvivorLivingCost(basic: BasicInfo): SurvivorLivingCostResult {
  if (!basic.hasSpouse && basic.children.length === 0) {
    return { phaseA: 0, phaseAYears: 0, phaseB: 0, phaseBYears: 0, reasons: ['配偶者・子供がいないため遺族生活費は発生しません。'] };
  }

  const baseLivingCost = basic.annualIncome * LIVING_COST_RATIO;
  const reasons: string[] = [
    `年間生活費目安 = 年収${basic.annualIncome}万円 × ${LIVING_COST_RATIO * 100}% = ${baseLivingCost.toFixed(1)}万円`,
  ];

  const youngestChildAge = basic.children.length
    ? Math.min(...basic.children.map((c) => c.currentAge))
    : null;
  const phaseAYears = youngestChildAge !== null
    ? Math.max(0, INDEPENDENCE_AGE - youngestChildAge)
    : 0;
  const phaseA = baseLivingCost * PHASE_A_RATIO * phaseAYears;
  if (phaseAYears > 0) {
    reasons.push(
      `末子独立(${INDEPENDENCE_AGE}歳)までの${phaseAYears}年間: ${baseLivingCost.toFixed(1)}万円 × ${PHASE_A_RATIO * 100}% × ${phaseAYears}年 = ${phaseA.toFixed(1)}万円`,
    );
  }

  let phaseBYears = 0;
  let phaseB = 0;
  if (basic.hasSpouse && basic.spouseAge !== undefined) {
    const spouseAgeAtPhaseAEnd = basic.spouseAge + phaseAYears;
    phaseBYears = Math.max(0, SPOUSE_LIFE_EXPECTANCY - spouseAgeAtPhaseAEnd);
    phaseB = baseLivingCost * PHASE_B_RATIO * phaseBYears;
    if (phaseBYears > 0) {
      reasons.push(
        `末子独立後、配偶者${SPOUSE_LIFE_EXPECTANCY}歳までの${phaseBYears}年間: ${baseLivingCost.toFixed(1)}万円 × ${PHASE_B_RATIO * 100}% × ${phaseBYears}年 = ${phaseB.toFixed(1)}万円`,
      );
    }
  }

  return { phaseA, phaseAYears, phaseB, phaseBYears, reasons };
}
