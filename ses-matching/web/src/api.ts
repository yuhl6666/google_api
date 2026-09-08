import { auth } from './firebase';
import {
  Engineer,
  FeedbackLog,
  MatchResult,
  MatchStatus,
  Project,
  ScoreWeights,
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiRequestError(401, 'ログインが必要です');
  const idToken = await user.getIdToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiRequestError(res.status, body.error ?? `APIエラー(${res.status})`);
  }
  return body as T;
}

// --- Projects ---
export const listProjects = () => request<{ projects: Project[] }>('/projects');
export const getProject = (id: string) => request<{ project: Project }>(`/projects/${id}`);
export const createProject = (data: Partial<Project>) =>
  request<{ project: Project }>('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<Project>) =>
  request<{ project: Project }>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProject = (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' });

// --- Engineers ---
export const listEngineers = () => request<{ engineers: Engineer[] }>('/engineers');
export const getEngineer = (id: string) => request<{ engineer: Engineer }>(`/engineers/${id}`);
export const createEngineer = (data: Partial<Engineer>) =>
  request<{ engineer: Engineer }>('/engineers', { method: 'POST', body: JSON.stringify(data) });
export const updateEngineer = (id: string, data: Partial<Engineer>) =>
  request<{ engineer: Engineer }>(`/engineers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteEngineer = (id: string) => request<void>(`/engineers/${id}`, { method: 'DELETE' });

// --- Matches ---
export const listMatches = (params?: { projectId?: string; engineerId?: string; status?: MatchStatus }) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return request<{ matches: MatchResult[] }>(`/matches${qs ? `?${qs}` : ''}`);
};
export const runMatching = (params: { projectId?: string; engineerId?: string }) =>
  request<{ matches: MatchResult[]; count: number }>('/matches/run', {
    method: 'POST',
    body: JSON.stringify(params),
  });
export const updateMatchStatus = (id: string, status: MatchStatus) =>
  request<{ match: MatchResult }>(`/matches/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });

// --- Feedback ---
export const submitFeedback = (data: { matchId: string; decision: '採用' | '却下'; reasonNote?: string }) =>
  request<{ feedback: FeedbackLog; updatedWeights: ScoreWeights }>('/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// --- Weights ---
export const getWeights = () => request<{ weights: ScoreWeights }>('/weights');
export const putWeights = (weights: ScoreWeights) =>
  request<{ weights: ScoreWeights }>('/weights', { method: 'PUT', body: JSON.stringify(weights) });
