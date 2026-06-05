import type { CatLeaderboardEntry, CatWithStats, User } from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
let initDataRaw = 'mock';

export function setInitData(raw: string) {
  initDataRaw = raw;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Init-Data': initDataRaw,
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function authUser(raw: string): Promise<User> {
  setInitData(raw);
  return request<User>('/api/auth', { method: 'POST' });
}

export function getNextCat(): Promise<CatWithStats | null> {
  return request<CatWithStats | null>('/api/cats/next');
}

export function rateCat(id: number, score: number): Promise<{ success: boolean }> {
  return request(`/api/cats/${id}/rate`, {
    method: 'POST',
    body: JSON.stringify({ score }),
  });
}

export function submitCat(formData: FormData): Promise<CatWithStats> {
  return request<CatWithStats>('/api/cats', {
    method: 'POST',
    body: formData,
  });
}

export function getLeaderboard(period: 'daily' | 'weekly' | 'monthly'): Promise<CatLeaderboardEntry[]> {
  return request<CatLeaderboardEntry[]>(`/api/leaderboard?period=${period}`);
}

export function getMyCats(): Promise<CatWithStats[]> {
  return request<CatWithStats[]>('/api/cats/my');
}
