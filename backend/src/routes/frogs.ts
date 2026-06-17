import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { fetchGiftBySlug } from '../services/poso';
import { upsertFrog } from '../services/frogs';

const router = Router();

// Список всех доступных атрибутов для фильтров.
router.get('/attributes', authMiddleware, (_req: AuthRequest, res) => {
  const models = (db.prepare(`SELECT model AS v, COUNT(*) AS c FROM frogs GROUP BY model ORDER BY c DESC, v`).all() as { v: string; c: number }[]);
  const backdrops = (db.prepare(`SELECT backdrop AS v, COUNT(*) AS c FROM frogs GROUP BY backdrop ORDER BY c DESC, v`).all() as { v: string; c: number }[]);
  const patterns = (db.prepare(`SELECT pattern AS v, COUNT(*) AS c FROM frogs GROUP BY pattern ORDER BY c DESC, v`).all() as { v: string; c: number }[]);
  res.json({ models, backdrops, patterns });
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
  res.json(row);
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
  res.json(row);
});

export default router;
