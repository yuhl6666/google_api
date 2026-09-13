import { computeRegionScore } from './regions';
import { Phase1ScoreBreakdown } from '../../types';

/**
 * Self-implemented weighted Jaccard coefficient between the company's
 * "wanted persona" tags and the talent's skill tags.
 *
 * Plain Jaccard = |A ∩ B| / |A ∪ B|. We extend it with per-tag importance
 * weights on the company side (wantedPersonaTagWeights, default 1): matched
 * tags contribute their weight to the intersection, and every wanted tag
 * (matched or not) contributes its weight to the union, so failing to cover
 * an important tag hurts more than failing to cover a minor one.
 */
export function weightedSkillJaccard(
  talentSkills: string[],
  wantedTags: string[],
  tagWeights: Record<string, number> = {}
): number {
  if (wantedTags.length === 0) return talentSkills.length === 0 ? 1 : 0.5;

  const talentSet = new Set(talentSkills.map(normalizeTag));
  const weightOf = (tag: string) => tagWeights[tag] ?? 1;

  let intersectionWeight = 0;
  let unionWeight = 0;
  const seen = new Set<string>();

  for (const rawTag of wantedTags) {
    const tag = normalizeTag(rawTag);
    if (seen.has(tag)) continue;
    seen.add(tag);
    const w = weightOf(rawTag);
    unionWeight += w;
    if (talentSet.has(tag)) intersectionWeight += w;
  }

  // Extra talent skills beyond what the company asked for don't hurt or
  // help the fit score directly (Jaccard union still grows conceptually,
  // but for a "does this talent cover what we need" fit we only weight
  // wanted tags) — this keeps the score meaningful for talents who have
  // many unrelated skills.
  if (unionWeight === 0) return 0;
  return intersectionWeight / unionWeight;
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export interface WorkloadFitInput {
  talentWeeklyAvailableHours: number;
  companyRequiredWeeklyHours: { min: number; max: number };
  sideJobAcceptable: boolean;
}

/**
 * Workload condition fit (0-1): 0 if the company doesn't accept side-job
 * involvement at all; otherwise how well the talent's available hours land
 * inside (or near) the company's required range.
 */
export function computeWorkloadFit(input: WorkloadFitInput): number {
  const { talentWeeklyAvailableHours: hours, companyRequiredWeeklyHours: range, sideJobAcceptable } = input;
  if (!sideJobAcceptable) return 0;
  if (range.max <= 0) return hours > 0 ? 1 : 0;

  if (hours >= range.min && hours <= range.max) return 1;

  const gap = hours < range.min ? range.min - hours : hours - range.max;
  const span = Math.max(range.max - range.min, range.min, 1);
  // Linear decay: fully outside by one full "span" of hours -> score 0.
  return Math.max(0, 1 - gap / span);
}

/**
 * Industry interest fit (0-1): 1 if the talent listed the company's industry
 * among their interests, a partial credit for a fuzzy/substring match
 * (e.g. "製造" matching "製造業"), else 0.
 */
export function computeIndustryFit(interestedIndustries: string[], companyIndustry: string): number {
  const industry = normalizeTag(companyIndustry);
  const interests = interestedIndustries.map(normalizeTag);
  if (interests.includes(industry)) return 1;
  const partial = interests.some((i) => industry.includes(i) || i.includes(industry));
  return partial ? 0.5 : 0;
}

export interface Phase1Input {
  talentSkills: string[];
  wantedPersonaTags: string[];
  wantedPersonaTagWeights?: Record<string, number>;
  talentWeeklyAvailableHours: number;
  companyRequiredWeeklyHours: { min: number; max: number };
  sideJobAcceptable: boolean;
  interestedIndustries: string[];
  companyIndustry: string;
  talentPrefecture: string;
  companyPrefecture: string;
  relocatable: boolean;
  workStyle: 'remote' | 'onsite' | 'both';
}

/**
 * Phase 1 (副業お試し) weights: skill and workload fit dominate, since the
 * goal at this stage is simply "can this person actually help, in the hours
 * they have" — region and industry affinity matter but are secondary.
 */
export const PHASE1_WEIGHTS = {
  skillFit: 0.4,
  workloadFit: 0.25,
  industryFit: 0.2,
  regionFit: 0.15,
} as const;

export function scorePhase1(input: Phase1Input): Phase1ScoreBreakdown {
  const skillFit = weightedSkillJaccard(input.talentSkills, input.wantedPersonaTags, input.wantedPersonaTagWeights);
  const workloadFit = computeWorkloadFit({
    talentWeeklyAvailableHours: input.talentWeeklyAvailableHours,
    companyRequiredWeeklyHours: input.companyRequiredWeeklyHours,
    sideJobAcceptable: input.sideJobAcceptable,
  });
  const industryFit = computeIndustryFit(input.interestedIndustries, input.companyIndustry);
  const regionFit = computeRegionScore({
    talentPrefecture: input.talentPrefecture,
    companyPrefecture: input.companyPrefecture,
    relocatable: input.relocatable,
    workStyle: input.workStyle,
  });

  const total =
    skillFit * PHASE1_WEIGHTS.skillFit +
    workloadFit * PHASE1_WEIGHTS.workloadFit +
    industryFit * PHASE1_WEIGHTS.industryFit +
    regionFit * PHASE1_WEIGHTS.regionFit;

  return {
    skillFit: round(skillFit),
    workloadFit: round(workloadFit),
    industryFit: round(industryFit),
    regionFit: round(regionFit),
    total: round(total),
  };
}

export function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
