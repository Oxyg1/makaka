import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { setOwner } from '../services/frogs';

const router = Router();

interface FrogOwner { id: number; owner_id: number | null }
interface OfferRow {
  id: number; from_user_id: number; to_user_id: number;
  from_frog_id: number | null; to_frog_id: number;
  status: string; order_id: number | null;
  from_escrow_at: string | null; to_escrow_at: string | null;
}

function notify(userId: number, actorId: number | null, type: string, entityType: string, entityId: number, text: string) {
  db.prepare(`INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, text) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(userId, actorId, type, entityType, entityId, text);
}

// Создать оффер: я предлагаю свою лягушку (и/или звёзды) за чужую.
router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { to_frog_id, from_frog_id, stars, message, order_id } = req.body ?? {};
  if (!to_frog_id) { res.status(400).json({ error: 'Нет to_frog_id' }); return; }

  const toFrog = db.prepare(`SELECT id, owner_id FROM frogs WHERE id = ?`).get(to_frog_id) as FrogOwner | undefined;
  if (!toFrog || !toFrog.owner_id) { res.status(404).json({ error: 'Лягушка не привязана к пользователю' }); return; }
  if (toFrog.owner_id === req.userId) { res.status(400).json({ error: 'Это ваша лягушка' }); return; }

  if (from_frog_id) {
    const fromFrog = db.prepare(`SELECT id, owner_id FROM frogs WHERE id = ?`).get(from_frog_id) as FrogOwner | undefined;
    if (!fromFrog || fromFrog.owner_id !== req.userId) { res.status(403).json({ error: 'Это не ваша лягушка' }); return; }
  }
  if (!from_frog_id && !stars) { res.status(400).json({ error: 'Нужно предложить лягушку или звёзды' }); return; }

  const r = db.prepare(`
    INSERT INTO offers (order_id, from_user_id, to_user_id, from_frog_id, to_frog_id, stars, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    order_id ?? null, req.userId!, toFrog.owner_id, from_frog_id ?? null, to_frog_id,
    typeof stars === 'number' ? stars : null,
    typeof message === 'string' && message.trim() ? message.trim().slice(0, 280) : null,
  );

  notify(toFrog.owner_id, req.userId!, 'offer_in', 'offer', Number(r.lastInsertRowid), 'Новый оффер на обмен');
  res.json({ id: r.lastInsertRowid });
});

// Входящие / исходящие.
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const dir = req.query.dir === 'out' ? 'from_user_id' : 'to_user_id';
  const rows = db.prepare(`
    SELECT
      o.id, o.order_id, o.from_user_id, o.to_user_id, o.from_frog_id, o.to_frog_id,
      o.stars, o.message, o.status, o.from_escrow_at, o.to_escrow_at, o.completed_at, o.created_at,
      ff.slug AS from_slug, ff.number AS from_number, ff.model AS from_model, ff.backdrop AS from_backdrop, ff.pattern AS from_pattern,
      tf.slug AS to_slug, tf.number AS to_number, tf.model AS to_model, tf.backdrop AS to_backdrop, tf.pattern AS to_pattern,
      fu.first_name AS from_name, fu.username AS from_username, fu.photo_url AS from_photo,
      tu.first_name AS to_name, tu.username AS to_username, tu.photo_url AS to_photo
    FROM offers o
    LEFT JOIN frogs ff ON ff.id = o.from_frog_id
    JOIN frogs tf ON tf.id = o.to_frog_id
    JOIN users fu ON fu.id = o.from_user_id
    JOIN users tu ON tu.id = o.to_user_id
    WHERE o.${dir} = ?
    ORDER BY
      CASE o.status WHEN 'pending' THEN 0 WHEN 'awaiting_escrow' THEN 1 ELSE 2 END,
      o.created_at DESC
  `).all(req.userId);
  res.json(rows);
});

