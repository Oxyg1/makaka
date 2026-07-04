// Клиент к poso.see.tg.
// Реальный API: https://poso.see.tg/api/docs
//
// Авторизация:
//   - tgauth (JSON-строка Telegram Login) передаётся как QUERY-параметр ?tgauth=...
//   - заголовки Origin/Referer/UA имитируют браузер
//   - получить tgauth: открыть https://poso.see.tg в Telegram WebApp,
//     скопировать значение из запросов в DevTools
//   - переопределяется через env POSO_TGAUTH
//
// Бережём API:
//   - in-memory кэш с TTL 5 минут на инвентарь/гифт/владельца
//   - всю коллекцию подтягиваем батчами по 50 (макс по доке)
//     ОДНИМ запросом фильтра — НЕ долбим по каждому гифту отдельно
//   - hard-cap 10 страниц = 500 гифтов на юзера за один синк

import { logger } from '../logger';

const BASE = (process.env.POSO_API_BASE ?? 'https://poso.see.tg').replace(/\/+$/, '');
// Дефолт из других проектов автора — работает на их аккаунте, пока tgauth жив.
const DEFAULT_TGAUTH = '{"id":1031503708,"first_name":"Пульс","username":"bez_pulsa","photo_url":"https://t.me/i/userpic/320/AsZop47lEx4BJD3upREosBDA-9rHovZI-I47_FOBiW8.jpg","auth_date":1773229298,"hash":"a20e2147089b34d548fdd0fabc14d2b5f5eb3c395c379eabf8c9f75fa9411228"}';
const TGAUTH = process.env.POSO_TGAUTH ?? DEFAULT_TGAUTH;
const COLLECTION_SLUG = 'KissedFrog';
const PAGE_LIMIT = 50;
const MAX_PAGES = 10;
const CACHE_TTL_MS = 5 * 60_000;

const HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'Accept-Language': 'ru-RU,ru;q=0.9',
  Origin: 'https://poso.see.tg',
  Referer: 'https://poso.see.tg/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

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
  owner_telegram_id?: string;
}

interface PosoGiftRaw {
  id?: string;
  gift_id?: string;
  slug?: string;                       // slug коллекции, например "KissedFrog"
  num?: number;
  title?: string;
  model_name?: string;
  pattern_name?: string;
  backdrop_name?: string;
  // Редкость у poso в permille (на 1000), а не процент
  model_rarity_permille?: number;
  pattern_rarity_permille?: number;
  backdrop_rarity_permille?: number;
  image_url?: string;
  lottie_url?: string;
  animation_url?: string;
  current_owner?: { id?: string; username?: string; telegram_id?: string | number; name?: string };
}

interface PosoOwner {
  id: string;
  telegram_id?: string | number;
  username?: string;
  name?: string;
  gifts_count?: number;
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
async function posoGet<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T | null> {
  if (!TGAUTH) {
    logger.warn(`poso: no tgauth set, skipping ${endpoint}`);
    return null;
  }
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));
  sp.set('tgauth', TGAUTH);
  const url = `${BASE}${endpoint}?${sp}`;

  try {
    const r = await fetch(url, { headers: HEADERS });
    logger.info(`poso ${r.status} ${endpoint}`, { params });
    if (r.status === 404) return null;
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      logger.warn(`poso non-ok ${r.status} ${endpoint}`, { body: body.slice(0, 200) });
      return null;
    }
    return (await r.json()) as T;
  } catch (e) {
    logger.warn(`poso fetch failed: ${endpoint}`, { e: String(e) });
    return null;
  }
}

// --------- normalize ---------
function permilleToFraction(p?: number): number | undefined {
  if (p === undefined || p === null || Number.isNaN(p)) return undefined;
  return p / 1000;
}

