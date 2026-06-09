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

async function processImage(filePath: string, filename: string): Promise<void> {
  const thumbPath = path.join(uploadsDir, `thumb_${filename}`);
  await sharp(filePath)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);
  await sharp(filePath)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(filePath + '.opt');
  fs.renameSync(filePath + '.opt', filePath);
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
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

function updateStreak(userId: number): void {
  const today = new Date().toISOString().slice(0, 10);
  const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId) as {
    user_id: number; total_rated: number; total_skipped: number; streak_days: number; last_rated_date: string | null;
  } | undefined;

  if (!stats) {
    db.prepare(`INSERT INTO user_stats (user_id, total_rated, streak_days, last_rated_date) VALUES (?, 1, 1, ?)`).run(userId, today);
    return;
  }

  const last = stats.last_rated_date;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = (last === yesterday) ? stats.streak_days + 1 : (last === today ? stats.streak_days : 1);

  db.prepare(`
    UPDATE user_stats SET total_rated = total_rated + 1, streak_days = ?, last_rated_date = ? WHERE user_id = ?
  `).run(newStreak, today, userId);
}

// GET /api/cats/my — must be before /:id
router.get('/my', authMiddleware, (req: AuthRequest, res) => {
  const cats = db.prepare(`
    SELECT c.id, c.name, c.breed, c.age, c.description, c.photo_url, c.created_at,
      ROUND(COALESCE(AVG(r.score), 0), 1) AS avg_score,
      COUNT(r.id) AS vote_count
    FROM cats c
    LEFT JOIN ratings r ON r.cat_id = c.id
    WHERE c.owner_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(req.userId);
  res.json(cats);
});

// GET /api/cats/stats — must be before /:id
router.get('/stats', authMiddleware, (req: AuthRequest, res) => {
  const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(req.userId) as {
    total_rated: number; total_skipped: number; streak_days: number; last_rated_date: string | null;
  } | undefined;
  res.json(stats ?? { total_rated: 0, total_skipped: 0, streak_days: 0, last_rated_date: null });
});

// POST /api/cats/reset-ratings — clears user's ratings and skips so they can rate again
router.post('/reset-ratings', authMiddleware, (req: AuthRequest, res) => {
  const r1 = db.prepare('DELETE FROM ratings WHERE rater_id = ?').run(req.userId!);
  const r2 = db.prepare('DELETE FROM skips WHERE user_id = ?').run(req.userId!);
  logger.info('reset-ratings', { userId: req.userId, ratingsDeleted: r1.changes, skipsDeleted: r2.changes });
  res.json({ success: true });
});

// POST /api/cats/:id/like — must be before /:id
router.post('/:id/like', authMiddleware, (req: AuthRequest, res) => {
  const catId = parseInt(String(req.params.id), 10);
  const existing = db.prepare('SELECT id FROM cat_likes WHERE cat_id = ? AND user_id = ?').get(catId, req.userId!);
  if (existing) {
    db.prepare('DELETE FROM cat_likes WHERE cat_id = ? AND user_id = ?').run(catId, req.userId!);
  } else {
    db.prepare('INSERT OR IGNORE INTO cat_likes (cat_id, user_id) VALUES (?, ?)').run(catId, req.userId!);
  }
  const { likes_count } = db.prepare('SELECT COUNT(*) AS likes_count FROM cat_likes WHERE cat_id = ?').get(catId) as { likes_count: number };
  res.json({ liked: !existing, likes_count });
});

// GET /api/cats/next
router.get('/next', authMiddleware, (req: AuthRequest, res) => {
  const cat = db.prepare(`
    SELECT c.id, c.name, c.breed, c.age, c.description, c.photo_url, c.owner_id,
      u.first_name AS owner_name,
      ROUND(COALESCE(AVG(r.score), 0), 1) AS avg_score,
      COUNT(DISTINCT r.id) AS vote_count,
      COUNT(DISTINCT cl.id) AS likes_count,
      MAX(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END) AS liked_by_me
    FROM cats c
    JOIN users u ON c.owner_id = u.id
    LEFT JOIN ratings r ON r.cat_id = c.id
    LEFT JOIN cat_likes cl ON cl.cat_id = c.id
    WHERE c.owner_id != ?
      AND c.id NOT IN (SELECT cat_id FROM ratings WHERE rater_id = ?)
      AND c.id NOT IN (SELECT cat_id FROM skips WHERE user_id = ?)
    GROUP BY c.id
    ORDER BY RANDOM()
    LIMIT 1
  `).get(req.userId, req.userId, req.userId, req.userId) as Record<string, unknown> | undefined;
  if (!cat) {
    const total = (db.prepare('SELECT COUNT(*) AS n FROM cats WHERE owner_id != ?').get(req.userId) as { n: number }).n;
    logger.info('next: no cat available', { userId: req.userId, totalOtherCats: total });
    res.json(null); return;
  }
  const extraPhotos = (db.prepare('SELECT photo_url FROM cat_photos WHERE cat_id = ? ORDER BY sort_order').all(cat.id) as { photo_url: string }[]).map(r => r.photo_url);
  res.json({ ...cat, liked_by_me: Boolean(cat.liked_by_me), extra_photos: extraPhotos });
});

// POST /api/cats/:id/rate
router.post('/:id/rate', authMiddleware, (req: AuthRequest, res) => {
  const catId = parseInt(String(req.params.id), 10);
  const { score } = req.body as { score: unknown };

  if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 10) {
    res.status(400).json({ error: 'Score must be an integer between 1 and 10' });
    return;
  }

  const cat = db.prepare('SELECT id, owner_id FROM cats WHERE id = ?').get(catId) as { id: number; owner_id: number } | undefined;
  if (!cat) {
    res.status(404).json({ error: 'Cat not found' });
    return;
  }
  if (cat.owner_id === req.userId) {
    res.status(403).json({ error: 'Cannot rate your own cat' });
    return;
  }

  const isNew = !db.prepare('SELECT id FROM ratings WHERE cat_id = ? AND rater_id = ?').get(catId, req.userId!);
  db.prepare(`
    INSERT INTO ratings (cat_id, rater_id, score) VALUES (?, ?, ?)
    ON CONFLICT(cat_id, rater_id) DO UPDATE SET score = excluded.score, created_at = datetime('now')
  `).run(catId, req.userId!, score);
  db.prepare('DELETE FROM skips WHERE cat_id = ? AND user_id = ?').run(catId, req.userId);
  updateStreak(req.userId!);
  if (isNew) {
    createNotification({ userId: cat.owner_id, actorId: req.userId!, type: 'rating', entityType: 'cat', entityId: catId, text: `оценил вашего кота на ${score}/10` });
    const owner = db.prepare('SELECT telegram_id, first_name FROM users WHERE id = ?').get(cat.owner_id) as { telegram_id: string; first_name: string } | undefined;
    const rater = db.prepare('SELECT first_name FROM users WHERE id = ?').get(req.userId!) as { first_name: string } | undefined;
    if (owner && rater) sendBotMessage(owner.telegram_id, `⭐ <b>${rater.first_name}</b> оценил вашего кота на ${score}/10`);
  }
  res.json({ success: true });
});

// POST /api/cats/:id/skip
router.post('/:id/skip', authMiddleware, (req: AuthRequest, res) => {
  const catId = parseInt(String(req.params.id), 10);

  const cat = db.prepare('SELECT id FROM cats WHERE id = ?').get(catId);
  if (!cat) {
    res.status(404).json({ error: 'Cat not found' });
    return;
  }

  try {
    db.prepare('INSERT OR IGNORE INTO skips (cat_id, user_id) VALUES (?, ?)').run(catId, req.userId);

    const stats = db.prepare('SELECT user_id FROM user_stats WHERE user_id = ?').get(req.userId);
    if (stats) {
      db.prepare('UPDATE user_stats SET total_skipped = total_skipped + 1 WHERE user_id = ?').run(req.userId);
    } else {
      db.prepare('INSERT INTO user_stats (user_id, total_skipped) VALUES (?, 1)').run(req.userId);
    }

    res.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.json({ success: true });
      return;
    }
    throw e;
  }
});

// GET /api/cats/:id
router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  const catId = parseInt(String(req.params.id), 10);
  const cat = db.prepare(`
    SELECT c.id, c.owner_id, c.name, c.breed, c.age, c.description, c.photo_url, c.created_at,
      u.first_name AS owner_name,
      ROUND(COALESCE(AVG(r.score), 0), 1) AS avg_score,
      COUNT(r.id) AS vote_count
    FROM cats c
    JOIN users u ON c.owner_id = u.id
    LEFT JOIN ratings r ON r.cat_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(catId);
  if (!cat) { res.status(404).json({ error: 'Cat not found' }); return; }
  res.json(cat);
});

// PUT /api/cats/:id — update own cat metadata
router.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  const catId = parseInt(String(req.params.id), 10);
  const cat = db.prepare('SELECT id, owner_id FROM cats WHERE id = ?').get(catId) as { id: number; owner_id: number } | undefined;
  if (!cat) { res.status(404).json({ error: 'Cat not found' }); return; }
  if (cat.owner_id !== req.userId) { res.status(403).json({ error: 'Not your cat' }); return; }

  const { name, breed, age, description } = req.body as Record<string, string>;
  if (name !== undefined && !name.trim()) { res.status(400).json({ error: 'Cat name cannot be empty' }); return; }

  const ageInt = age !== undefined ? (age ? parseInt(age, 10) : null) : undefined;

  const updated = db.prepare(`
    UPDATE cats SET
      name = COALESCE(?, name),
      breed = CASE WHEN ? IS NOT NULL THEN ? ELSE breed END,
      age = CASE WHEN ? IS NOT NULL THEN ? ELSE age END,
      description = CASE WHEN ? IS NOT NULL THEN ? ELSE description END
    WHERE id = ?
    RETURNING *
  `).get(
    name?.trim() ?? null,
    breed !== undefined ? 1 : null, breed?.trim() || null,
    age !== undefined ? 1 : null, ageInt ?? null,
    description !== undefined ? 1 : null, description?.trim() || null,
    catId
  );

  res.json(updated);
});

