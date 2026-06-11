import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

// GET /api/notifications
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const notifs = db.prepare(`
    SELECT n.id, n.user_id, n.actor_id, n.type, n.entity_type, n.entity_id, n.text, n.read, n.created_at,
      u.first_name AS actor_name, u.photo_url AS actor_photo_url
    FROM notifications n
    JOIN users u ON n.actor_id = u.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `).all(req.userId!);
  res.json(notifs);
});

// POST /api/notifications/read
router.post('/read', authMiddleware, (req: AuthRequest, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.userId!);
  res.json({ success: true });
});

export default router;
