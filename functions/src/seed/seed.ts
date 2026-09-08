/* eslint-disable no-console */
import { db, Timestamp } from '../lib/admin';
import { SEED_TALENTS, SEED_COMPANIES } from './data';
import { scorePhase1 } from '../scoring/phase1';
import { scorePhase2To3 } from '../scoring/phase2to3';
import { scorePhase3 } from '../scoring/phase3';
import { Company, Match, ScoreBreakdown, Talent } from '../types';

if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.ALLOW_PROD_SEED) {
  console.error(
    'FIRESTORE_EMULATOR_HOST is not set. Refusing to seed what looks like a real Firebase project.\n' +
      'Start the emulator first (firebase emulators:start) or set ALLOW_PROD_SEED=1 to override.'
  );
  process.exit(1);
}

function daysAgo(days: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

async function seedProfiles() {
  const batch = db.batch();
  for (const t of SEED_TALENTS) {
    const { id, ...rest } = t;
    batch.set(db.collection('talents').doc(id), {
      ...rest,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(1),
    });
  }
  for (const c of SEED_COMPANIES) {
    const { id, ...rest } = c;
    batch.set(db.collection('companies').doc(id), {
      ...rest,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(1),
    });
  }
  await batch.commit();
  console.log(`Seeded ${SEED_TALENTS.length} talents and ${SEED_COMPANIES.length} companies.`);
}

/** Phase-1 scores every talent against every company, writing all matches (mirrors refreshMatchesForCaller). */
async function seedAllPhase1Matches() {
  const batch = db.batch();
  let count = 0;
  for (const talent of SEED_TALENTS) {
    for (const company of SEED_COMPANIES) {
      const phase1 = scorePhase1({
        talentSkills: talent.skills,
        wantedPersonaTags: company.wantedPersonaTags,
        wantedPersonaTagWeights: company.wantedPersonaTagWeights,
        talentWeeklyAvailableHours: talent.weeklyAvailableHours,
        companyRequiredWeeklyHours: company.requiredWeeklyHours,
        sideJobAcceptable: company.sideJobAcceptable,
        interestedIndustries: talent.interestedIndustries,
        companyIndustry: company.industry,
        talentPrefecture: talent.prefecture,
        companyPrefecture: company.prefecture,
        relocatable: talent.relocatable,
        workStyle: talent.workStyle,
      });
      const scoreBreakdown: ScoreBreakdown = { phase1, currentTotal: phase1.total };
      const match: Partial<Match> = {
        talentId: talent.id,
        companyId: company.id,
        phase: 1,
        status: 'active',
        scoreBreakdown,
        reviews: {},
        messageCount: 0,
        phaseEnteredAt: { 1: daysAgo(60) },
        createdAt: daysAgo(60),
        updatedAt: daysAgo(60),
      };
      batch.set(db.collection('matches').doc(`${talent.id}_${company.id}`), match);
      count++;
    }
  }
  await batch.commit();
  console.log(`Seeded ${count} phase-1 matches (5 talents x 5 companies).`);
}

async function seedMessages(matchId: string, exchanges: number, startDaysAgo: number) {
  const batch = db.batch();
  const [talentId, companyId] = matchId.split('_');
  for (let i = 0; i < exchanges; i++) {
    const day = startDaysAgo - i * (startDaysAgo / exchanges);
    const ref = db.collection('messages').doc();
    const isTalentTurn = i % 2 === 0;
    batch.set(ref, {
      matchId,
      senderId: isTalentTurn ? talentId : companyId,
      senderRole: isTalentTurn ? 'talent' : 'company',
      body: isTalentTurn ? `よろしくお願いします。進捗共有です(${i + 1})。` : `ありがとうございます、確認しました(${i + 1})。`,
      createdAt: daysAgo(Math.max(day, 0.1)),
    });
  }
  await batch.commit();
}

/**
 * Walks the strongest-fit pair (t1 x c1) all the way through
 * phase1 -> phase2 -> phase3, and a second pair (t4 x c4) partway to phase2,
 * so the demo data exercises every phase tab and the phaseHistory trail.
 */
async function seedPhaseWalkthrough() {
  const talent1 = SEED_TALENTS.find((t) => t.id === 't1')! as Talent;
  const company1 = SEED_COMPANIES.find((c) => c.id === 'c1')! as Company;
  const matchId1 = 't1_c1';

  const phase1a = scorePhase1({
    talentSkills: talent1.skills,
    wantedPersonaTags: company1.wantedPersonaTags,
    wantedPersonaTagWeights: company1.wantedPersonaTagWeights,
    talentWeeklyAvailableHours: talent1.weeklyAvailableHours,
    companyRequiredWeeklyHours: company1.requiredWeeklyHours,
    sideJobAcceptable: company1.sideJobAcceptable,
    interestedIndustries: talent1.interestedIndustries,
    companyIndustry: company1.industry,
    talentPrefecture: talent1.prefecture,
    companyPrefecture: company1.prefecture,
    relocatable: talent1.relocatable,
    workStyle: talent1.workStyle,
  });

  await seedMessages(matchId1, 50, 45);

  const phase2to3a = scorePhase2To3({
    engagementDurationDays: 45,
    messageCount: 50,
    talentRating: 5,
    companyRating: 4,
    phase1Total: phase1a.total,
  });

  const phase3a = scorePhase3({
    successionInterestLevel: talent1.successionInterestLevel,
    fundingCapacity: talent1.fundingCapacity,
    successionTimeframe: company1.successionTimeframe,
    talentPrefecture: talent1.prefecture,
    companyPrefecture: company1.prefecture,
    relocatable: talent1.relocatable,
  });

  await db
    .collection('matches')
    .doc(matchId1)
    .set(
      {
        phase: 3,
        status: 'active',
        messageCount: 50,
        reviews: { talentRating: 5, talentComment: '想像以上に温かく迎えてもらえた', companyRating: 4, companyComment: '真剣に向き合ってくれている' },
        continuationIntent: { talent: true, company: true },
        scoreBreakdown: { phase1: phase1a, phase2to3: phase2to3a, phase3: phase3a, currentTotal: phase3a.total },
        phaseEnteredAt: { 1: daysAgo(60), 2: daysAgo(20), 3: daysAgo(2) },
        firstMessageAt: daysAgo(45),
        lastMessageAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
      { merge: true }
    );

  await db.collection('phaseHistory').add({
    matchId: matchId1,
    fromPhase: 1,
    toPhase: 2,
    reason: 'フェーズ1スコアが基準を満たし、双方が継続を希望しました。',
    changedBy: talent1.id,
    scoreAtChange: phase1a.total,
    createdAt: daysAgo(20),
  });
  await db.collection('phaseHistory').add({
    matchId: matchId1,
    fromPhase: 2,
    toPhase: 3,
    reason: '関与期間・やり取り量・レビューの総合スコアが承継検討フェーズの基準を満たしました。',
    changedBy: company1.id,
    scoreAtChange: phase2to3a.total,
    createdAt: daysAgo(2),
  });

  console.log(`t1 x c1 walked through phase1(${phase1a.total}) -> phase2(${phase2to3a.total}) -> phase3(${phase3a.total}).`);

  // Second pair: partway into phase 2, not yet eligible for phase 3.
  const matchId2 = 't4_c4';
  await seedMessages(matchId2, 8, 10);
  await db
    .collection('matches')
    .doc(matchId2)
    .set(
      {
        phase: 2,
        status: 'active',
        messageCount: 8,
        continuationIntent: { talent: true, company: true },
        phaseEnteredAt: { 1: daysAgo(60), 2: daysAgo(10) },
        firstMessageAt: daysAgo(10),
        lastMessageAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
      { merge: true }
    );
  await db.collection('phaseHistory').add({
    matchId: matchId2,
    fromPhase: 1,
    toPhase: 2,
    reason: 'フェーズ1スコアが基準を満たし、双方が継続を希望しました。',
    changedBy: 't4',
    scoreAtChange: 0.75,
    createdAt: daysAgo(10),
  });
  console.log('t4 x c4 advanced to phase 2 (not yet eligible for phase 3) as an in-progress example.');
}

async function main() {
  await seedProfiles();
  await seedAllPhase1Matches();
  await seedPhaseWalkthrough();
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
