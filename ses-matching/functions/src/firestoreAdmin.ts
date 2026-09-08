import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
export const auth = getAuth();

export const COLLECTIONS = {
  projects: 'projects',
  engineers: 'engineers',
  matchResults: 'matchResults',
  feedbackLog: 'feedbackLog',
  settings: 'settings',
} as const;

export const WEIGHTS_DOC_ID = 'weights';
