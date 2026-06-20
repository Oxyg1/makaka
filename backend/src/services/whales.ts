// Топ-холдеры KissedFrog.
// Основной источник — таблица `whales` в БД, которую раз в день наполняет
// userbot через /api/ingest/whales. Если таблица пустая (userbot ещё не
// прогонялся) — откатываемся на live-запрос к poso.see.tg.

import { logger } from '../logger';
import { db } from '../db';
import { isMarketAccount } from './markets';

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
  kind?: 'user' | 'wallet';
  address?: string;
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
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
  const r = db.prepare(`SELECT
    (SELECT COUNT(*) FROM whales) + (SELECT COUNT(*) FROM wallet_holders) AS c`).get() as { c: number };
  return r.c > 0;
}

export function getStoredWhales(limit = 100): Whale[] {
  // Юзеры-холдеры (без маркетов)…
  const userRows = (db.prepare(
    `SELECT telegram_id, username, name, photo_url, gifts_count
     FROM whales WHERE gifts_count > 0 ORDER BY gifts_count DESC LIMIT ?`,
  ).all(limit * 2) as WhaleRow[])
    .filter(r => !isMarketAccount(r.name, r.username))
    .map<Whale>(r => ({
      id: r.telegram_id,
      telegram_id: r.telegram_id,
      username: r.username ?? undefined,
      name: r.name ?? undefined,
      photo_url: r.photo_url ?? undefined,
      gifts_count: r.gifts_count,
      kind: 'user',
    }));

  // …и холдеры-кошельки. Если кошелёк привязан к юзеру — показываем профиль.
  const walletRows = db.prepare(
    `SELECT w.address, w.gifts_count, l.telegram_id AS linked_tg,
            u.first_name AS u_name, u.username AS u_un, u.photo_url AS u_photo
     FROM wallet_holders w
     LEFT JOIN wallet_links l ON l.address = w.address
     LEFT JOIN users u ON u.telegram_id = l.telegram_id
     WHERE w.gifts_count > 0 ORDER BY w.gifts_count DESC LIMIT ?`,
  ).all(limit * 2) as Array<{ address: string; gifts_count: number; linked_tg: string | null; u_name: string | null; u_un: string | null; u_photo: string | null }>;

  const wallets = walletRows.map<Whale>(w => w.linked_tg
    ? {
        id: w.linked_tg, telegram_id: w.linked_tg,
        username: w.u_un ?? undefined, name: w.u_name ?? undefined, photo_url: w.u_photo ?? undefined,
        gifts_count: w.gifts_count, kind: 'user', address: w.address,
      }
    : {
        id: `wallet:${w.address}`, name: shortAddr(w.address),
        gifts_count: w.gifts_count, kind: 'wallet', address: w.address,
      });

  return [...userRows, ...wallets]
    .sort((a, b) => b.gifts_count - a.gifts_count)
    .slice(0, limit);
}

export interface IncomingWhale {
  telegram_id?: string | number | null;
  username?: string | null;
  name?: string | null;
  photo_url?: string | null;
  gifts_count: number;
  kind?: 'user' | 'wallet';
  address?: string | null;
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
  const upMarket = db.prepare(
    `INSERT INTO markets (telegram_id, name, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(telegram_id) DO UPDATE SET name = excluded.name, updated_at = datetime('now')`,
  );
  const upWallet = db.prepare(
    `INSERT INTO wallet_holders (address, gifts_count, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(address) DO UPDATE SET gifts_count = excluded.gifts_count, updated_at = datetime('now')`,
  );
  let n = 0;
  const tx = db.transaction((items: IncomingWhale[]) => {
    db.prepare(`DELETE FROM whales`).run();
    db.prepare(`DELETE FROM wallet_holders`).run();
    for (const w of items) {
      const count = Math.max(0, Math.trunc(Number(w.gifts_count) || 0));
      // Кошелёк-холдер (без telegram-аккаунта).
      if ((w.kind === 'wallet' || !w.telegram_id) && w.address) {
        upWallet.run(String(w.address), count);
        n++;
        continue;
      }
      if (w.telegram_id === undefined || w.telegram_id === null || w.telegram_id === '') continue;
      const tg = String(w.telegram_id);
      // Маркеты/хранилища — в отдельную таблицу, в холдеры не кладём.
      if (isMarketAccount(w.name, w.username)) {
        upMarket.run(tg, w.name ?? w.username ?? null);
        continue;
      }
      up.run(tg, w.username ?? null, w.name ?? null, w.photo_url ?? null, count);
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
