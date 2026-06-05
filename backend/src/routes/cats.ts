import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
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
      AND c.id NOT IN (
        SELECT cat_id FROM ratings WHERE rater_id = ?
      )
    GROUP BY c.id
    ORDER BY RANDOM()
    LIMIT 1
  `).get(req.userId, req.userId);

  if (!cat) {
    res.json(null);
    return;
  }
  res.json(cat);
});

// POST /api/cats/:id/rate
router.post('/:id/rate', authMiddleware, (req: AuthRequest, res) => {
  const catId = parseInt(req.params.id, 10);
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
    db.prepare('INSERT INTO ratings (cat_id, rater_id, score) VALUES (?, ?, ?)').run(catId, req.userId, score);
    res.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Already rated this cat' });
      return;
    }
    throw e;
  }
});

// POST /api/cats — submit a new cat
router.post('/', authMiddleware, upload.single('photo'), (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Photo is required' });
    return;
  }

  const { name, breed, age, description } = req.body as Record<string, string>;
  if (!name?.trim()) {
    res.status(400).json({ error: 'Cat name is required' });
    return;
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