router.post('/:id/accept', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const o = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(id) as OfferRow | undefined;
  if (!o || o.to_user_id !== req.userId) { res.status(404).end(); return; }
  if (o.status !== 'pending') { res.status(409).json({ error: 'Оффер уже не активен' }); return; }

  db.transaction(() => {
    db.prepare(`UPDATE offers SET status = 'awaiting_escrow', updated_at = datetime('now') WHERE id = ?`).run(id);
    if (o.order_id) db.prepare(`UPDATE orders SET status = 'locked', updated_at = datetime('now') WHERE id = ?`).run(o.order_id);
  })();

  notify(o.from_user_id, req.userId!, 'offer_accepted', 'offer', id, 'Оффер принят — передайте лягушку на эскроу');
  res.json({ success: true });
});

router.post('/:id/decline', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const o = db.prepare(`SELECT to_user_id, from_user_id, status FROM offers WHERE id = ?`).get(id) as Pick<OfferRow, 'to_user_id' | 'from_user_id' | 'status'> | undefined;
  if (!o || o.to_user_id !== req.userId) { res.status(404).end(); return; }
  if (o.status !== 'pending') { res.status(409).end(); return; }
  db.prepare(`UPDATE offers SET status = 'declined', updated_at = datetime('now') WHERE id = ?`).run(id);
  notify(o.from_user_id, req.userId!, 'offer_declined', 'offer', id, 'Оффер отклонён');
  res.json({ success: true });
});

router.post('/:id/cancel', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const o = db.prepare(`SELECT from_user_id, to_user_id, status, order_id FROM offers WHERE id = ?`).get(id) as Pick<OfferRow, 'from_user_id' | 'to_user_id' | 'status' | 'order_id'> | undefined;
  if (!o || o.from_user_id !== req.userId) { res.status(404).end(); return; }
  if (o.status === 'completed') { res.status(409).end(); return; }
  db.transaction(() => {
    db.prepare(`UPDATE offers SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(id);
    if (o.order_id) db.prepare(`UPDATE orders SET status = 'open', updated_at = datetime('now') WHERE id = ? AND status = 'locked'`).run(o.order_id);
  })();
  notify(o.to_user_id, req.userId!, 'offer_cancelled', 'offer', id, 'Оффер отменён');
  res.json({ success: true });
});

// Подтверждение, что юзер передал свою лягушку на бот-аккаунт эскроу.
// Когда обе стороны подтвердили — выполняем обмен (меняем владельцев) и закрываем.
router.post('/:id/confirm-escrow', authMiddleware, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const o = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(id) as OfferRow | undefined;
  if (!o) { res.status(404).end(); return; }
  if (o.status !== 'awaiting_escrow') { res.status(409).json({ error: 'Оффер не в эскроу' }); return; }
  if (req.userId !== o.from_user_id && req.userId !== o.to_user_id) { res.status(403).end(); return; }

  const field = req.userId === o.from_user_id ? 'from_escrow_at' : 'to_escrow_at';
  db.prepare(`UPDATE offers SET ${field} = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(id);

  const updated = db.prepare(`SELECT from_escrow_at, to_escrow_at FROM offers WHERE id = ?`).get(id) as { from_escrow_at: string | null; to_escrow_at: string | null };
  const fromOk = !!updated.from_escrow_at;
  // У to-стороны эскроу нужен только если у from есть лягушка для обмена (иначе это просто покупка за звёзды).
  const toRequired = o.from_frog_id !== null;
  const toOk = !toRequired || !!updated.to_escrow_at;

  if (fromOk && toOk) {
    db.transaction(() => {
      if (o.from_frog_id) setOwner(o.from_frog_id, o.to_user_id);
      setOwner(o.to_frog_id, o.from_user_id);
      db.prepare(`UPDATE offers SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(id);
      if (o.order_id) db.prepare(`UPDATE orders SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(o.order_id);
    })();
    notify(o.from_user_id, null, 'trade_done', 'offer', id, 'Обмен завершён');
    notify(o.to_user_id, null, 'trade_done', 'offer', id, 'Обмен завершён');
  } else {
    const other = req.userId === o.from_user_id ? o.to_user_id : o.from_user_id;
    notify(other, req.userId!, 'escrow_in', 'offer', id, 'Партнёр передал лягушку на эскроу');
  }

  res.json({ success: true });
});

export default router;
