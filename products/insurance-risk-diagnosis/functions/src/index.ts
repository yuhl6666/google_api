import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { runDiagnosisCallable, listDiagnosisHistoryCallable, getDiagnosisDetailCallable } from './api/diagnose';
