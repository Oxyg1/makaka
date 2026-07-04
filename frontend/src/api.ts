import type { AppConfig, Attributes, CoinCatalog, Frog, GameId, GameProgress, GamesState, LeaderboardData, MarketEntry, Notification, OfferDirection, Order, User, Whale } from './types';

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

// ── Привязка кошелька (TON Connect) ──
export function getWalletChallenge(): Promise<{ payload: string }> {
  return request<{ payload: string }>('/api/users/wallet/challenge');
}
export function getLinkedWallets(): Promise<{ address: string }[]> {
  return request<{ address: string }[]>('/api/users/wallet');
}
export function linkWallet(body: unknown): Promise<{ ok: boolean; address: string }> {
  return request<{ ok: boolean; address: string }>('/api/users/wallet/link', { method: 'POST', body: JSON.stringify(body) });
}
export function unlinkWallet(address: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/users/wallet?address=${encodeURIComponent(address)}`, { method: 'DELETE' });
}

export function getNotifications(): Promise<Notification[]> { return request<Notification[]>('/api/notifications'); }
export function markNotificationsRead() { return request<{ success: boolean }>('/api/notifications/read', { method: 'POST' }); }

// ── Игры и «Монеты» ──
export function getGamesState(): Promise<GamesState> { return request<GamesState>('/api/games/state'); }
export function claimDailyBonus(): Promise<{ ok: boolean; coins: number; balance: number }> {
  return request('/api/games/daily-bonus', { method: 'POST' });
}
export function getGameProgress<S = unknown>(game: GameId): Promise<GameProgress<S>> {
  return request<GameProgress<S>>(`/api/games/${game}/progress`);
}
export function saveGameProgress(game: GameId, payload: { state?: unknown; score?: number; level?: number }): Promise<{ ok: boolean; score: number; balance: number; coins_earned: number }> {
  return request(`/api/games/${game}/progress`, { method: 'POST', body: JSON.stringify(payload) });
}
export function submitGameScore(game: GameId, score: number): Promise<{ ok: boolean; score: number; best: number; coins_earned: number; balance: number }> {
  return request(`/api/games/${game}/score`, { method: 'POST', body: JSON.stringify({ score }) });
}
export function getLeaderboard(game: GameId): Promise<LeaderboardData> {
  return request<LeaderboardData>(`/api/games/${game}/leaderboard`);
}
export function getCoinBalance(): Promise<{ balance: number }> { return request('/api/coins/balance'); }
export function getCoinCatalog(): Promise<CoinCatalog> { return request<CoinCatalog>('/api/coins/catalog'); }
export function spendCoins(boost: string): Promise<{ ok: boolean; balance: number; price: number }> {
  return request('/api/coins/spend', { method: 'POST', body: JSON.stringify({ boost }) });
}
export function purchaseCoins(pack: string): Promise<{ link: string; coins: number; stars: number }> {
  return request('/api/coins/purchase', { method: 'POST', body: JSON.stringify({ pack }) });
}
export function purchaseCoinsCustom(coins: number): Promise<{ link: string; coins: number; stars: number }> {
  return request('/api/coins/purchase', { method: 'POST', body: JSON.stringify({ custom: coins }) });
}
