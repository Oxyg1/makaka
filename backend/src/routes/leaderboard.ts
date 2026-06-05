import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';

const router = Router();

const PERIOD_MAP: Record<string, string> = {
  daily: '-1 day',
  weekly: '-7 days',
  monthly: '-30 days',
};

router.get('/', authMiddleware, (req, res) => {
  const period = (req.query.period as string) || 'daily';
  const offset = PERIOD_MAP[period];

  if (!offset) {
    res.status(400).json({ error: 'period must be daily, weekly, or monthly' });
    return;
  }

  const entries = db.prepare(`
    SELECT c.id, c.name, c.breed, c.photo_url,
      ROUND(AVG(r.score), 1) AS avg_score,
      COUNT(r.id) AS vote_count,
      u.first_name AS owner_name
    FROM cats c
    JOIN users u ON c.owner_id = u.id
    JOIN ratings r ON r.cat_id = c.id
    WHERE r.created_at >= datetime('now', ?)
    GROUP BY c.id
    HAVING COUNT(r.id) >= 1
    ORDER BY avg_score DESC, vote_count DESC
    LIMIT 20
  `).all(offset);

  res.json(entries);
});

export default router;