// DELETE /api/cats/:id — delete own cat
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  const catId = parseInt(String(req.params.id), 10);
  const cat = db.prepare('SELECT id, owner_id, photo_url FROM cats WHERE id = ?').get(catId) as { id: number; owner_id: number; photo_url: string } | undefined;
  if (!cat) { res.status(404).json({ error: 'Cat not found' }); return; }
  if (cat.owner_id !== req.userId) { res.status(403).json({ error: 'Not your cat' }); return; }

  db.prepare('DELETE FROM ratings WHERE cat_id = ?').run(catId);
  db.prepare('DELETE FROM skips WHERE cat_id = ?').run(catId);
  db.prepare('DELETE FROM cats WHERE id = ?').run(catId);

  const filePath = path.join(uploadsDir, path.basename(cat.photo_url));
  const thumbPath = path.join(uploadsDir, `thumb_${path.basename(cat.photo_url)}`);
  try { fs.unlinkSync(filePath); } catch { /* already gone */ }
  try { fs.unlinkSync(thumbPath); } catch { /* no thumb */ }

  res.json({ success: true });
});

// POST /api/cats — submit a new cat
router.post('/', authMiddleware, upload.single('photo'), async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Photo is required' });
    return;
  }

  const { name, breed, age, description } = req.body as Record<string, string>;
  if (!name?.trim()) {
    res.status(400).json({ error: 'Cat name is required' });
    return;
  }

  try {
    await processImage(req.file.path, req.file.filename);
  } catch {
    // sharp optional
  }

  const photoUrl = `/uploads/${req.file.filename}`;
  const ageInt = age ? parseInt(age, 10) : null;

  const result = db.prepare(`
    INSERT INTO cats (owner_id, name, breed, age, description, photo_url)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `).get(req.userId, name.trim(), breed?.trim() || null, ageInt, description?.trim() || null, photoUrl);

  res.status(201).json(result);
});

