import type { CatLeaderboardEntry, CatWithStats, Comment, Notification, Post, User, UserProfile, UserStats } from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
let initDataRaw = 'mock';
let _currentUser: User | null = null;

export function getCurrentUser() { return _currentUser; }

export function setInitData(raw: string) { initDataRaw = raw; }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Init-Data': initDataRaw,
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) { const t = await res.text(); throw new Error(t || `HTTP ${res.status}`); }
  return res.json() as Promise<T>;
}

export function authUser(raw: string): Promise<User> {
  setInitData(raw);
  return request<User>('/api/auth', { method: 'POST' }).then(u => { _currentUser = u; return u; });
}

export function getNextCat(rerate = false): Promise<CatWithStats | null> {
  return request<CatWithStats | null>(`/api/cats/next${rerate ? '?rerate=1' : ''}`);
}

export function rateCat(id: number, score: number): Promise<{ success: boolean }> {
  return request(`/api/cats/${id}/rate`, { method: 'POST', body: JSON.stringify({ score }) });
}

export function skipCat(id: number): Promise<{ success: boolean }> {
  return request(`/api/cats/${id}/skip`, { method: 'POST' });
}

export function resetRatings(): Promise<{ success: boolean }> {
  return request('/api/cats/reset-ratings', { method: 'POST' });
}

export function likeCat(id: number): Promise<{ liked: boolean; likes_count: number }> {
  return request(`/api/cats/${id}/like`, { method: 'POST' });
}

export function submitCat(formData: FormData): Promise<CatWithStats> {
  return request<CatWithStats>('/api/cats', { method: 'POST', body: formData });
}

export function getMyCats(): Promise<CatWithStats[]> {
  return request<CatWithStats[]>('/api/cats/my');
}

export function getStats(): Promise<UserStats> {
  return request<UserStats>('/api/cats/stats');
}

export function getLeaderboard(period: 'all' | 'daily' | 'weekly' | 'monthly'): Promise<CatLeaderboardEntry[]> {
  return request<CatLeaderboardEntry[]>(`/api/leaderboard?period=${period}`);
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

export function updateCat(id: number, data: { name?: string; breed?: string; age?: string; description?: string }): Promise<CatWithStats> {
  return request<CatWithStats>(`/api/cats/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteCat(id: number): Promise<{ success: boolean }> {
  return request(`/api/cats/${id}`, { method: 'DELETE' });
}

export function deletePost(id: number): Promise<{ success: boolean }> {
  return request(`/api/feed/${id}`, { method: 'DELETE' });
}

export function getComments(postId: number): Promise<Comment[]> {
  return request<Comment[]>(`/api/feed/${postId}/comments`);
}

export function createComment(postId: number, text: string): Promise<Comment> {
  return request<Comment>(`/api/feed/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
}

export function deleteComment(id: number): Promise<{ success: boolean }> {
  return request(`/api/feed/comments/${id}`, { method: 'DELETE' });
}

export function getNotifications(): Promise<Notification[]> {
  return request<Notification[]>('/api/notifications');
}

export function markNotificationsRead(): Promise<{ success: boolean }> {
  return request('/api/notifications/read', { method: 'POST' });
}
