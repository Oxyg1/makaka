import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

interface Filters {
  kind?: string;
  models?: string[];
  backdrops?: string[];
  patterns?: string[];
  min_price?: number;
  max_price?: number;
  search?: string;
  sort?: 'new' | 'price_asc' | 'price_desc' | 'rare';
  offset?: number;
  limit?: number;
}

function parseList(q: unknown): string[] {
  if (Array.isArray(q)) return q as string[];
  if (typeof q !== 'string' || !q) return [];
  return q.split(',').map(s => s.trim()).filter(Boolean);
}

// Лента ордеров на маркете.
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const f: Filters = {
    kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
    models: parseList(req.query.models),
    backdrops: parseList(req.query.backdrops),
    patterns: parseList(req.query.patterns),
    min_price: req.query.min_price ? Number(req.query.min_price) : undefined,
    max_price: req.query.max_price ? Number(req.query.max_price) : undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    sort: (req.query.sort as Filters['sort']) ?? 'new',
    offset: req.query.offset ? Number(req.query.offset) : 0,
    limit: req.query.limit ? Math.min(60, Number(req.query.limit)) : 30,
  };

  const where: string[] = [`o.status = 'open'`];
  const params: (string | number)[] = [];
  if (f.kind && ['trade', 'sell', 'any'].includes(f.kind)) { where.push(`o.kind = ?`); params.push(f.kind); }
  if (f.models?.length) { where.push(`f.model IN (${f.models.map(() => '?').join(',')})`); params.push(...f.models); }
  if (f.backdrops?.length) { where.push(`f.backdrop IN (${f.backdrops.map(() => '?').join(',')})`); params.push(...f.backdrops); }
  if (f.patterns?.length) { where.push(`f.pattern IN (${f.patterns.map(() => '?').join(',')})`); params.push(...f.patterns); }
  if (f.min_price !== undefined) { where.push(`o.price_stars >= ?`); params.push(f.min_price); }
  if (f.max_price !== undefined) { where.push(`o.price_stars <= ?`); params.push(f.max_price); }
  if (f.search) { where.push(`(f.slug LIKE ? OR f.model LIKE ?)`); params.push(`%${f.search}%`, `%${f.search}%`); }

  const order =
    f.sort === 'price_asc' ? `o.price_stars ASC NULLS LAST, o.id DESC` :
    f.sort === 'price_desc' ? `o.price_stars DESC NULLS LAST, o.id DESC` :
    f.sort === 'rare' ? `(COALESCE(f.model_rarity,1) + COALESCE(f.backdrop_rarity,1) + COALESCE(f.pattern_rarity,1)) ASC` :
    `o.created_at DESC`;

  const rows = db.prepare(`
    SELECT
      o.id, o.kind, o.price_stars, o.wants_models, o.wants_backdrops, o.wants_patterns,
      o.note, o.status, o.created_at,
      f.id AS frog_id, f.slug, f.number, f.model, f.backdrop, f.pattern,
      f.model_rarity, f.backdrop_rarity, f.pattern_rarity, f.image_url,
      u.id AS user_id, u.first_name AS user_name, u.username AS user_username, u.photo_url AS user_photo
    FROM orders o
    JOIN frogs f ON f.id = o.frog_id
    JOIN users u ON u.id = o.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY ${order}
    LIMIT ? OFFSET ?
  `).all(...params, f.limit!, f.offset!);
  res.json(rows);
});

// Мои ордеры.
router.get('/my', authMiddleware, (req: AuthRequest, res) => {
  const rows = db.prepare(`
    SELECT o.*, f.slug, f.number, f.model, f.backdrop, f.pattern, f.image_url
    FROM orders o JOIN frogs f ON f.id = o.frog_id
    WHERE o.user_id = ? AND o.status IN ('open','locked')
    ORDER BY o.created_at DESC
  `).all(req.userId);
  res.json(rows);
});

// Создать ордер.
router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { frog_id, kind, price_stars, wants_models, wants_backdrops, wants_patterns, note } = req.body ?? {};
  if (!frog_id || !['trade', 'sell', 'any'].includes(kind)) {
    res.status(400).json({ error: 'Invalid payload' }); return;
  }
  const frog = db.prepare(`SELECT id, owner_id FROM frogs WHERE id = ?`).get(frog_id) as { id: number; owner_id: number | null } | undefined;
  if (!frog || frog.owner_id !== req.userId) { res.status(403).json({ error: 'Это не ваша лягушка' }); return; }

  const exists = db.prepare(`SELECT id FROM orders WHERE frog_id = ? AND status IN ('open','locked')`).get(frog_id);
  if (exists) { res.status(409).json({ error: 'Активный ордер уже есть' }); return; }

  const r = db.prepare(`
    INSERT INTO orders (frog_id, user_id, kind, price_stars, wants_models, wants_backdrops, wants_patterns, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    frog_id, req.userId!, kind,
    typeof price_stars === 'number' ? price_stars : null,
    Array.isArray(wants_models) && wants_models.length ? JSON.stringify(wants_models) : null,
    Array.isArray(wants_backdrops) && wants_backdrops.length ? JSON.stringify(wants_backdrops) : null,
    Array.isArray(wants_patterns) && wants_patterns.length ? JSON.stringify(wants_patterns) : null,
    typeof note === 'string' && note.trim() ? note.trim().slice(0, 280) : null,
  );
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(r.lastInsertRowid);
  res.json(order);
});

// Отменить ордер.
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT user_id, status FROM orders WHERE id = ?`).get(id) as { user_id: number; status: string } | undefined;
  if (!row || row.user_id !== req.userId) { res.status(404).end(); return; }
  if (row.status !== 'open') { res.status(409).json({ error: 'Ордер уже не открыт' }); return; }
  db.prepare(`UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(id);
  res.json({ success: true });
});

export default router;
