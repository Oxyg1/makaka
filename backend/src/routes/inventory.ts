import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { fetchUserGifts } from '../services/poso';
import { upsertFrog } from '../services/frogs';
import { attachColors } from '../services/colors';

const router = Router();

// Список лягушек юзера — свои + с привязанных кошельков.
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const u = db.prepare(`SELECT telegram_id FROM users WHERE id = ?`).get(req.userId) as { telegram_id: string } | undefined;
  const rows = db.prepare(`
    SELECT f.*,
      (SELECT id FROM orders o WHERE o.frog_id = f.id AND o.status IN ('open','locked') LIMIT 1) AS active_order_id
    FROM frogs f
    WHERE f.owner_id = ?
       OR (f.owner_address IS NOT NULL AND f.owner_address IN (SELECT address FROM wallet_links WHERE telegram_id = ?))
    ORDER BY f.number DESC
  `).all(req.userId, u?.telegram_id ?? '') as Record<string, unknown>[];
  res.json(attachColors(rows));
});

// Синк с poso.see.tg по telegram_id (надёжнее username).
router.post('/sync', authMiddleware, async (req: AuthRequest, res) => {
  const user = db.prepare(`SELECT id, telegram_id, username FROM users WHERE id = ?`)
    .get(req.userId) as { id: number; telegram_id: string; username: string | null } | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const gifts = await fetchUserGifts({
    telegramId: user.telegram_id,
    username: user.username ?? undefined,
  });

  const tx = db.transaction(() => {
    db.prepare(`UPDATE frogs SET owner_id = NULL WHERE owner_id = ?`).run(user.id);
    for (const g of gifts) upsertFrog(g, user.id);
    db.prepare(`UPDATE users SET last_synced_at = datetime('now') WHERE id = ?`).run(user.id);
  });
  tx();

  res.json({ added: gifts.length, gifts });
});

export default router;
