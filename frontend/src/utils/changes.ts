// Визуалки KissedFrog. Берём всё через наш бэкенд-прокси:
//   - /api/visuals/preload — словарь backdrop-цветов + списки моделей и узоров,
//     один раз тянем и кладём в localStorage на 24 часа.
//   - /api/visuals/{model|pattern|symbol}/{name}.png — проксирующая картинка,
//     кэшируется бэкендом и браузером.
//
// Прямой fetch к api.changes.tg блокируется CORS, поэтому всё через прокси.
//
// thanks to @GiftChanges (api.changes.tg) for the gift visuals.

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/visuals';

export const ATTRIBUTION = {
  text: 'Powered by @GiftChanges',
  link: 'https://t.me/GiftChanges',
  api: 'api.changes.tg',
};

export interface BackdropInfo {
  name?: string;
  centerColor?: string;
  edgeColor?: string;
  patternColor?: string;
  textColor?: string;
  hex?: string;
  rarityPermille?: number;
}

export interface PreloadData {
  models: string[];
  patterns: string[];
  backdrops: Record<string, BackdropInfo>;
  fetched_at: string;
}

const LS_KEY = 'visuals.preload.v1';
const LS_TTL = 24 * 60 * 60 * 1000;

let memory: PreloadData | null = null;
let inflight: Promise<PreloadData> | null = null;

export function modelImageUrl(model: string, size: 64 | 128 | 256 | 512 | 1024 = 256): string {
  return `${BASE}/model/${encodeURIComponent(model)}.png?size=${size}`;
}
export function patternImageUrl(pattern: string, size: 64 | 128 | 256 | 512 | 1024 = 128): string {
  return `${BASE}/symbol/${encodeURIComponent(pattern)}.png?size=${size}`;
}

function readLs(): PreloadData | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { at, v } = JSON.parse(raw) as { at: number; v: PreloadData };
    if (Date.now() - at > LS_TTL) return null;
    return v;
  } catch { return null; }
}
function writeLs(v: PreloadData) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), v })); } catch { /* quota */ }
}

export async function loadPreload(): Promise<PreloadData> {
  if (memory) return memory;
  const cached = readLs();
  if (cached) { memory = cached; return cached; }
  if (inflight) return inflight;
  inflight = fetch(`${BASE}/preload`).then(async r => {
    if (!r.ok) throw new Error(`preload ${r.status}`);
    const data = await r.json() as PreloadData;
    memory = data;
    writeLs(data);
    inflight = null;
    return data;
  }).catch(e => {
    inflight = null;
    throw e;
  });
  return inflight;
}

export function getBackdropInfoSync(name: string): BackdropInfo | null {
  return memory?.backdrops?.[name] ?? null;
}
