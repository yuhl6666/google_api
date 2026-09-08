import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import {
  Company,
  Match,
  MatchPhase,
  PhaseHistoryEntry,
  Role,
  Talent,
} from '../types';

async function call<TReq, TRes>(name: string, data: TReq): Promise<TRes> {
  const fn = httpsCallable<TReq, TRes>(functions, name);
  const result = await fn(data);
  return result.data;
}

export const api = {
  setUserRole: (role: Role) => call<{ role: Role }, { role: Role }>('setUserRole', { role }),

  upsertTalent: (data: Omit<Talent, 'id' | 'uid'>) => call<typeof data, { id: string }>('upsertTalent', data),
  getTalent: (id: string) => call<{ id: string }, Talent>('getTalent', { id }),
  listTalents: (limit = 50) => call<{ limit: number }, { talents: Talent[] }>('listTalents', { limit }),

  upsertCompany: (data: Omit<Company, 'id' | 'uid'>) => call<typeof data, { id: string }>('upsertCompany', data),
  getCompany: (id: string) => call<{ id: string }, Company>('getCompany', { id }),
  listCompanies: (limit = 50) => call<{ limit: number }, { companies: Company[] }>('listCompanies', { limit }),

  refreshMatchesForCaller: () => call<Record<string, never>, { matched: number }>('refreshMatchesForCaller', {}),
  listMatchesForCaller: (phase?: MatchPhase) =>
    call<{ phase?: MatchPhase }, { matches: Match[] }>('listMatchesForCaller', { phase }),

  sendMessage: (matchId: string, body: string) => call<{ matchId: string; body: string }, { id: string }>('sendMessage', { matchId, body }),

  submitReview: (matchId: string, rating: number, comment?: string) =>
    call<{ matchId: string; rating: number; comment?: string }, { ok: true }>('submitReview', { matchId, rating, comment }),

  expressContinuationIntent: (matchId: string) =>
    call<{ matchId: string }, { ok: true }>('expressContinuationIntent', { matchId }),
  evaluatePhaseUpgrade: (matchId: string) =>
    call<{ matchId: string }, { phase: MatchPhase; eligible: boolean; reason: string; scoreBreakdown: Match['scoreBreakdown'] }>(
      'evaluatePhaseUpgrade',
      { matchId }
    ),
  changePhase: (matchId: string, action: 'promote' | 'decline' | 'complete', reason?: string) =>
    call<{ matchId: string; action: string; reason?: string }, { status: string; phase?: MatchPhase }>('changePhase', {
      matchId,
      action,
      reason,
    }),
  listPhaseHistory: (matchId: string) =>
    call<{ matchId: string }, { history: PhaseHistoryEntry[] }>('listPhaseHistory', { matchId }),
};
