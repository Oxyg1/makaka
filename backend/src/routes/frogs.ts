import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { fetchGiftBySlug } from '../services/poso';
import { upsertFrog } from '../services/frogs';
import { getPreload } from '../services/visuals';

const router = Router();

// Помечаем лягушку «на маркете», если её владелец — аккаунт-маркет/хранилище.
function withMarket<T extends { owner_telegram_id?: string | null } | undefined>(row: T): T {
  if (!row) return row;
  const m = row.owner_telegram_id
    ? (db.prepare(`SELECT name FROM markets WHERE telegram_id = ?`).get(String(row.owner_telegram_id)) as { name: string } | undefined)
    : undefined;
  (row as Record<string, unknown>).owner_is_market = m ? 1 : 0;
  (row as Record<string, unknown>).owner_market_name = m?.name ?? null;
  return row;
}

// Счётчики по колонке (model/backdrop/pattern) из локальной БД.
function dbCounts(col: 'model' | 'backdrop' | 'pattern'): Map<string, number> {
  const rows = db.prepare(`SELECT ${col} AS v, COUNT(*) AS c FROM frogs GROUP BY ${col}`).all() as { v: string; c: number }[];
  const m = new Map<string, number>();
  for (const r of rows) if (r.v) m.set(r.v, r.c);
  return m;
}
function dbDistinct(col: 'model' | 'backdrop' | 'pattern') {
  return db.prepare(`SELECT ${col} AS v, COUNT(*) AS c FROM frogs GROUP BY ${col} ORDER BY c DESC, v`).all() as { v: string; c: number }[];
}

// Полный каталог атрибутов KissedFrog для фильтров.
// Источник истины — preload от changes.tg (все модели/фоны/узоры коллекции),
// счётчики подмешиваем из локальной БД. Если preload недоступен —
// откатываемся на distinct по своим лягушкам.
router.get('/attributes', authMiddleware, async (_req: AuthRequest, res) => {
  const fromCatalog = (names: string[], counts: Map<string, number>) =>
    names
      .map(v => ({ v, c: counts.get(v) ?? 0 }))
      .sort((a, b) => b.c - a.c || a.v.localeCompare(b.v));

  try {
    const preload = await getPreload();
    const backdropNames = Object.keys(preload.backdrops ?? {});
    res.json({
      models: preload.models?.length ? fromCatalog(preload.models, dbCounts('model')) : dbDistinct('model'),
      backdrops: backdropNames.length ? fromCatalog(backdropNames, dbCounts('backdrop')) : dbDistinct('backdrop'),
      patterns: preload.patterns?.length ? fromCatalog(preload.patterns, dbCounts('pattern')) : dbDistinct('pattern'),
    });
  } catch {
    res.json({ models: dbDistinct('model'), backdrops: dbDistinct('backdrop'), patterns: dbDistinct('pattern') });
  }
});

// Достать лягушку по slug / ссылке. Если её нет в БД — пробуем подтянуть с poso.
router.get('/lookup', authMiddleware, async (req: AuthRequest, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) { res.status(400).json({ error: 'Пустой запрос' }); return; }
  // Парсим что бы там ни прислали: ссылку t.me/nft/KissedFrog-1234 / просто slug / число.
  const slugMatch = q.match(/KissedFrog[-_]?(\d+)/i) ?? q.match(/(\d{1,7})/);
  if (!slugMatch) { res.status(400).json({ error: 'Не удалось распарсить ссылку' }); return; }
  const slug = `KissedFrog-${slugMatch[1]}`;

  let row = db.prepare(`
    SELECT f.*, u.first_name AS owner_name, u.username AS owner_un, u.photo_url AS owner_photo,
      (SELECT id FROM orders o WHERE o.frog_id = f.id AND o.status = 'open' LIMIT 1) AS active_order_id
    FROM frogs f LEFT JOIN users u ON u.id = f.owner_id
    WHERE f.slug = ?
  `).get(slug);
  if (!row) {
    const remote = await fetchGiftBySlug(slug);
    if (!remote) { res.status(404).json({ error: 'Лягушка не найдена' }); return; }
    upsertFrog(remote, null);
    row = db.prepare(`
      SELECT f.*, u.first_name AS owner_name, u.username AS owner_un, u.photo_url AS owner_photo,
        (SELECT id FROM orders o WHERE o.frog_id = f.id AND o.status = 'open' LIMIT 1) AS active_order_id
      FROM frogs f LEFT JOIN users u ON u.id = f.owner_id
      WHERE f.slug = ?
    `).get(slug);
  }
  res.json(withMarket(row as { owner_telegram_id?: string | null }));
});

// Подробности по конкретной лягушке.
router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`
    SELECT f.*, u.first_name AS owner_name, u.username AS owner_un, u.photo_url AS owner_photo,
      (SELECT id FROM orders o WHERE o.frog_id = f.id AND o.status = 'open' LIMIT 1) AS active_order_id
    FROM frogs f LEFT JOIN users u ON u.id = f.owner_id
    WHERE f.id = ?
  `).get(id);
  if (!row) { res.status(404).end(); return; }
  res.json(withMarket(row as { owner_telegram_id?: string | null }));
});

export default router;
