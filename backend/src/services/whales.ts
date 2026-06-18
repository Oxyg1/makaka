// Топ-холдеры KissedFrog.
// Основной источник — таблица `whales` в БД, которую раз в день наполняет
// userbot через /api/ingest/whales. Если таблица пустая (userbot ещё не
// прогонялся) — откатываемся на live-запрос к poso.see.tg.

import { logger } from '../logger';
import { db } from '../db';

const BASE = (process.env.POSO_API_BASE ?? 'https://poso.see.tg').replace(/\/+$/, '');
const DEFAULT_TGAUTH = '{"id":1031503708,"first_name":"Пульс","username":"bez_pulsa","photo_url":"https://t.me/i/userpic/320/AsZop47lEx4BJD3upREosBDA-9rHovZI-I47_FOBiW8.jpg","auth_date":1773229298,"hash":"a20e2147089b34d548fdd0fabc14d2b5f5eb3c395c379eabf8c9f75fa9411228"}';
const TGAUTH = process.env.POSO_TGAUTH ?? DEFAULT_TGAUTH;
const COLLECTION_SLUG = 'KissedFrog';
const CACHE_TTL_MS = 10 * 60_000;

const HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'Accept-Language': 'ru-RU,ru;q=0.9',
  Origin: 'https://poso.see.tg',
  Referer: 'https://poso.see.tg/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

export interface Whale {
  id: string;
  telegram_id?: string;
  username?: string;
  name?: string;
  photo_url?: string;
  gifts_count: number;
}

interface PosoLeaderboardRaw {
  results?: Array<{ owner?: PosoOwnerRaw; gifts_count?: number; count?: number }>;
  items?: Array<{ owner?: PosoOwnerRaw; gifts_count?: number; count?: number }>;
}

interface PosoOwnerRaw {
  id?: string;
  telegram_id?: string | number;
  username?: string;
  name?: string;
  first_name?: string;
  photo_url?: string;
  gifts_count?: number;
}

// ── Хранилище холдеров в БД (наполняется ingest'ом) ──────────────
interface WhaleRow {
  telegram_id: string;
  username: string | null;
  name: string | null;
  photo_url: string | null;
  gifts_count: number;
}

export function hasStoredWhales(): boolean {
  const r = db.prepare(`SELECT COUNT(*) AS c FROM whales`).get() as { c: number };
  return r.c > 0;
}

export function getStoredWhales(limit = 100): Whale[] {
  const rows = db.prepare(
    `SELECT telegram_id, username, name, photo_url, gifts_count
     FROM whales WHERE gifts_count > 0 ORDER BY gifts_count DESC LIMIT ?`,
  ).all(limit) as WhaleRow[];
  return rows.map(r => ({
    id: r.telegram_id,
    telegram_id: r.telegram_id,
    username: r.username ?? undefined,
    name: r.name ?? undefined,
    photo_url: r.photo_url ?? undefined,
    gifts_count: r.gifts_count,
  }));
}

export interface IncomingWhale {
  telegram_id: string | number;
  username?: string | null;
  name?: string | null;
  photo_url?: string | null;
  gifts_count: number;
}

// Полная замена списка холдеров (ingest присылает свежий снимок целиком).
export function replaceWhales(list: IncomingWhale[]): number {
  const up = db.prepare(
    `INSERT INTO whales (telegram_id, username, name, photo_url, gifts_count, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(telegram_id) DO UPDATE SET
       username = excluded.username,
       name = excluded.name,
       photo_url = excluded.photo_url,
       gifts_count = excluded.gifts_count,
       updated_at = datetime('now')`,
  );
  let n = 0;
  const tx = db.transaction((items: IncomingWhale[]) => {
    db.prepare(`DELETE FROM whales`).run();
    for (const w of items) {
      if (w.telegram_id === undefined || w.telegram_id === null || w.telegram_id === '') continue;
      up.run(String(w.telegram_id), w.username ?? null, w.name ?? null, w.photo_url ?? null, Math.max(0, Math.trunc(Number(w.gifts_count) || 0)));
      n++;
    }
  });
  tx(list);
  return n;
}

let cache: { at: number; v: Whale[] } | null = null;
let inflight: Promise<Whale[]> | null = null;

export async function getWhales(): Promise<Whale[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.v;
  if (inflight) return inflight;
  inflight = (async () => {
    const sp = new URLSearchParams({
      type: 'global_gifts',
      slug: COLLECTION_SLUG,
      only_real_users: 'true',
      limit: '50',
      tgauth: TGAUTH,
    });
    try {
      const r = await fetch(`${BASE}/api/leaderboard?${sp}`, { headers: HEADERS });
      logger.info(`poso ${r.status} /api/leaderboard whales`);
      if (!r.ok) {
        inflight = null;
        return cache?.v ?? [];
      }
      const data = await r.json() as PosoLeaderboardRaw | PosoOwnerRaw[];
      const list: Array<{ owner?: PosoOwnerRaw; gifts_count?: number; count?: number } | PosoOwnerRaw> = Array.isArray(data)
        ? data
        : (data.results ?? data.items ?? []);
      const whales: Whale[] = list.map(entry => {
        const owner = ('owner' in entry && entry.owner) ? entry.owner : (entry as PosoOwnerRaw);
        const giftsCount = (entry as { gifts_count?: number; count?: number }).gifts_count
          ?? (entry as { count?: number }).count
          ?? owner.gifts_count
          ?? 0;
        return {
          id: String(owner.id ?? ''),
          telegram_id: owner.telegram_id !== undefined ? String(owner.telegram_id) : undefined,
          username: owner.username,
          name: owner.name ?? owner.first_name,
          photo_url: owner.photo_url,
          gifts_count: giftsCount,
        };
      }).filter(w => w.id && w.gifts_count > 0);
      cache = { at: Date.now(), v: whales };
      inflight = null;
      return whales;
    } catch (e) {
      logger.warn(`whales fetch failed: ${e}`);
      inflight = null;
      return cache?.v ?? [];
    }
  })();
  return inflight;
}
