import type { AppConfig, Attributes, Frog, MarketEntry, Notification, OfferDirection, Order, User, Whale } from './types';

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
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function authUser(raw: string): Promise<User> {
  setInitData(raw);
  return request<User>('/api/auth', { method: 'POST' }).then(u => { _currentUser = u; return u; });
}

export function getConfig(): Promise<AppConfig> { return request<AppConfig>('/api/config'); }

export function getInventory(): Promise<Frog[]> { return request<Frog[]>('/api/inventory'); }
export function syncInventory(): Promise<{ added: number; gifts: unknown[] }> {
  return request('/api/inventory/sync', { method: 'POST' });
}

export interface MarketQuery {
  offer_models?: string[];
  offer_backdrops?: string[];
  offer_patterns?: string[];
  wants_models?: string[];
  wants_backdrops?: string[];
  wants_patterns?: string[];
  search?: string;
  sort?: 'new' | 'rare';
  offset?: number;
}

export function getMarket(q: MarketQuery = {}): Promise<MarketEntry[]> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) { if (v.length) sp.set(k, v.join(',')); }
    else sp.set(k, String(v));
  }
  return request<MarketEntry[]>(`/api/market?${sp}`);
}

export function getMyOrders(): Promise<(Order & Frog)[]> { return request(`/api/market/my`); }

export function createOrder(payload: {
  frog_id: number;
  wants_models?: string[];
  wants_backdrops?: string[];
  wants_patterns?: string[];
  note: string;
}): Promise<Order> {
  return request<Order>('/api/market', { method: 'POST', body: JSON.stringify(payload) });
}
export function cancelOrder(id: number): Promise<{ success: boolean }> {
  return request(`/api/market/${id}`, { method: 'DELETE' });
}

export function getAttributes(): Promise<Attributes> { return request<Attributes>('/api/frogs/attributes'); }
export function lookupFrog(q: string): Promise<Frog> { return request<Frog>(`/api/frogs/lookup?q=${encodeURIComponent(q)}`); }
export function getFrog(id: number): Promise<Frog> { return request<Frog>(`/api/frogs/${id}`); }

export function createOffer(payload: {
  to_frog_id: number;
  from_frog_id: number;
  message: string;
  order_id?: number | null;
}): Promise<{ id: number }> {
  return request('/api/offers', { method: 'POST', body: JSON.stringify(payload) });
}
export function getOffers(dir: 'in' | 'out'): Promise<OfferDirection[]> {
  return request<OfferDirection[]>(`/api/offers?dir=${dir}`);
}
export function acceptOffer(id: number) { return request<{ success: boolean }>(`/api/offers/${id}/accept`, { method: 'POST' }); }
export function declineOffer(id: number) { return request<{ success: boolean }>(`/api/offers/${id}/decline`, { method: 'POST' }); }
export function cancelOffer(id: number) { return request<{ success: boolean }>(`/api/offers/${id}/cancel`, { method: 'POST' }); }

export function getWhales(): Promise<Whale[]> { return request<Whale[]>('/api/users/whales'); }
export function getUserFrogs(telegramId: string): Promise<Frog[]> {
  return request<Frog[]>(`/api/users/by-tg/${encodeURIComponent(telegramId)}/frogs`);
}
export function getWalletFrogs(address: string): Promise<Frog[]> {
  return request<Frog[]>(`/api/users/by-addr/${encodeURIComponent(address)}/frogs`);
}

export function getNotifications(): Promise<Notification[]> { return request<Notification[]>('/api/notifications'); }
export function markNotificationsRead() { return request<{ success: boolean }>('/api/notifications/read', { method: 'POST' }); }
