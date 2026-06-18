// Эндпоинты для просмотра чужих коллекций (китов и не только).

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { fetchUserGifts } from '../services/poso';
import { upsertFrog } from '../services/frogs';
import { getWhales, getStoredWhales, hasStoredWhales } from '../services/whales';

const router = Router();

// Топ-холдеры KissedFrog (киты).
// Если userbot уже наполнил таблицу — отдаём из БД (быстро, стабильно).
// Иначе — live-фоллбэк на poso.see.tg.
router.get('/whales', authMiddleware, async (_req: AuthRequest, res) => {
  if (hasStoredWhales()) { res.json(getStoredWhales()); return; }
  res.json(await getWhales());
});

// Просмотр коллекции другого юзера по telegram_id (от китов прилетает оттуда же).
// Если юзера ещё нет у нас — подтянем его подарки прямо в нашу БД, чтоб дальше
// можно было сделать запрос на обмен по конкретной лягушке.
router.get('/by-tg/:tg/frogs', authMiddleware, async (req: AuthRequest, res) => {
  const tg = Array.isArray(req.params.tg) ? req.params.tg[0] : req.params.tg;

  // Сначала — что у нас уже есть
  const existing = db.prepare(`
    SELECT id, slug, number, model, backdrop, pattern, image_url, owner_username, owner_telegram_id
    FROM frogs WHERE owner_telegram_id = ?
    ORDER BY number DESC
  `).all(tg) as Array<{ id: number; slug: string; number: number; model: string; backdrop: string; pattern: string; image_url: string | null; owner_username: string | null; owner_telegram_id: string | null }>;

  // если давно/нет — тянем с poso в фоне (но возвращаем сразу что есть)
  if (existing.length === 0) {
    const gifts = await fetchUserGifts({ telegramId: tg });
    if (gifts.length > 0) {
      // upsert БЕЗ привязки к локальному userId — может быть, юзер ещё не заходил в SWAMP
      const tx = db.transaction(() => {
        for (const g of gifts) upsertFrog(g, null);
      });
      tx();
      const refreshed = db.prepare(`
        SELECT id, slug, number, model, backdrop, pattern, image_url, owner_username, owner_telegram_id
        FROM frogs WHERE owner_telegram_id = ?
        ORDER BY number DESC
      `).all(tg);
      res.json(refreshed);
      return;
    }
  }
  res.json(existing);
});

export default router;
