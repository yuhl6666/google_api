import type { Child, EducationCostBreakdownItem, EducationCourse } from '../types/diagnosis';
import { EDUCATION_STAGES } from './params';

export interface EducationCostResult {
  total: number;
  breakdown: EducationCostBreakdownItem[];
  reasons: string[];
}

function calcChildRemainingCost(child: Child, childIndex: number, course: EducationCourse) {
  let total = 0;
  const breakdown: EducationCostBreakdownItem[] = [];
  const reasons: string[] = [];

  for (const stage of EDUCATION_STAGES) {
    if (child.currentAge >= stage.endAge) continue; // 既に終了したステージは計上しない

    const usePrivate = course === 'all_private'
      || (course === 'public_then_private_univ' && stage.name === '大学');
    const stageTotal = usePrivate ? stage.privateTotal : stage.publicTotal;

    const stageLengthYears = stage.endAge - stage.startAge;
    const remainingYears = stage.endAge - Math.max(child.currentAge, stage.startAge);
    const amount = stageTotal * (remainingYears / stageLengthYears);

    total += amount;
    breakdown.push({ childIndex, childAge: child.currentAge, stage: stage.name, amount });
    reasons.push(
      `第${childIndex + 1}子(${child.currentAge}歳)・${stage.name}(${usePrivate ? '私立' : '公立'})残り${remainingYears.toFixed(1)}年分: ${amount.toFixed(1)}万円`,
    );
  }

  return { total, breakdown, reasons };
}

export function calcRemainingEducationCost(children: Child[], course: EducationCourse): EducationCostResult {
  let total = 0;
  const breakdown: EducationCostBreakdownItem[] = [];
  const reasons: string[] = [];

  children.forEach((child, index) => {
    const r = calcChildRemainingCost(child, index, course);
    total += r.total;
    breakdown.push(...r.breakdown);
    reasons.push(...r.reasons);
  });

  return { total, breakdown, reasons };
}
