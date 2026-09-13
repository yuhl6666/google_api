/**
 * サンプルデータ投入スクリプト。
 *
 * Firestoreエミュレータ、または本番/開発Firebaseプロジェクトに対して
 * 案件10件・要員10件のサンプルデータを投入する。
 *
 * 実行例(エミュレータ):
 *   export FIRESTORE_EMULATOR_HOST=localhost:8080
 *   export GCLOUD_PROJECT=ses-matching-tool
 *   npm run build && node lib/seed/runSeed.js
 */
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db, WEIGHTS_DOC_ID } from '../firestoreAdmin';
import { DEFAULT_WEIGHTS } from '../scoring';
import { seedEngineers, seedProjects } from './data';

async function clearCollection(name: string): Promise<void> {
  const snapshot = await db.collection(name).get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function main(): Promise<void> {
  console.log('既存データをクリアしています...');
  await Promise.all([
    clearCollection(COLLECTIONS.projects),
    clearCollection(COLLECTIONS.engineers),
    clearCollection(COLLECTIONS.matchResults),
    clearCollection(COLLECTIONS.feedbackLog),
  ]);

  const now = Timestamp.now();

  console.log(`案件データを${seedProjects.length}件投入しています...`);
  const projectBatch = db.batch();
  for (const project of seedProjects) {
    const ref = db.collection(COLLECTIONS.projects).doc();
    projectBatch.set(ref, { ...project, createdAt: now, updatedAt: now });
  }
  await projectBatch.commit();

  console.log(`要員データを${seedEngineers.length}件投入しています...`);
  const engineerBatch = db.batch();
  for (const engineer of seedEngineers) {
    const ref = db.collection(COLLECTIONS.engineers).doc();
    engineerBatch.set(ref, { ...engineer, createdAt: now, updatedAt: now });
  }
  await engineerBatch.commit();

  console.log('重み設定を初期化しています...');
  await db
    .collection(COLLECTIONS.settings)
    .doc(WEIGHTS_DOC_ID)
    .set({ ...DEFAULT_WEIGHTS, updatedAt: now });

  console.log('完了しました。マッチング結果は /matches/run APIを呼び出して生成してください。');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
