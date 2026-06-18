// Маркет = лента открытых ордеров на обмен.
// "Я отдаю эту лягушку, хочу взамен такую-то, вот почему."

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

interface Filters {
  // фильтр по тому, что отдают
  offer_models?: string[];
  offer_backdrops?: string[];
  offer_patterns?: string[];
  // фильтр по тому, что хотят (если ордер просит модель X, попадёт)
  wants_models?: string[];
  wants_backdrops?: string[];
  wants_patterns?: string[];
  search?: string;
  sort?: 'new' | 'rare';
  offset?: number;
  limit?: number;
}

function parseList(q: unknown): string[] {
  if (Array.isArray(q)) return q as string[];
  if (typeof q !== 'string' || !q) return [];
  return q.split(',').map(s => s.trim()).filter(Boolean);
}

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const f: Filters = {
    offer_models: parseList(req.query.offer_models),
    offer_backdrops: parseList(req.query.offer_backdrops),
    offer_patterns: parseList(req.query.offer_patterns),
    wants_models: parseList(req.query.wants_models),
    wants_backdrops: parseList(req.query.wants_backdrops),
    wants_patterns: parseList(req.query.wants_patterns),
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    sort: (req.query.sort as Filters['sort']) ?? 'new',
    offset: req.query.offset ? Number(req.query.offset) : 0,
    limit: req.query.limit ? Math.min(60, Number(req.query.limit)) : 30,
  };

  const where: string[] = [`o.status = 'open'`];
  const params: (string | number)[] = [];

  if (f.offer_models?.length) { where.push(`f.model IN (${f.offer_models.map(() => '?').join(',')})`); params.push(...f.offer_models); }
  if (f.offer_backdrops?.length) { where.push(`f.backdrop IN (${f.offer_backdrops.map(() => '?').join(',')})`); params.push(...f.offer_backdrops); }
  if (f.offer_patterns?.length) { where.push(`f.pattern IN (${f.offer_patterns.map(() => '?').join(',')})`); params.push(...f.offer_patterns); }

  // wants хранится как JSON-массив строк; ищем подстроку имени
  for (const w of f.wants_models ?? []) { where.push(`o.wants_models LIKE ?`); params.push(`%"${w}"%`); }
  for (const w of f.wants_backdrops ?? []) { where.push(`o.wants_backdrops LIKE ?`); params.push(`%"${w}"%`); }
  for (const w of f.wants_patterns ?? []) { where.push(`o.wants_patterns LIKE ?`); params.push(`%"${w}"%`); }

  if (f.search) { where.push(`(f.slug LIKE ? OR f.model LIKE ? OR o.note LIKE ?)`); params.push(`%${f.search}%`, `%${f.search}%`, `%${f.search}%`); }

  const order = f.sort === 'rare'
    ? `(COALESCE(f.model_rarity,1) + COALESCE(f.backdrop_rarity,1) + COALESCE(f.pattern_rarity,1)) ASC`
    : `o.created_at DESC`;

  const rows = db.prepare(`
    SELECT
      o.id, o.note, o.wants_models, o.wants_backdrops, o.wants_patterns,
      o.status, o.created_at,
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

router.get('/my', authMiddleware, (req: AuthRequest, res) => {
  const rows = db.prepare(`
    SELECT o.*, f.slug, f.number, f.model, f.backdrop, f.pattern, f.image_url
    FROM orders o JOIN frogs f ON f.id = o.frog_id
    WHERE o.user_id = ? AND o.status = 'open'
    ORDER BY o.created_at DESC
  `).all(req.userId);
  res.json(rows);
});

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { frog_id, wants_models, wants_backdrops, wants_patterns, note } = req.body ?? {};
  if (!frog_id) { res.status(400).json({ error: 'Не указана лягушка' }); return; }
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  if (!trimmedNote) { res.status(400).json({ error: 'Опишите зачем вам обмен — это видят владельцы' }); return; }
  if (trimmedNote.length > 500) { res.status(400).json({ error: 'Описание слишком длинное' }); return; }

  const wantsAny = (Array.isArray(wants_models) && wants_models.length)
    || (Array.isArray(wants_backdrops) && wants_backdrops.length)
    || (Array.isArray(wants_patterns) && wants_patterns.length);
  if (!wantsAny) { res.status(400).json({ error: 'Выберите хотя бы один атрибут желаемой лягушки' }); return; }

  const frog = db.prepare(`SELECT id, owner_id FROM frogs WHERE id = ?`).get(frog_id) as { id: number; owner_id: number | null } | undefined;
  if (!frog || frog.owner_id !== req.userId) { res.status(403).json({ error: 'Это не ваша лягушка' }); return; }

  const exists = db.prepare(`SELECT id FROM orders WHERE frog_id = ? AND status = 'open'`).get(frog_id);
  if (exists) { res.status(409).json({ error: 'У этой лягушки уже есть открытый ордер' }); return; }

  const r = db.prepare(`
    INSERT INTO orders (frog_id, user_id, wants_models, wants_backdrops, wants_patterns, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    frog_id, req.userId!,
    Array.isArray(wants_models) && wants_models.length ? JSON.stringify(wants_models) : null,
    Array.isArray(wants_backdrops) && wants_backdrops.length ? JSON.stringify(wants_backdrops) : null,
    Array.isArray(wants_patterns) && wants_patterns.length ? JSON.stringify(wants_patterns) : null,
    trimmedNote,
  );
  res.json(db.prepare(`SELECT * FROM orders WHERE id = ?`).get(r.lastInsertRowid));
});

router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT user_id, status FROM orders WHERE id = ?`).get(id) as { user_id: number; status: string } | undefined;
  if (!row || row.user_id !== req.userId) { res.status(404).end(); return; }
  db.prepare(`UPDATE orders SET status = 'closed', updated_at = datetime('now') WHERE id = ?`).run(id);
  res.json({ success: true });
});

export default router;
