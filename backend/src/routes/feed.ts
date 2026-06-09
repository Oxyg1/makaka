import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { createNotification, sendBotMessage } from '../notifs';
import { logger } from '../logger';

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
      u.first_name AS author_name, u.username AS author_username, u.photo_url AS author_photo_url,
      COUNT(DISTINCT pl.id) AS likes_count,
      MAX(CASE WHEN pl.user_id = ? THEN 1 ELSE 0 END) AS liked_by_me,
      COUNT(DISTINCT pc.id) AS comments_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN post_likes pl ON pl.post_id = p.id
    LEFT JOIN post_comments pc ON pc.post_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 20 OFFSET ?
  `).all(req.userId!, offset) as Array<Record<string, unknown>>;

  res.json(posts.map(row => ({ ...row, liked_by_me: Boolean(row.liked_by_me) })));
});

// POST /api/feed
router.post('/', authMiddleware, upload.single('photo'), async (req: AuthRequest, res) => {
  logger.info('POST /feed', { userId: req.userId, hasFile: !!req.file, contentType: req.headers['content-type'] });
  if (!req.file) {
    logger.warn('POST /feed: no file received', { userId: req.userId, body: req.body });
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

  const user = db.prepare('SELECT first_name, username, photo_url FROM users WHERE id = ?').get(req.userId!) as { first_name: string; username: string | null; photo_url: string | null };
  logger.info('POST /feed: created', { userId: req.userId, postId: (post as Record<string, unknown>).id });
  res.status(201).json({ ...post, author_name: user.first_name, author_username: user.username, author_photo_url: user.photo_url, likes_count: 0, liked_by_me: false, comments_count: 0 });
});

// DELETE /api/feed/comments/:id — must be before /:id to avoid param collision
router.delete('/comments/:id', authMiddleware, (req: AuthRequest, res) => {
  const commentId = parseInt(String(req.params.id), 10);
  const comment = db.prepare('SELECT id, user_id FROM post_comments WHERE id = ?').get(commentId) as { id: number; user_id: number } | undefined;
  if (!comment) { res.status(404).json({ error: 'Comment not found' }); return; }
  if (comment.user_id !== req.userId) { res.status(403).json({ error: 'Not your comment' }); return; }
  db.prepare('DELETE FROM post_comments WHERE id = ?').run(commentId);
  res.json({ success: true });
});

// DELETE /api/feed/:id
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  const postId = parseInt(String(req.params.id), 10);
  const post = db.prepare('SELECT id, user_id, photo_url FROM posts WHERE id = ?').get(postId) as { id: number; user_id: number; photo_url: string } | undefined;
  if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
  if (post.user_id !== req.userId) { res.status(403).json({ error: 'Not your post' }); return; }

  db.prepare('DELETE FROM post_likes WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM post_comments WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM posts WHERE id = ?').run(postId);

  const filePath = path.join(uploadsDir, path.basename(post.photo_url));
  try { fs.unlinkSync(filePath); } catch { /* already gone */ }

  res.json({ success: true });
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
    const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId) as { user_id: number } | undefined;
    if (post) {
      createNotification({ userId: post.user_id, actorId: req.userId!, type: 'like', entityType: 'post', entityId: postId });
      const owner = db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(post.user_id) as { telegram_id: string } | undefined;
      const liker = db.prepare('SELECT first_name FROM users WHERE id = ?').get(req.userId!) as { first_name: string } | undefined;
      if (owner && liker) sendBotMessage(owner.telegram_id, `❤️ <b>${liker.first_name}</b> лайкнул ваш пост`);
    }
  }

  const { likes_count } = db.prepare(
    'SELECT COUNT(*) AS likes_count FROM post_likes WHERE post_id = ?'
  ).get(postId) as { likes_count: number };

  res.json({ liked: !existing, likes_count });
});

// GET /api/feed/:id/comments
router.get('/:id/comments', authMiddleware, (req: AuthRequest, res) => {
  const postId = parseInt(String(req.params.id), 10);
  const comments = db.prepare(`
    SELECT pc.id, pc.post_id, pc.user_id, pc.text, pc.created_at,
      u.first_name AS author_name, u.username AS author_username, u.photo_url AS author_photo_url
    FROM post_comments pc
    JOIN users u ON pc.user_id = u.id
    WHERE pc.post_id = ?
    ORDER BY pc.created_at ASC
    LIMIT 50
  `).all(postId);
  res.json(comments);
});

// POST /api/feed/:id/comments
router.post('/:id/comments', authMiddleware, (req: AuthRequest, res) => {
  const postId = parseInt(String(req.params.id), 10);
  const { text } = req.body as { text?: string };

  if (!text?.trim()) { res.status(400).json({ error: 'Text is required' }); return; }
  if (text.length > 500) { res.status(400).json({ error: 'Text too long' }); return; }

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) { res.status(404).json({ error: 'Post not found' }); return; }

  const comment = db.prepare(`
    INSERT INTO post_comments (post_id, user_id, text)
    VALUES (?, ?, ?)
    RETURNING *
  `).get(postId, req.userId!, text.trim()) as Record<string, unknown>;

  const user = db.prepare('SELECT first_name, username, photo_url FROM users WHERE id = ?').get(req.userId!) as { first_name: string; username: string | null; photo_url: string | null };

  const postOwner = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId) as { user_id: number } | undefined;
  if (postOwner) {
    createNotification({ userId: postOwner.user_id, actorId: req.userId!, type: 'comment', entityType: 'post', entityId: postId, text: text.trim() });
    const owner = db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(postOwner.user_id) as { telegram_id: string } | undefined;
    if (owner) sendBotMessage(owner.telegram_id, `💬 <b>${user.first_name}</b> прокомментировал ваш пост: ${text.trim().slice(0, 100)}`);
  }

  res.status(201).json({ ...comment, author_name: user.first_name, author_username: user.username, author_photo_url: user.photo_url });
});

export default router;
