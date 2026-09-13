import type { BasicInfo } from '../types/diagnosis';
import { calcSurvivorLivingCost } from './livingCost';
import {
  SURVIVOR_BASIC_PENSION_BASE, SURVIVOR_BASIC_PENSION_CHILD_ADD, SURVIVOR_BASIC_PENSION_CHILD_LIMIT_AGE,
  EMPLOYEE_PENSION_RATE,
} from './params';

export interface SurvivorPensionResult {
  total: number;
  reasons: string[];
}

export function calcSurvivorPensionTotal(basic: BasicInfo): SurvivorPensionResult {
  const reasons: string[] = [];

  const youngestAge = basic.children.length
    ? Math.min(...basic.children.map((c) => c.currentAge))
    : null;
  const basicPensionYears = youngestAge !== null
    ? Math.max(0, SURVIVOR_BASIC_PENSION_CHILD_LIMIT_AGE - youngestAge)
    : 0;
  const childAddition = Math.min(basic.children.length, 2) * SURVIVOR_BASIC_PENSION_CHILD_ADD;
  const basicPensionTotal = basicPensionYears > 0
    ? (SURVIVOR_BASIC_PENSION_BASE + childAddition) * basicPensionYears
    : 0;
  if (basicPensionTotal > 0) {
    reasons.push(
      `遺族基礎年金(簡易概算): (基本額${SURVIVOR_BASIC_PENSION_BASE}万円 + 子加算${childAddition}万円) × ${basicPensionYears}年 = ${basicPensionTotal.toFixed(1)}万円`,
    );
  }

  let employeePensionTotal = 0;
  if (basic.occupationType !== 'self_employed' && basic.hasSpouse) {
    const { phaseAYears, phaseBYears } = calcSurvivorLivingCost(basic);
    const years = phaseAYears + phaseBYears;
    employeePensionTotal = basic.annualIncome * EMPLOYEE_PENSION_RATE * years;
    if (employeePensionTotal > 0) {
      reasons.push(
        `遺族厚生年金(簡易概算、会社員/公務員のみ): 年収${basic.annualIncome}万円 × ${EMPLOYEE_PENSION_RATE * 100}% × ${years}年 = ${employeePensionTotal.toFixed(1)}万円`,
      );
    }
  } else if (basic.occupationType === 'self_employed') {
    reasons.push('自営業(国民年金のみ)のため遺族厚生年金はありません。');
  }

  return { total: basicPensionTotal + employeePensionTotal, reasons };
}
