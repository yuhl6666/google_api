import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { DiagnosisInput, DiagnosisResult, HistoryItem } from '../types/diagnosis';

export async function runDiagnosis(input: DiagnosisInput): Promise<{ id: string; result: DiagnosisResult }> {
  const fn = httpsCallable<DiagnosisInput, { id: string; result: DiagnosisResult }>(functions, 'runDiagnosisCallable');
  const res = await fn(input);
  return res.data;
}

export async function listDiagnosisHistory(): Promise<HistoryItem[]> {
  const fn = httpsCallable<void, { items: HistoryItem[] }>(functions, 'listDiagnosisHistoryCallable');
  const res = await fn();
  return res.data.items;
}

export async function getDiagnosisDetail(id: string): Promise<{ id: string; input: DiagnosisInput; result: DiagnosisResult; createdAt: string }> {
  const fn = httpsCallable<{ id: string }, { id: string; input: DiagnosisInput; result: DiagnosisResult; createdAt: string }>(functions, 'getDiagnosisDetailCallable');
  const res = await fn({ id });
  return res.data;
}
