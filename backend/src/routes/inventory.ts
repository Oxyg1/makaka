import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { fetchUserGifts } from '../services/poso';
import { upsertFrog } from '../services/frogs';

const router = Router();

// Список лягушек юзера.
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const rows = db.prepare(`
    SELECT f.*,
      (SELECT id FROM orders o WHERE o.frog_id = f.id AND o.status IN ('open','locked') LIMIT 1) AS active_order_id
    FROM frogs f
    WHERE f.owner_id = ?
    ORDER BY f.number DESC
  `).all(req.userId);
  res.json(rows);
});

// Синк с poso.see.tg.
router.post('/sync', authMiddleware, async (req: AuthRequest, res) => {
  const user = db.prepare(`SELECT id, username FROM users WHERE id = ?`).get(req.userId) as { id: number; username: string | null } | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (!user.username) { res.status(400).json({ error: 'У вас не задан username в Telegram. Установите его и попробуйте снова.' }); return; }

  const gifts = await fetchUserGifts(user.username);

  const tx = db.transaction(() => {
    // Снимаем владение со старых, потом проставим заново только для актуальных.
    db.prepare(`UPDATE frogs SET owner_id = NULL WHERE owner_id = ?`).run(user.id);
    for (const g of gifts) upsertFrog(g, user.id);
    db.prepare(`UPDATE users SET last_synced_at = datetime('now') WHERE id = ?`).run(user.id);
  });
  tx();

  const added = gifts.length;
  res.json({ added, gifts });
});

export default router;
