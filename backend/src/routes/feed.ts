import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `post_${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'));
  },
});

// GET /api/feed?offset=0
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;

  const posts = db.prepare(`
    SELECT p.id, p.user_id, p.photo_url, p.caption, p.created_at,
      u.first_name AS author_name, u.username AS author_username,
      COUNT(pl.id) AS likes_count,
      MAX(CASE WHEN pl.user_id = ? THEN 1 ELSE 0 END) AS liked_by_me
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN post_likes pl ON pl.post_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 20 OFFSET ?
  `).all(req.userId!, offset) as Array<Record<string, unknown>>;

  res.json(posts.map(row => ({ ...row, liked_by_me: Boolean(row.liked_by_me) })));
});

// POST /api/feed
router.post('/', authMiddleware, upload.single('photo'), async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Photo is required' });
    return;
  }

  const { caption } = req.body as Record<string, string>;

  try {
    await sharp(req.file.path)
      .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(req.file.path + '.opt');
    fs.renameSync(req.file.path + '.opt', req.file.path);
  } catch {
    // sharp optional
  }

  const photoUrl = `/uploads/${req.file.filename}`;

  const post = db.prepare(`
    INSERT INTO posts (user_id, photo_url, caption)
    VALUES (?, ?, ?)
    RETURNING *
  `).get(req.userId!, photoUrl, caption?.trim() || null) as Record<string, unknown>;

  res.status(201).json({ ...post, likes_count: 0, liked_by_me: false });
});

// POST /api/feed/:id/like
router.post('/:id/like', authMiddleware, (req: AuthRequest, res) => {
  const postId = parseInt(String(req.params.id), 10);

  const existing = db.prepare(
    'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?'
  ).get(postId, req.userId!);

  if (existing) {
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(postId, req.userId!);
  } else {
    db.prepare('INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)').run(postId, req.userId!);
  }

  const { likes_count } = db.prepare(
    'SELECT COUNT(*) AS likes_count FROM post_likes WHERE post_id = ?'
  ).get(postId) as { likes_count: number };

  res.json({ liked: !existing, likes_count });
});

export default router;
