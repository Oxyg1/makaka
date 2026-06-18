import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare(`
    SELECT id, telegram_id, username, first_name, photo_url, last_synced_at, created_at
    FROM users WHERE id = ?
  `).get(req.userId);
  res.json(user);
});

export default router;
