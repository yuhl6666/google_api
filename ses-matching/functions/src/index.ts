import * as functions from 'firebase-functions';
import { app } from './api/app';

export const api = functions
  .region('asia-northeast1')
  .runWith({ memory: '256MB' })
  .https.onRequest(app);
