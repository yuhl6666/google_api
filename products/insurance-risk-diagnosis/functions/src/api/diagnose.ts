import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { DiagnosisInput, runDiagnosis } from '../calc';

const REGION = 'asia-northeast1';

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'ログインが必要です。');
  }
  return auth.uid;
}

function validateInput(input: DiagnosisInput): void {
  if (!input || !input.basic || !input.asset || !input.existingInsurance || !input.health) {
    throw new HttpsError('invalid-argument', '入力データが不正です。');
  }
  if (input.basic.age < 0 || input.basic.age > 120) {
    throw new HttpsError('invalid-argument', '年齢の値が不正です。');
  }
  if (input.basic.annualIncome < 0) {
    throw new HttpsError('invalid-argument', '年収の値が不正です。');
  }
  if (input.basic.hasSpouse && (input.basic.spouseAge === undefined || input.basic.spouseAge < 0)) {
    throw new HttpsError('invalid-argument', '配偶者の年齢を入力してください。');
  }
}

// 診断を実行し、入力と結果をFirestoreに保存する
export const runDiagnosisCallable = onCall<DiagnosisInput>({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  const input = request.data;
  validateInput(input);

  const result = runDiagnosis(input);

  const db = getFirestore();
  const inputRef = db.collection('diagnosisInputs').doc();
  const id = inputRef.id;
  const now = new Date().toISOString();

  const batch = db.batch();
  batch.set(inputRef, { uid, input, createdAt: now });
  batch.set(db.collection('diagnosisResults').doc(id), { uid, result, createdAt: now });
  await batch.commit();

  return { id, result };
});

// ログインユーザーの診断履歴一覧(サマリのみ)を新しい順に返す
export const listDiagnosisHistoryCallable = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  const db = getFirestore();

  const snapshot = await db
    .collection('diagnosisResults')
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return {
    items: snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        createdAt: data.createdAt,
        requiredDeathCoverage: data.result?.deathCoverage?.requiredAmount ?? 0,
        medicalScore: data.result?.medicalRisk?.score ?? 0,
        disabilityScore: data.result?.disabilityRisk?.score ?? 0,
        assetFormationScore: data.result?.assetFormation?.score ?? 0,
        suggestedProductTypes: data.result?.suggestedProductTypes ?? [],
      };
    }),
  };
});

// 1件の診断の入力・結果を詳細表示用に返す(自分のものだけ)
export const getDiagnosisDetailCallable = onCall<{ id: string }>({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  const { id } = request.data;
  if (!id) {
    throw new HttpsError('invalid-argument', 'idが指定されていません。');
  }

  const db = getFirestore();
  const [inputDoc, resultDoc] = await Promise.all([
    db.collection('diagnosisInputs').doc(id).get(),
    db.collection('diagnosisResults').doc(id).get(),
  ]);

  if (!inputDoc.exists || !resultDoc.exists) {
    throw new HttpsError('not-found', '診断結果が見つかりません。');
  }
  const inputData = inputDoc.data()!;
  const resultData = resultDoc.data()!;
  if (inputData.uid !== uid || resultData.uid !== uid) {
    throw new HttpsError('permission-denied', 'この診断結果を閲覧する権限がありません。');
  }

  return {
    id,
    input: inputData.input,
    result: resultData.result,
    createdAt: inputData.createdAt,
  };
});