// GET /api/cats/:id/photos
router.get('/:id/photos', authMiddleware, (req: AuthRequest, res) => {
  const catId = parseInt(String(req.params.id), 10);
  const photos = db.prepare('SELECT id, photo_url, sort_order FROM cat_photos WHERE cat_id = ? ORDER BY sort_order').all(catId);
  res.json(photos);
});

// POST /api/cats/:id/photos — upload extra photo
router.post('/:id/photos', authMiddleware, upload.single('photo'), async (req: AuthRequest, res) => {
  const catId = parseInt(String(req.params.id), 10);
  const cat = db.prepare('SELECT id, owner_id FROM cats WHERE id = ?').get(catId) as { id: number; owner_id: number } | undefined;
  if (!cat) { res.status(404).json({ error: 'Cat not found' }); return; }
  if (cat.owner_id !== req.userId) { res.status(403).json({ error: 'Not your cat' }); return; }
  if (!req.file) { res.status(400).json({ error: 'Photo is required' }); return; }

  try { await processImage(req.file.path, req.file.filename); } catch { /* sharp optional */ }

  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM cat_photos WHERE cat_id = ?').get(catId) as { m: number }).m;
  const photoUrl = `/uploads/${req.file.filename}`;
  const result = db.prepare(
    'INSERT INTO cat_photos (cat_id, photo_url, sort_order) VALUES (?, ?, ?) RETURNING id, photo_url, sort_order'
  ).get(catId, photoUrl, maxOrder + 1);

  res.status(201).json(result);
});

export default router;
