import { describe, test, expect } from 'vitest';
import { prefectureProximity, computeRegionScore } from '../regions';
import { weightedSkillJaccard, computeWorkloadFit, computeIndustryFit, scorePhase1, PHASE1_WEIGHTS } from '../phase1';
import {
  computeEngagementDurationScore,
  computeMessageVolumeScore,
  computeReviewScore,
  scorePhase2To3,
  PHASE2TO3_PROMOTION_THRESHOLD,
} from '../phase2to3';
import { computeSuccessionSeriousness, computeFundingFit, computeTimingFit, scorePhase3, PHASE3_WEIGHTS } from '../phase3';

describe('regions', () => {
  test('same prefecture is a perfect match', () => {
    expect(prefectureProximity('東京都', '東京都')).toBe(1);
  });

  test('same block scores higher than a distant block', () => {
    expect(prefectureProximity('東京都', '埼玉県')).toBeGreaterThan(prefectureProximity('東京都', '沖縄県'));
  });

  test('adjacent blocks score between same-block and distant', () => {
    const sameBlock = prefectureProximity('東京都', '埼玉県'); // both kanto
    const adjacent = prefectureProximity('東京都', '新潟県'); // kanto vs chubu (adjacent)
    const distant = prefectureProximity('東京都', '沖縄県'); // kanto vs kyushu_okinawa (not adjacent)
    expect(sameBlock).toBeGreaterThan(adjacent);
    expect(adjacent).toBeGreaterThan(distant);
  });

  test('remote work style ignores geography entirely', () => {
    const score = computeRegionScore({
      talentPrefecture: '東京都',
      companyPrefecture: '沖縄県',
      relocatable: false,
      workStyle: 'remote',
    });
    expect(score).toBe(1);
  });

  test('relocatable talent closes most of the geography gap for onsite work', () => {
    const notRelocatable = computeRegionScore({
      talentPrefecture: '東京都',
      companyPrefecture: '沖縄県',
      relocatable: false,
      workStyle: 'onsite',
    });
    const relocatable = computeRegionScore({
      talentPrefecture: '東京都',
      companyPrefecture: '沖縄県',
      relocatable: true,
      workStyle: 'onsite',
    });
    expect(relocatable).toBeGreaterThan(notRelocatable);
  });
});

describe('phase1: weightedSkillJaccard', () => {
  test('perfect match scores 1', () => {
    expect(weightedSkillJaccard(['経理', 'EC運営'], ['経理', 'EC運営'])).toBe(1);
  });

  test('no overlap scores 0', () => {
    expect(weightedSkillJaccard(['営業'], ['経理', 'EC運営'])).toBe(0);
  });

  test('missing an important (higher-weighted) tag hurts more than a minor one', () => {
    const missingImportant = weightedSkillJaccard(['EC運営'], ['経理', 'EC運営'], { 経理: 3, EC運営: 1 });
    const missingMinor = weightedSkillJaccard(['経理'], ['経理', 'EC運営'], { 経理: 3, EC運営: 1 });
    expect(missingMinor).toBeGreaterThan(missingImportant);
  });

  test('is case/whitespace insensitive', () => {
    expect(weightedSkillJaccard([' EC運営 '], ['ec運営'])).toBe(1);
  });
});

describe('phase1: computeWorkloadFit', () => {
  test('zero when company does not accept side jobs', () => {
    expect(
      computeWorkloadFit({ talentWeeklyAvailableHours: 10, companyRequiredWeeklyHours: { min: 5, max: 15 }, sideJobAcceptable: false })
    ).toBe(0);
  });

  test('full score inside the required range', () => {
    expect(
      computeWorkloadFit({ talentWeeklyAvailableHours: 10, companyRequiredWeeklyHours: { min: 5, max: 15 }, sideJobAcceptable: true })
    ).toBe(1);
  });

  test('decays for hours outside the range', () => {
    const near = computeWorkloadFit({ talentWeeklyAvailableHours: 3, companyRequiredWeeklyHours: { min: 5, max: 15 }, sideJobAcceptable: true });
    const far = computeWorkloadFit({ talentWeeklyAvailableHours: 0, companyRequiredWeeklyHours: { min: 5, max: 15 }, sideJobAcceptable: true });
    expect(near).toBeLessThan(1);
    expect(far).toBeLessThan(near);
  });
});

describe('phase1: computeIndustryFit', () => {
  test('exact match scores 1', () => {
    expect(computeIndustryFit(['製造業', '農業'], '製造業')).toBe(1);
  });
  test('no relation scores 0', () => {
    expect(computeIndustryFit(['飲食業'], '製造業')).toBe(0);
  });
});

