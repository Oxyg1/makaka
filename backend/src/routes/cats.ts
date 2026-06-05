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

// GET /api/cats/next
router.get('/next', authMiddleware, (req: AuthRequest, res) => {
  const cat = db.prepare(`
    SELECT c.id, c.name, c.breed, c.age, c.description, c.photo_url,
      u.first_name AS owner_name,
      ROUND(COALESCE(AVG(r.score), 0), 1) AS avg_score,
      COUNT(r.id) AS vote_count
    FROM cats c
    JOIN users u ON c.owner_id = u.id
    LEFT JOIN ratings r ON r.cat_id = c.id
    WHERE c.owner_id != ?
      AND c.id NOT IN (SELECT cat_id FROM ratings WHERE rater_id = ?)
      AND c.id NOT IN (SELECT cat_id FROM skips WHERE user_id = ?)
    GROUP BY c.id
    ORDER BY RANDOM()
    LIMIT 1
  `).get(req.userId, req.userId, req.userId);

  res.json(cat ?? null);
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

  try {
    db.prepare('INSERT INTO ratings (cat_id, rater_id, score) VALUES (?, ?, ?)').run(catId, req.userId!, score);
    db.prepare('DELETE FROM skips WHERE cat_id = ? AND user_id = ?').run(catId, req.userId);
    updateStreak(req.userId!);
    res.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Already rated this cat' });
      return;
    }
    throw e;
  }
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

export default router;
