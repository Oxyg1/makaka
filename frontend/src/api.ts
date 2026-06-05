import type { CatLeaderboardEntry, CatWithStats, Post, User, UserProfile } from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
let initDataRaw = 'mock';
let _currentUser: User | null = null;

export function setInitData(raw: string) { initDataRaw = raw; }
export function getCurrentUser() { return _currentUser; }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Init-Data': initDataRaw,
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) { const text = await res.text(); throw new Error(text || `HTTP ${res.status}`); }
  return res.json() as Promise<T>;
}

export function authUser(raw: string): Promise<User> {
  setInitData(raw);
  return request<User>('/api/auth', { method: 'POST' }).then(u => { _currentUser = u; return u; });
}

export function getNextCat(): Promise<CatWithStats | null> {
  return request<CatWithStats | null>('/api/cats/next');
}

export function rateCat(id: number, score: number): Promise<{ success: boolean }> {
  return request(`/api/cats/${id}/rate`, { method: 'POST', body: JSON.stringify({ score }) });
}

export function skipCat(id: number): Promise<{ success: boolean }> {
  return request(`/api/cats/${id}/skip`, { method: 'POST' });
}

export function getStats(): Promise<{ total_rated: number; total_skipped: number; streak_days: number; last_rated_date: string | null }> {
  return request('/api/cats/stats');
}

export function submitCat(formData: FormData): Promise<CatWithStats> {
  return request<CatWithStats>('/api/cats', { method: 'POST', body: formData });
}

export function getLeaderboard(period: 'daily' | 'weekly' | 'monthly'): Promise<CatLeaderboardEntry[]> {
  return request<CatLeaderboardEntry[]>(`/api/leaderboard?period=${period}`);
}

export function getMyCats(): Promise<CatWithStats[]> {
  return request<CatWithStats[]>('/api/cats/my');
}

export function getFeed(offset = 0): Promise<Post[]> {
  return request<Post[]>(`/api/feed?offset=${offset}`);
}

export function createPost(formData: FormData): Promise<Post> {
  return request<Post>('/api/feed', { method: 'POST', body: formData });
}

export function likePost(id: number): Promise<{ liked: boolean; likes_count: number }> {
  return request(`/api/feed/${id}/like`, { method: 'POST' });
}

export function getUserProfile(id: number): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${id}`);
}

export function getUserCats(id: number): Promise<CatWithStats[]> {
  return request<CatWithStats[]>(`/api/users/${id}/cats`);
}

export function getUserPosts(id: number): Promise<Post[]> {
  return request<Post[]>(`/api/users/${id}/posts`);
}
