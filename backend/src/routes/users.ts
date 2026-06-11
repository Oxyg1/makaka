import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

// GET /api/users/:id
router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  const userId = parseInt(String(req.params.id), 10);

  const user = db.prepare(`
    SELECT u.id, u.telegram_id, u.first_name, u.username, u.created_at,
      COALESCE(s.total_rated, 0) AS total_rated,
      COALESCE(s.total_skipped, 0) AS total_skipped,
      COALESCE(s.streak_days, 0) AS streak_days,
      (SELECT COUNT(*) FROM cats WHERE owner_id = u.id) AS cat_count,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS post_count
    FROM users u
    LEFT JOIN user_stats s ON s.user_id = u.id
    WHERE u.id = ?
  `).get(userId);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// GET /api/users/:id/cats
router.get('/:id/cats', authMiddleware, (req: AuthRequest, res) => {
  const userId = parseInt(String(req.params.id), 10);

  const cats = db.prepare(`
    SELECT c.id, c.name, c.breed, c.age, c.description, c.photo_url, c.created_at,
      ROUND(COALESCE(AVG(r.score), 0), 1) AS avg_score,
      COUNT(r.id) AS vote_count
    FROM cats c
    LEFT JOIN ratings r ON r.cat_id = c.id
    WHERE c.owner_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(userId);

  res.json(cats);
});

// GET /api/users/:id/posts
router.get('/:id/posts', authMiddleware, (req: AuthRequest, res) => {
  const userId = parseInt(String(req.params.id), 10);

  const posts = db.prepare(`
    SELECT p.id, p.user_id, p.photo_url, p.caption, p.created_at,
      u.first_name AS author_name, u.username AS author_username,
      COUNT(DISTINCT pl.id) AS likes_count,
      MAX(CASE WHEN pl.user_id = ? THEN 1 ELSE 0 END) AS liked_by_me,
      COUNT(DISTINCT pc.id) AS comments_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN post_likes pl ON pl.post_id = p.id
    LEFT JOIN post_comments pc ON pc.post_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(req.userId!, userId) as Array<Record<string, unknown>>;

  res.json(posts.map(row => ({ ...row, liked_by_me: Boolean(row.liked_by_me) })));
});

export default router;
