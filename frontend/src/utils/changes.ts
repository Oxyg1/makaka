// Клиент к api.changes.tg / cdn.changes.tg — публичный CDN для NFT-подарков TG.
// Бесплатный, без авторизации. Используем для отображения настоящих картинок
// моделей, фонов и узоров KissedFrog.
//
// thanks to @GiftChanges (api.changes.tg) for the gift visuals
//
// Кредит автору обязателен — он же отображается в Профиле приложения.

const BASE = 'https://api.changes.tg';
const COLLECTION = 'KissedFrog';

export const ATTRIBUTION = {
  text: 'Powered by @GiftChanges',
  link: 'https://t.me/GiftChanges',
  api: 'api.changes.tg',
};

export function modelImageUrl(model: string, size: 64 | 128 | 256 | 512 | 1024 = 512): string {
  return `${BASE}/model/${COLLECTION}/${encodeURIComponent(model)}.png?size=${size}`;
}

export function patternImageUrl(pattern: string, size: 64 | 128 | 256 | 512 | 1024 = 256): string {
  return `${BASE}/symbol/${COLLECTION}/${encodeURIComponent(pattern)}.png?size=${size}`;
}

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

// in-memory + localStorage кэш (24h) чтобы не дёргать API при каждом ре-рендере
const memCache = new Map<string, BackdropInfo | null>();
const inflight = new Map<string, Promise<BackdropInfo | null>>();
const TTL_MS = 24 * 60 * 60 * 1000;

function lsKey(name: string) { return `bd:${COLLECTION}:${name}`; }

function readLs(name: string): BackdropInfo | null {
  try {
    const raw = localStorage.getItem(lsKey(name));
    if (!raw) return null;
    const { at, v } = JSON.parse(raw) as { at: number; v: BackdropInfo | null };
    if (Date.now() - at > TTL_MS) return null;
    return v;
  } catch { return null; }
}
function writeLs(name: string, v: BackdropInfo | null) {
  try { localStorage.setItem(lsKey(name), JSON.stringify({ at: Date.now(), v })); } catch { /* quota */ }
}

function normalizeHex(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const s = input.trim();
  if (/^#?[0-9a-fA-F]{6,8}$/.test(s)) return s.startsWith('#') ? s : `#${s}`;
  return undefined;
}

function pickColors(raw: Record<string, unknown>): BackdropInfo {
  // у API поля могут называться по-разному; берём что найдём.
  const center = normalizeHex(raw.centerColor) ?? normalizeHex(raw.center_color) ?? normalizeHex(raw.hex) ?? normalizeHex(raw.color);
  const edge = normalizeHex(raw.edgeColor) ?? normalizeHex(raw.edge_color);
  const pattern = normalizeHex(raw.patternColor) ?? normalizeHex(raw.pattern_color);
  const text = normalizeHex(raw.textColor) ?? normalizeHex(raw.text_color);
  return {
    name: typeof raw.name === 'string' ? raw.name : undefined,
    centerColor: center,
    edgeColor: edge,
    patternColor: pattern,
    textColor: text,
    hex: center,
  };
}

export function getBackdropInfo(name: string): Promise<BackdropInfo | null> {
  if (memCache.has(name)) return Promise.resolve(memCache.get(name) ?? null);
  const ls = readLs(name);
  if (ls) { memCache.set(name, ls); return Promise.resolve(ls); }
  const ex = inflight.get(name);
  if (ex) return ex;
  const p = fetch(`${BASE}/backdrop/${COLLECTION}/${encodeURIComponent(name)}/info`, { headers: { Accept: 'application/json' } })
    .then(async r => {
      if (!r.ok) return null;
      const j = await r.json() as Record<string, unknown>;
      return pickColors(j);
    })
    .catch(() => null)
    .then(v => {
      memCache.set(name, v);
      writeLs(name, v);
      inflight.delete(name);
      return v;
    });
  inflight.set(name, p);
  return p;
}
