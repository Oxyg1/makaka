// Эндпоинты для просмотра чужих коллекций (китов и не только).

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { randomBytes } from 'crypto';
import { fetchUserGifts } from '../services/poso';
import { upsertFrog } from '../services/frogs';
import { getWhales, getStoredWhales, hasStoredWhales } from '../services/whales';
import { attachColors } from '../services/colors';
import { verifyTonProof, type IncomingProof } from '../services/tonproof';

const router = Router();

// in-memory челленджи на привязку кошелька (payload, который кошелёк подпишет)
const challenges = new Map<number, { payload: string; exp: number }>();

function userTg(userId?: number): string | null {
  const u = db.prepare(`SELECT telegram_id FROM users WHERE id = ?`).get(userId) as { telegram_id: string } | undefined;
  return u?.telegram_id ?? null;
}

// Выдать nonce для ton_proof.
router.get('/wallet/challenge', authMiddleware, (req: AuthRequest, res) => {
  const payload = randomBytes(32).toString('hex');
  challenges.set(req.userId!, { payload, exp: Date.now() + 15 * 60 * 1000 });
  res.json({ payload });
});

// Список привязанных кошельков.
router.get('/wallet', authMiddleware, (req: AuthRequest, res) => {
  const tg = userTg(req.userId);
  const rows = tg ? db.prepare(`SELECT address FROM wallet_links WHERE telegram_id = ?`).all(tg) : [];
  res.json(rows);
});

// Привязать кошелёк по ton_proof.
router.post('/wallet/link', authMiddleware, (req: AuthRequest, res) => {
  const ch = challenges.get(req.userId!);
  if (!ch || ch.exp < Date.now()) { res.status(400).json({ error: 'Сессия истекла, попробуйте снова' }); return; }
  const r = verifyTonProof(req.body as IncomingProof, ch.payload);
  if (!r.ok || !r.address) { res.status(400).json({ error: `Кошелёк не подтверждён: ${r.error}` }); return; }
  challenges.delete(req.userId!);
  const tg = userTg(req.userId);
  if (!tg) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
  db.prepare(`INSERT INTO wallet_links (address, telegram_id) VALUES (?, ?)
    ON CONFLICT(address) DO UPDATE SET telegram_id = excluded.telegram_id, created_at = datetime('now')`)
    .run(r.address, tg);
  res.json({ ok: true, address: r.address });
});

// Отвязать кошелёк.
router.delete('/wallet', authMiddleware, (req: AuthRequest, res) => {
  const tg = userTg(req.userId);
  const addr = typeof req.query.address === 'string' ? req.query.address : null;
  if (tg && addr) db.prepare(`DELETE FROM wallet_links WHERE address = ? AND telegram_id = ?`).run(addr, tg);
  res.json({ ok: true });
});

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
      `).all(tg) as Record<string, unknown>[];
      res.json(attachColors(refreshed));
      return;
    }
  }
  res.json(attachColors(existing as unknown as Record<string, unknown>[]));
});

// Коллекция кошелька (холдер без telegram-аккаунта) — по TON-адресу.
router.get('/by-addr/:addr/frogs', authMiddleware, (req: AuthRequest, res) => {
  const addr = Array.isArray(req.params.addr) ? req.params.addr[0] : req.params.addr;
  const rows = db.prepare(`
    SELECT id, slug, number, model, backdrop, pattern, image_url, owner_username, owner_telegram_id, owner_address
    FROM frogs WHERE owner_address = ?
    ORDER BY number DESC
  `).all(addr) as Record<string, unknown>[];
  res.json(attachColors(rows));
});

export default router;
