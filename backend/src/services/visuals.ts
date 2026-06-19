// Прокси / кэш визуалок KissedFrog через api.changes.tg.
//
// Зачем: прямой fetch с фронта блокируется CORS у CDN. Плюс мы не хотим
// долбить публичный API при каждом ре-рендере карточки. Поэтому:
//   - один bulk-запрос /preload — отдаём весь словарь backdrop-цветов и
//     списки моделей/паттернов фронту, который кэширует в localStorage
//   - PNG-картинки проксируем через /api/visuals/:kind/:name.png, кэшируя
//     ответ в памяти процесса (модели/паттерны меняются крайне редко)
//
// thanks to @GiftChanges (api.changes.tg) for the gift visuals.

import { logger } from '../logger';
import { db } from '../db';

const BASE = 'https://api.changes.tg';
const COLLECTION = 'KissedFrog';

export interface BackdropInfo {
  name?: string;
  centerColor?: string;
  edgeColor?: string;
  patternColor?: string;
  textColor?: string;
  rarityPermille?: number;
  hex?: string;
  [k: string]: unknown;
}

interface PreloadData {
  models: string[];
  patterns: string[];
  backdrops: Record<string, BackdropInfo>;
  fetched_at: string;
}

let preloadCache: PreloadData | null = null;
let preloadInFlight: Promise<PreloadData> | null = null;

const imageCache = new Map<string, { data: Buffer; contentType: string; fetched_at: number }>();
const IMG_TTL = 7 * 24 * 60 * 60 * 1000; // неделя

function normalizeHex(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const s = input.trim();
  if (/^#?[0-9a-fA-F]{6,8}$/.test(s)) return s.startsWith('#') ? s : `#${s}`;
  return undefined;
}

function pickColors(raw: Record<string, unknown>): BackdropInfo {
  const center = normalizeHex(raw.centerColor) ?? normalizeHex(raw.center_color) ?? normalizeHex(raw.hex) ?? normalizeHex(raw.color);
  const edge = normalizeHex(raw.edgeColor) ?? normalizeHex(raw.edge_color);
  const pattern = normalizeHex(raw.patternColor) ?? normalizeHex(raw.pattern_color);
  const text = normalizeHex(raw.textColor) ?? normalizeHex(raw.text_color);
  return {
    name: typeof raw.name === 'string' ? raw.name : undefined,
    centerColor: center,
    edgeColor: edge ?? center,
    patternColor: pattern,
    textColor: text,
    hex: center,
    rarityPermille: typeof raw.rarityPermille === 'number' ? raw.rarityPermille : undefined,
  };
}

async function jsonGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) { logger.warn(`changes.tg ${r.status}: ${path}`); return null; }
    return await r.json() as T;
  } catch (e) {
    logger.warn(`changes.tg fetch failed: ${path}`, { e: String(e) });
    return null;
  }
}

function asNames(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(x => typeof x === 'string' ? x : (x as { name?: string })?.name).filter((x): x is string => !!x);
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .map(v => typeof v === 'string' ? v : (v as { name?: string })?.name)
      .filter((x): x is string => !!x);
  }
  return [];
}

export async function getPreload(): Promise<PreloadData> {
  if (preloadCache) return preloadCache;
  if (preloadInFlight) return preloadInFlight;

  preloadInFlight = (async () => {
    logger.info('changes.tg: bulk preload start');

    // Список фонов — потом параллельно тянем info для каждого
    const backdropNames = asNames(await jsonGet<unknown>(`/backdrops/${COLLECTION}`));
    const models = asNames(await jsonGet<unknown>(`/models/${COLLECTION}`));
    const patterns = asNames(await jsonGet<unknown>(`/symbols/${COLLECTION}`));

    const backdrops: Record<string, BackdropInfo> = {};
    await Promise.all(backdropNames.map(async name => {
      const info = await jsonGet<Record<string, unknown>>(`/backdrop/${COLLECTION}/${encodeURIComponent(name)}/info`);
      if (info) backdrops[name] = pickColors(info);
    }));

    logger.info(`changes.tg preload done: ${models.length} models / ${backdropNames.length} backdrops / ${patterns.length} patterns`);

    const data: PreloadData = {
      models,
      patterns,
      backdrops,
      fetched_at: new Date().toISOString(),
    };
    preloadCache = data;
    preloadInFlight = null;
    return data;
  })();
  return preloadInFlight;
}

export async function fetchImage(
  kind: 'model' | 'pattern' | 'symbol',
  name: string,
  size: 64 | 128 | 256 | 512 | 1024,
): Promise<{ data: Buffer; contentType: string } | null> {
  const key = `${kind}:${name}:${size}`;
  const hit = imageCache.get(key);
  if (hit && Date.now() - hit.fetched_at < IMG_TTL) return { data: hit.data, contentType: hit.contentType };

  const url = `${BASE}/${kind}/${COLLECTION}/${encodeURIComponent(name)}.png?size=${size}`;
  try {
    const r = await fetch(url);
    if (!r.ok) { logger.warn(`changes.tg img ${r.status}: ${kind}/${name}`); return null; }
    const buf = Buffer.from(await r.arrayBuffer());
    const contentType = r.headers.get('content-type') ?? 'image/png';
    imageCache.set(key, { data: buf, contentType, fetched_at: Date.now() });
    return { data: buf, contentType };
  } catch (e) {
    logger.warn(`changes.tg img fetch failed`, { kind, name, e: String(e) });
    return null;
  }
}

// ── Цвета фонов из парсера (Telegram) — источник истины, не зависит от changes.tg ──
export interface IncomingBackdrop {
  name: string;
  center_color?: string | null;
  edge_color?: string | null;
  pattern_color?: string | null;
  text_color?: string | null;
}

export function replaceBackdrops(list: IncomingBackdrop[]): number {
  const up = db.prepare(
    `INSERT INTO backdrops (name, center_color, edge_color, pattern_color, text_color, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(name) DO UPDATE SET
       center_color = excluded.center_color,
       edge_color = excluded.edge_color,
       pattern_color = excluded.pattern_color,
       text_color = excluded.text_color,
       updated_at = datetime('now')`,
  );
  let n = 0;
  const tx = db.transaction((items: IncomingBackdrop[]) => {
    for (const b of items) {
      if (!b.name) continue;
      up.run(b.name, b.center_color ?? null, b.edge_color ?? null, b.pattern_color ?? null, b.text_color ?? null);
      n++;
    }
  });
  tx(list);
  return n;
}

// Цвета фонов из БД в формате фронта (camelCase) — подмешиваются в preload.
export function getStoredBackdrops(): Record<string, BackdropInfo> {
  const rows = db.prepare(`SELECT * FROM backdrops`).all() as Array<{
    name: string; center_color: string | null; edge_color: string | null;
    pattern_color: string | null; text_color: string | null;
  }>;
  const out: Record<string, BackdropInfo> = {};
  for (const r of rows) {
    out[r.name] = {
      name: r.name,
      centerColor: r.center_color ?? undefined,
      edgeColor: r.edge_color ?? r.center_color ?? undefined,
      patternColor: r.pattern_color ?? undefined,
      textColor: r.text_color ?? undefined,
      hex: r.center_color ?? undefined,
    };
  }
  return out;
}

// Прогрев на старте бекенда. Без await чтобы не задерживать listen.
export function warmup() {
  getPreload().catch(() => {});
}