describe('phase1: scorePhase1 total', () => {
  test('weights sum to 1 and total is bounded', () => {
    const weightSum = Object.values(PHASE1_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(weightSum).toBeCloseTo(1);

    const breakdown = scorePhase1({
      talentSkills: ['経理', 'EC運営'],
      wantedPersonaTags: ['経理', 'EC運営'],
      talentWeeklyAvailableHours: 10,
      companyRequiredWeeklyHours: { min: 5, max: 15 },
      sideJobAcceptable: true,
      interestedIndustries: ['製造業'],
      companyIndustry: '製造業',
      talentPrefecture: '東京都',
      companyPrefecture: '東京都',
      relocatable: false,
      workStyle: 'both',
    });
    expect(breakdown.total).toBeCloseTo(1);
  });

  test('a poor fit scores low', () => {
    const breakdown = scorePhase1({
      talentSkills: ['営業'],
      wantedPersonaTags: ['経理', 'EC運営'],
      talentWeeklyAvailableHours: 40,
      companyRequiredWeeklyHours: { min: 3, max: 5 },
      sideJobAcceptable: false,
      interestedIndustries: ['飲食業'],
      companyIndustry: '製造業',
      talentPrefecture: '沖縄県',
      companyPrefecture: '北海道',
      relocatable: false,
      workStyle: 'onsite',
    });
    expect(breakdown.total).toBeLessThan(0.2);
  });
});

describe('phase2to3 promotion', () => {
  test('component scores map to expected ranges', () => {
    expect(computeEngagementDurationScore(0)).toBe(0);
    expect(computeEngagementDurationScore(90)).toBe(1);
    expect(computeEngagementDurationScore(180)).toBe(1); // clamped

    expect(computeMessageVolumeScore(0)).toBe(0);
    expect(computeMessageVolumeScore(40)).toBe(1);

    expect(computeReviewScore()).toBe(0);
    expect(computeReviewScore(5, 5)).toBe(1);
    expect(computeReviewScore(3, 3)).toBeCloseTo(0.5);
  });

  test('strong engagement clears the promotion threshold', () => {
    const breakdown = scorePhase2To3({
      engagementDurationDays: 120,
      messageCount: 60,
      talentRating: 5,
      companyRating: 4,
      phase1Total: 0.8,
    });
    expect(breakdown.total).toBeGreaterThanOrEqual(PHASE2TO3_PROMOTION_THRESHOLD);
    expect(breakdown.eligibleForPhase3).toBe(true);
  });

  test('a brand new match is not eligible', () => {
    const breakdown = scorePhase2To3({
      engagementDurationDays: 2,
      messageCount: 1,
      phase1Total: 0.5,
    });
    expect(breakdown.eligibleForPhase3).toBe(false);
  });
});

describe('phase3 succession scoring', () => {
  test('component scores map to expected ranges', () => {
    expect(computeSuccessionSeriousness(1)).toBe(0);
    expect(computeSuccessionSeriousness(5)).toBe(1);

    expect(computeFundingFit(0)).toBe(0);
    expect(computeFundingFit(1000)).toBe(1);
    expect(computeFundingFit(2000)).toBe(1); // clamped

    expect(computeTimingFit('immediate')).toBe(1);
    expect(computeTimingFit('5y+')).toBe(0.25);
  });

  test('weights sum to 1', () => {
    const weightSum = Object.values(PHASE3_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(weightSum).toBeCloseTo(1);
  });

  test('a highly-motivated, well-funded, local talent scores near the top', () => {
    const breakdown = scorePhase3({
      successionInterestLevel: 5,
      fundingCapacity: 1200,
      successionTimeframe: 'immediate',
      talentPrefecture: '長野県',
      companyPrefecture: '長野県',
      relocatable: true,
    });
    expect(breakdown.total).toBeCloseTo(1);
  });

  test('phase1 and phase3 favor different profiles under the same raw inputs', () => {
    // A talent who is a great skills/workload fit but has zero succession
    // interest/funding should score well in phase 1 and poorly in phase 3.
    const phase1 = scorePhase1({
      talentSkills: ['経理', 'EC運営'],
      wantedPersonaTags: ['経理', 'EC運営'],
      talentWeeklyAvailableHours: 10,
      companyRequiredWeeklyHours: { min: 5, max: 15 },
      sideJobAcceptable: true,
      interestedIndustries: ['製造業'],
      companyIndustry: '製造業',
      talentPrefecture: '東京都',
      companyPrefecture: '東京都',
      relocatable: false,
      workStyle: 'both',
    });
    const phase3 = scorePhase3({
      successionInterestLevel: 1,
      fundingCapacity: 0,
      successionTimeframe: '5y+',
      talentPrefecture: '東京都',
      companyPrefecture: '東京都',
      relocatable: false,
    });
    expect(phase1.total).toBeGreaterThan(0.8);
    expect(phase3.total).toBeLessThan(0.3);
  });
});
