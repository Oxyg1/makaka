// Клиент к poso.see.tg.
// Реальный API описан тут: https://poso.see.tg/api/docs
// Здесь оставляем минимальный fetch + парсер ответа, плюс мок-fallback,
// чтобы фронт можно было гонять без бот-токена.

import { logger } from '../logger';

const BASE = process.env.POSO_API_BASE ?? 'https://poso.see.tg/api';
const GIFT_SLUG = 'KissedFrog';

export interface PosoGift {
  gift_id: string;
  slug: string;          // "KissedFrog-12345"
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
  id?: string | number;
  slug?: string;
  number?: number;
  collection?: string;
  collection_slug?: string;
  attributes?: {
    model?: { name?: string; rarity?: number };
    backdrop?: { name?: string; rarity?: number };
    pattern?: { name?: string; rarity?: number };
  };
  model?: string;
  backdrop?: string;
  pattern?: string;
  image_url?: string;
  lottie_url?: string;
  owner?: { username?: string };
}

function normalize(raw: PosoGiftRaw): PosoGift | null {
  const slugSource = raw.collection_slug ?? raw.collection ?? raw.slug ?? '';
  if (slugSource && !slugSource.toLowerCase().includes('kissedfrog')) return null;

  const number = raw.number ?? Number(String(raw.slug ?? '').split('-').pop());
  if (!number || Number.isNaN(number)) return null;

  const model = raw.attributes?.model?.name ?? raw.model ?? 'Unknown';
  const backdrop = raw.attributes?.backdrop?.name ?? raw.backdrop ?? 'Unknown';
  const pattern = raw.attributes?.pattern?.name ?? raw.pattern ?? 'Unknown';

  return {
    gift_id: String(raw.id ?? `${GIFT_SLUG}-${number}`),
    slug: raw.slug ?? `${GIFT_SLUG}-${number}`,
    number,
    model,
    backdrop,
    pattern,
    model_rarity: raw.attributes?.model?.rarity,
    backdrop_rarity: raw.attributes?.backdrop?.rarity,
    pattern_rarity: raw.attributes?.pattern?.rarity,
    image_url: raw.image_url,
    lottie_url: raw.lottie_url,
    owner_username: raw.owner?.username,
  };
}

async function tryFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch (e) {
    logger.warn(`poso fetch failed: ${url}`, { e: String(e) });
    return null;
  }
}

export async function fetchUserGifts(username: string): Promise<PosoGift[]> {
  const data = await tryFetch<{ gifts?: PosoGiftRaw[] } | PosoGiftRaw[]>(`${BASE}/users/${encodeURIComponent(username)}/gifts?collection=${GIFT_SLUG}`);
  if (!data) return mockGiftsForUser(username);
  const list = Array.isArray(data) ? data : data.gifts ?? [];
  return list.map(normalize).filter((g): g is PosoGift => g !== null);
}

export async function fetchGiftBySlug(slug: string): Promise<PosoGift | null> {
  const data = await tryFetch<PosoGiftRaw>(`${BASE}/gifts/${encodeURIComponent(slug)}`);
  if (!data) return mockGiftBySlug(slug);
  return normalize(data);
}

// ----------------- Mock data (fallback for local dev) -----------------

const MODELS = ['Lily Pad','Swamp King','Royal Hopper','Bubble Mage','Moss Druid','Pondling','Ribbit Star','Toxic Bloom','Golden Croak','Reed Sage'];
const BACKDROPS = ['Mint','Lagoon','Sunset','Jungle','Aurora','Twilight','Coral','Obsidian'];
const PATTERNS = ['Dots','Stripes','Camo','Stars','Vines','Glyphs','Lotus','Plain'];

function pick<T>(arr: T[], seed: number): T { return arr[seed % arr.length]; }

function mockFrog(n: number, owner?: string): PosoGift {
  return {
    gift_id: `KissedFrog-${n}`,
    slug: `KissedFrog-${n}`,
    number: n,
    model: pick(MODELS, n * 7),
    backdrop: pick(BACKDROPS, n * 13),
    pattern: pick(PATTERNS, n * 31),
    model_rarity: 0.2 + ((n * 7) % 50) / 100,
    backdrop_rarity: 0.3 + ((n * 13) % 40) / 100,
    pattern_rarity: 0.15 + ((n * 31) % 60) / 100,
    image_url: undefined,
    owner_username: owner,
  };
}

function mockGiftsForUser(username: string): PosoGift[] {
  const base = [...username].reduce((a, c) => a + c.charCodeAt(0), 0);
  const count = 2 + (base % 5);
  return Array.from({ length: count }, (_, i) => mockFrog(1000 + (base * 31 + i * 17) % 9000, username));
}

function mockGiftBySlug(slug: string): PosoGift | null {
  const n = Number(slug.split('-').pop());
  if (!n) return null;
  return mockFrog(n);
}
