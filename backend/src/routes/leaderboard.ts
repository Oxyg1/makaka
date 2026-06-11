import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

const PERIOD_MAP: Record<string, string> = {
  daily: '-1 day',
  weekly: '-7 days',
  monthly: '-30 days',
};

const BASE_QUERY = `
  SELECT c.id, c.owner_id, c.name, c.breed, c.description, c.age, c.photo_url,
    ROUND(AVG(r.score), 1) AS avg_score,
    COUNT(DISTINCT r.id) AS vote_count,
    COUNT(DISTINCT cl.id) AS likes_count,
    MAX(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END) AS liked_by_me,
    COALESCE((SELECT SUM(amount) FROM star_transactions
              WHERE type = 'donation_out' AND target_cat_id = c.id), 0) AS donations_total,
    u.first_name AS owner_name
  FROM cats c
  JOIN users u ON c.owner_id = u.id
  JOIN ratings r ON r.cat_id = c.id
  LEFT JOIN cat_likes cl ON cl.cat_id = c.id
`;

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const period = (req.query.period as string) || 'all';

  const mapRow = (row: Record<string, unknown>) => ({ ...row, liked_by_me: Boolean(row.liked_by_me) });

  if (period === 'all') {
    const entries = db.prepare(`
      ${BASE_QUERY}
      GROUP BY c.id HAVING COUNT(DISTINCT r.id) >= 1
      ORDER BY avg_score DESC, donations_total DESC, vote_count DESC LIMIT 20
    `).all(req.userId!) as Array<Record<string, unknown>>;
    res.json(entries.map(mapRow));
    return;
  }

  const offset = PERIOD_MAP[period];
  if (!offset) {
    res.status(400).json({ error: 'period must be all, daily, weekly, or monthly' });
    return;
  }

  const entries = db.prepare(`
    ${BASE_QUERY}
    WHERE r.created_at >= datetime('now', ?)
    GROUP BY c.id HAVING COUNT(DISTINCT r.id) >= 1
    ORDER BY avg_score DESC, vote_count DESC LIMIT 20
  `).all(req.userId!, offset) as Array<Record<string, unknown>>;

  res.json(entries.map(mapRow));
});

export default router;
