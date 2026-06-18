// Личный запрос на обмен. "Меняю свою X на твою Y, вот сообщение."
// Никакого эскроу — когда обе стороны согласились, в UI кнопка
// "написать в личку" с tg-юзером. Договариваются сами.

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

interface FrogOwner { id: number; owner_id: number | null }
interface OfferRow {
  id: number;
  from_user_id: number;
  to_user_id: number;
  from_frog_id: number;
  to_frog_id: number;
  status: string;
  order_id: number | null;
}

function notify(userId: number, actorId: number | null, type: string, entityType: string, entityId: number, text: string) {
  db.prepare(`INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, text) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(userId, actorId, type, entityType, entityId, text);
}

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { to_frog_id, from_frog_id, message, order_id } = req.body ?? {};
  if (!to_frog_id) { res.status(400).json({ error: 'Нет to_frog_id' }); return; }
  if (!from_frog_id) { res.status(400).json({ error: 'Выберите свою лягушку для обмена' }); return; }

  const trimmedMsg = typeof message === 'string' ? message.trim() : '';
  if (!trimmedMsg) { res.status(400).json({ error: 'Напишите сообщение — без него запрос проигнорируют' }); return; }
  if (trimmedMsg.length > 500) { res.status(400).json({ error: 'Сообщение слишком длинное' }); return; }

  const toFrog = db.prepare(`SELECT id, owner_id FROM frogs WHERE id = ?`).get(to_frog_id) as FrogOwner | undefined;
  if (!toFrog || !toFrog.owner_id) { res.status(404).json({ error: 'Лягушка не привязана к пользователю SWAMP' }); return; }
  if (toFrog.owner_id === req.userId) { res.status(400).json({ error: 'Это ваша лягушка' }); return; }

  const fromFrog = db.prepare(`SELECT id, owner_id FROM frogs WHERE id = ?`).get(from_frog_id) as FrogOwner | undefined;
  if (!fromFrog || fromFrog.owner_id !== req.userId) { res.status(403).json({ error: 'Это не ваша лягушка' }); return; }

  const r = db.prepare(`
    INSERT INTO offers (order_id, from_user_id, to_user_id, from_frog_id, to_frog_id, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(order_id ?? null, req.userId!, toFrog.owner_id, from_frog_id, to_frog_id, trimmedMsg);

  notify(toFrog.owner_id, req.userId!, 'offer_in', 'offer', Number(r.lastInsertRowid), 'Новый запрос на обмен');
  res.json({ id: r.lastInsertRowid });
});

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const dir = req.query.dir === 'out' ? 'from_user_id' : 'to_user_id';
  const rows = db.prepare(`
    SELECT
      o.id, o.order_id, o.from_user_id, o.to_user_id, o.from_frog_id, o.to_frog_id,
      o.message, o.status, o.accepted_at, o.created_at,
      ff.slug AS from_slug, ff.number AS from_number, ff.model AS from_model, ff.backdrop AS from_backdrop, ff.pattern AS from_pattern,
      tf.slug AS to_slug, tf.number AS to_number, tf.model AS to_model, tf.backdrop AS to_backdrop, tf.pattern AS to_pattern,
      fu.first_name AS from_name, fu.username AS from_username, fu.photo_url AS from_photo,
      tu.first_name AS to_name, tu.username AS to_username, tu.photo_url AS to_photo
    FROM offers o
    JOIN frogs ff ON ff.id = o.from_frog_id
    JOIN frogs tf ON tf.id = o.to_frog_id
    JOIN users fu ON fu.id = o.from_user_id
    JOIN users tu ON tu.id = o.to_user_id
    WHERE o.${dir} = ?
    ORDER BY
      CASE o.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END,
      o.created_at DESC
  `).all(req.userId);
  res.json(rows);
});

router.post('/:id/accept', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const o = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(id) as OfferRow | undefined;
  if (!o || o.to_user_id !== req.userId) { res.status(404).end(); return; }
  if (o.status !== 'pending') { res.status(409).json({ error: 'Запрос уже не активен' }); return; }

  db.prepare(`UPDATE offers SET status = 'accepted', accepted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(id);
  notify(o.from_user_id, req.userId!, 'offer_accepted', 'offer', id, 'Запрос принят — договоритесь в личке');
  res.json({ success: true });
});

router.post('/:id/decline', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const o = db.prepare(`SELECT to_user_id, from_user_id, status FROM offers WHERE id = ?`).get(id) as Pick<OfferRow, 'to_user_id' | 'from_user_id' | 'status'> | undefined;
  if (!o || o.to_user_id !== req.userId) { res.status(404).end(); return; }
  if (o.status !== 'pending') { res.status(409).end(); return; }
  db.prepare(`UPDATE offers SET status = 'declined', updated_at = datetime('now') WHERE id = ?`).run(id);
  notify(o.from_user_id, req.userId!, 'offer_declined', 'offer', id, 'Запрос отклонён');
  res.json({ success: true });
});

router.post('/:id/cancel', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const o = db.prepare(`SELECT from_user_id, to_user_id, status FROM offers WHERE id = ?`).get(id) as Pick<OfferRow, 'from_user_id' | 'to_user_id' | 'status'> | undefined;
  if (!o || o.from_user_id !== req.userId) { res.status(404).end(); return; }
  if (o.status === 'accepted' || o.status === 'declined') { res.status(409).end(); return; }
  db.prepare(`UPDATE offers SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(id);
  res.json({ success: true });
});

export default router;
