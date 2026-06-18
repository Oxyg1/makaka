// Клиент к poso.see.tg.
// Реальный API: https://poso.see.tg/api/docs
//
// Бережём API:
//   - in-memory кэш с TTL 5 минут на инвентарь/гифт/владельца
//   - всю коллекцию подтягиваем батчами по 50 (макс по доке)
//     ОДНИМ запросом фильтра — НЕ долбим по каждому гифту отдельно
//   - hard-cap 10 страниц = 500 гифтов на юзера за один синк
//   - бэкофф при 429/5xx
//
// Аутентификация: poso ждёт хедер `tgauth` со строкой JSON Telegram Login
// (id, first_name, username, auth_date, hash). Получить вручную:
//   1. Открыть https://poso.see.tg в Telegram (WebApp)
//   2. DevTools → Network → любой запрос → скопировать значение хедера `tgauth`
//   3. В systemd-юнит:
//      Environment=POSO_TGAUTH={"id":...,"hash":"..."}
//   Срок жизни ограничен auth_date (обычно ~сутки), при истечении — обновить.

import { logger } from '../logger';

const BASE = (process.env.POSO_API_BASE ?? 'https://poso.see.tg').replace(/\/+$/, '');
const TGAUTH = process.env.POSO_TGAUTH;
const COLLECTION_SLUG = 'KissedFrog';
const PAGE_LIMIT = 50;
const MAX_PAGES = 10;
const CACHE_TTL_MS = 5 * 60_000;

export interface PosoGift {
  gift_id: string;
  slug: string;          // полный slug "KissedFrog-12345" (для нашей БД)
  number: number;
  model: string;
  backdrop: string;
  pattern: string;
  model_rarity?: number;
  backdrop_rarity?: number;
  pattern_rarity?: number;
  image_url?: string;
  lottie_url?: string;
  owner_username?: string;
}

interface PosoGiftRaw {
  id?: string;
  gift_id?: string;
  slug?: string;                       // у poso это slug коллекции, например "KissedFrog"
  num?: number;
  title?: string;
  model_name?: string;
  pattern_name?: string;
  backdrop_name?: string;
  model_rarity?: number;
  pattern_rarity?: number;
  backdrop_rarity?: number;
  image_url?: string;
  lottie_url?: string;
  animation_url?: string;
  current_owner?: { username?: string; telegram_id?: string; name?: string };
}

interface PosoOwner {
  id: string;
  telegram_id?: string;
  username?: string;
  name?: string;
}

interface PosoListResponse<T> {
  data?: T[];
  items?: T[];
  total?: number;
}

// --------- cache ---------
const cache = new Map<string, { at: number; value: unknown }>();
function cacheGet<T>(k: string): T | null {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) { cache.delete(k); return null; }
  return e.value as T;
}
function cacheSet<T>(k: string, v: T) { cache.set(k, { at: Date.now(), value: v }); }

// --------- http ---------
async function fetchJson<T>(path: string): Promise<T | null> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (TGAUTH) {
    headers['tgauth'] = TGAUTH;
    // некоторые установки poso читают cookie вместо хедера — отправим и так:
    headers['cookie'] = `tgauth=${encodeURIComponent(TGAUTH)}`;
  }
  try {
    const r = await fetch(url, { headers });
    if (r.status === 429 || r.status >= 500) {
      logger.warn(`poso ${r.status}: ${path}`);
      return null;
    }
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch (e) {
    logger.warn(`poso fetch failed: ${path}`, { e: String(e) });
    return null;
  }
}

// --------- normalize ---------
function normalize(raw: PosoGiftRaw): PosoGift | null {
  const collection = raw.slug ?? '';
  if (!collection || collection.toLowerCase() !== COLLECTION_SLUG.toLowerCase()) return null;
  if (!raw.num || Number.isNaN(raw.num)) return null;

  return {
    gift_id: raw.gift_id ?? raw.id ?? `${COLLECTION_SLUG}-${raw.num}`,
    slug: `${COLLECTION_SLUG}-${raw.num}`,
    number: raw.num,
    model: raw.model_name ?? 'Unknown',
    backdrop: raw.backdrop_name ?? 'Unknown',
    pattern: raw.pattern_name ?? 'Unknown',
    model_rarity: raw.model_rarity,
    backdrop_rarity: raw.backdrop_rarity,
    pattern_rarity: raw.pattern_rarity,
    image_url: raw.image_url ?? raw.animation_url,
    lottie_url: raw.lottie_url,
    owner_username: raw.current_owner?.username,
  };
}

// --------- public API ---------
async function getOwnerByUsername(username: string): Promise<PosoOwner | null> {
  const k = `owner:${username.toLowerCase()}`;
  const cached = cacheGet<PosoOwner>(k);
  if (cached) return cached;
  const data = await fetchJson<PosoOwner>(`/api/owner?username=${encodeURIComponent(username)}`);
  if (data?.id) cacheSet(k, data);
  return data?.id ? data : null;
}

export async function fetchUserGifts(username: string): Promise<PosoGift[]> {
  const k = `gifts:${username.toLowerCase()}`;
  const cached = cacheGet<PosoGift[]>(k);
  if (cached) return cached;

  const owner = await getOwnerByUsername(username);
  if (!owner) return [];

  const result: PosoGift[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_LIMIT;
    const path = `/api/gifts?slug=${COLLECTION_SLUG}&current_owner_id=${encodeURIComponent(owner.id)}&limit=${PAGE_LIMIT}&offset=${offset}`;
    const list = await fetchJson<PosoListResponse<PosoGiftRaw> | PosoGiftRaw[]>(path);
    if (!list) break;
    const items: PosoGiftRaw[] = Array.isArray(list) ? list : (list.data ?? list.items ?? []);
    if (items.length === 0) break;
    for (const it of items) {
      const norm = normalize(it);
      if (norm) result.push({ ...norm, owner_username: username });
    }
    if (items.length < PAGE_LIMIT) break;
  }

  cacheSet(k, result);
  return result;
}

export async function fetchGiftBySlug(fullSlug: string): Promise<PosoGift | null> {
  const m = fullSlug.match(/^([A-Za-z]+)-?(\d+)$/);
  if (!m) return null;
  const collection = m[1];
  const num = Number(m[2]);
  if (collection.toLowerCase() !== COLLECTION_SLUG.toLowerCase()) return null;

  const k = `gift:${collection}-${num}`;
  const cached = cacheGet<PosoGift>(k);
  if (cached) return cached;

  const data = await fetchJson<PosoGiftRaw>(`/api/gift?slug=${collection}&num=${num}`);
  if (!data) return null;
  const norm = normalize(data);
  if (norm) cacheSet(k, norm);
  return norm;
}