function normalize(raw: PosoGiftRaw): PosoGift | null {
  const collection = raw.slug ?? '';
  if (!collection || collection.toLowerCase() !== COLLECTION_SLUG.toLowerCase()) return null;
  if (!raw.num || Number.isNaN(raw.num)) return null;

  return {
    // raw.id — уникальный UUID конкретного гифта; raw.gift_id у poso это id коллекции (один на всю KissedFrog)
    gift_id: raw.id ?? raw.gift_id ?? `${COLLECTION_SLUG}-${raw.num}`,
    slug: `${COLLECTION_SLUG}-${raw.num}`,
    number: raw.num,
    model: raw.model_name ?? 'Unknown',
    backdrop: raw.backdrop_name ?? 'Unknown',
    pattern: raw.pattern_name ?? 'Unknown',
    model_rarity: permilleToFraction(raw.model_rarity_permille),
    backdrop_rarity: permilleToFraction(raw.backdrop_rarity_permille),
    pattern_rarity: permilleToFraction(raw.pattern_rarity_permille),
    image_url: raw.image_url ?? raw.animation_url,
    lottie_url: raw.lottie_url,
    owner_username: raw.current_owner?.username,
    owner_telegram_id: raw.current_owner?.telegram_id !== undefined ? String(raw.current_owner.telegram_id) : undefined,
  };
}

// --------- public API ---------
export async function fetchOwnerByTelegramId(telegramId: string): Promise<PosoOwner | null> {
  const k = `owner:tg:${telegramId}`;
  const cached = cacheGet<PosoOwner>(k);
  if (cached) return cached;
  const data = await posoGet<PosoOwner>('/api/owner', { telegram_id: telegramId });
  if (data?.id) cacheSet(k, data);
  return data?.id ? data : null;
}

export async function fetchOwnerByUsername(username: string): Promise<PosoOwner | null> {
  const k = `owner:un:${username.toLowerCase()}`;
  const cached = cacheGet<PosoOwner>(k);
  if (cached) return cached;
  const data = await posoGet<PosoOwner>('/api/owner', { username });
  if (data?.id) cacheSet(k, data);
  return data?.id ? data : null;
}

interface GiftsListResponse {
  results?: PosoGiftRaw[];
  gifts?: PosoGiftRaw[];
  items?: PosoGiftRaw[];
}

function pickList(data: GiftsListResponse | PosoGiftRaw[] | null): PosoGiftRaw[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? data.gifts ?? data.items ?? [];
}

/**
 * Список лягушек по telegram_id или username владельца.
 * Для надёжности — пробуем сперва telegram_id (точнее), потом username.
 */
export async function fetchUserGifts(opts: { telegramId?: string; username?: string }): Promise<PosoGift[]> {
  const cacheKey = `gifts:${opts.telegramId ?? ''}:${opts.username ?? ''}`;
  const cached = cacheGet<PosoGift[]>(cacheKey);
  if (cached) return cached;

  let owner: PosoOwner | null = null;
  if (opts.telegramId) owner = await fetchOwnerByTelegramId(opts.telegramId);
  if (!owner && opts.username) owner = await fetchOwnerByUsername(opts.username);
  if (!owner) {
    cacheSet(cacheKey, []);
    return [];
  }

  const result: PosoGift[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_LIMIT;
    const data = await posoGet<GiftsListResponse | PosoGiftRaw[]>('/api/gifts', {
      current_owner_id: owner.id,
      slug: COLLECTION_SLUG,
      limit: PAGE_LIMIT,
      offset,
      sort_by: 'num',
      order: 'asc',
    });
    const items = pickList(data);
    if (items.length === 0) break;
    for (const it of items) {
      const norm = normalize(it);
      if (norm) result.push({
        ...norm,
        owner_username: norm.owner_username ?? owner.username,
        owner_telegram_id: norm.owner_telegram_id
          ?? (owner.telegram_id !== undefined ? String(owner.telegram_id) : undefined)
          ?? opts.telegramId,
      });
    }
    if (items.length < PAGE_LIMIT) break;
  }

  cacheSet(cacheKey, result);
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

  const data = await posoGet<PosoGiftRaw>('/api/gift', { slug: collection, num });
  if (!data) return null;
  const norm = normalize(data);
  if (norm) cacheSet(k, norm);
  return norm;
}
