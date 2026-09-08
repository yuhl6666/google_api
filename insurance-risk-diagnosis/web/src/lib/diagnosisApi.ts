import {
  collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { runDiagnosis as calcDiagnosis } from '../calc';
import type { DiagnosisInput, DiagnosisResult, HistoryItem } from '../types/diagnosis';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('ログインが必要です。');
  return uid;
}

// 診断はブラウザ内で計算し、結果をFirestoreへ直接保存する(Cloud Functionsは使わない構成)。
// Firestoreのセキュリティルールで「自分のuidのデータしか読み書きできない」よう制限している。
export async function runDiagnosis(input: DiagnosisInput): Promise<{ id: string; result: DiagnosisResult }> {
  const uid = requireUid();
  const result = calcDiagnosis(input);

  const inputRef = doc(collection(db, 'diagnosisInputs'));
  const id = inputRef.id;
  const createdAt = new Date().toISOString();

  await Promise.all([
    setDoc(inputRef, { uid, input, createdAt }),
    setDoc(doc(db, 'diagnosisResults', id), { uid, result, createdAt }),
  ]);

  return { id, result };
}

export async function listDiagnosisHistory(): Promise<HistoryItem[]> {
  const uid = requireUid();
  const q = query(
    collection(db, 'diagnosisResults'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      createdAt: data.createdAt,
      requiredDeathCoverage: data.result?.deathCoverage?.requiredAmount ?? 0,
      medicalScore: data.result?.medicalRisk?.score ?? 0,
      disabilityScore: data.result?.disabilityRisk?.score ?? 0,
      assetFormationScore: data.result?.assetFormation?.score ?? 0,
      suggestedProductTypes: data.result?.suggestedProductTypes ?? [],
    };
  });
}

export async function getDiagnosisDetail(id: string): Promise<{ id: string; input: DiagnosisInput; result: DiagnosisResult; createdAt: string }> {
  const uid = requireUid();
  const [inputSnap, resultSnap] = await Promise.all([
    getDoc(doc(db, 'diagnosisInputs', id)),
    getDoc(doc(db, 'diagnosisResults', id)),
  ]);

  if (!inputSnap.exists() || !resultSnap.exists()) {
    throw new Error('診断結果が見つかりません。');
  }
  const inputData = inputSnap.data();
  const resultData = resultSnap.data();
  if (inputData.uid !== uid || resultData.uid !== uid) {
    throw new Error('この診断結果を閲覧する権限がありません。');
  }

  return { id, input: inputData.input, result: resultData.result, createdAt: inputData.createdAt };
}
