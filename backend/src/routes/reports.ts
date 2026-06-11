import { Router } from 'express';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { sendBotMessage, sendBotPhoto } from '../notifs';
import { ADMIN_TG_ID } from './stars';

const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// POST /api/reports { type: 'cat' | 'post', entityId, reason }
router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { type, entityId, reason } = req.body as { type: string; entityId: number; reason?: string };
  if (type !== 'cat' && type !== 'post') {
    res.status(400).json({ error: 'Invalid type' }); return;
  }
  if (!Number.isInteger(entityId)) {
    res.status(400).json({ error: 'Invalid entityId' }); return;
  }

  // entity must exist; grab photo_url for admin attachment
  const exists = type === 'cat'
    ? db.prepare('SELECT id, owner_id, photo_url, name FROM cats WHERE id = ?').get(entityId) as { id: number; owner_id: number; photo_url: string; name: string } | undefined
    : db.prepare('SELECT id, user_id AS owner_id, photo_url, caption AS name FROM posts WHERE id = ?').get(entityId) as { id: number; owner_id: number; photo_url: string; name: string | null } | undefined;
  if (!exists) { res.status(404).json({ error: 'Not found' }); return; }

  const r = db.prepare(`INSERT INTO reports (type, entity_id, reporter_id, reason) VALUES (?, ?, ?, ?) RETURNING id`)
    .get(type, entityId, req.userId!, (reason ?? '').slice(0, 500) || null) as { id: number };

  const reporter = db.prepare('SELECT first_name, username FROM users WHERE id = ?').get(req.userId!) as
    { first_name: string; username: string | null } | undefined;
  const owner = db.prepare('SELECT first_name, username FROM users WHERE id = ?').get(exists.owner_id) as
    { first_name: string; username: string | null } | undefined;

  const reporterTag = reporter?.username ? `@${reporter.username}` : reporter?.first_name ?? '?';
  const ownerTag = owner?.username ? `@${owner.username}` : owner?.first_name ?? '?';
  const label = type === 'cat' ? 'кот' : 'пост';
  const reasonLine = reason ? `\nПричина: <i>${reason.slice(0, 500).replace(/[<>]/g, '')}</i>` : '';
  const titleLine = exists.name ? `\nНазвание: «${String(exists.name).slice(0, 80).replace(/[<>]/g, '')}»` : '';

  const caption =
`<b>Жалоба #${r.id}</b>

Тип: ${label} #${entityId}${titleLine}
Автор контента: ${ownerTag}
Жалобщик: ${reporterTag}${reasonLine}

/delete_${type}_${entityId} — удалить
/ignore_${r.id} — отклонить жалобу`;

  // attach the offending photo so admin can judge without opening the app
  const photoPath = path.join(UPLOADS_DIR, path.basename(exists.photo_url));
  sendBotPhoto(ADMIN_TG_ID, photoPath, caption);

  res.json({ ok: true, reportId: r.id });
});

export default router;
