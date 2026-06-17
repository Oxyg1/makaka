import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const rows = db.prepare(`
    SELECT n.*, u.first_name AS actor_name, u.username AS actor_username, u.photo_url AS actor_photo
    FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
    WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 60
  `).all(req.userId);
  res.json(rows);
});

router.post('/read', authMiddleware, (req: AuthRequest, res) => {
  db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`).run(req.userId);
  res.json({ success: true });
});

export default router;
