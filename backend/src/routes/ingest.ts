// Приём данных от внешнего userbot'а (раз в день).
// Защита — общий секрет в заголовке X-Ingest-Secret (env INGEST_SECRET).
//
//   POST /api/ingest/whales  { holders: [{ telegram_id, username?, name?, photo_url?, gifts_count }] }
//   POST /api/ingest/frogs   { frogs:   [{ gift_id, slug, number, model, backdrop, pattern, ... }] }
//
// /whales присылается целым снимком (полная замена), /frogs — батчами (upsert).

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { replaceWhales, type IncomingWhale } from '../services/whales';
import { upsertFrog } from '../services/frogs';
import type { PosoGift } from '../services/poso';
import { logger } from '../logger';

const router = Router();
const SECRET = process.env.INGEST_SECRET ?? '';

function guard(req: Request, res: Response, next: NextFunction) {
  if (!SECRET) { res.status(503).json({ error: 'ingest disabled: set INGEST_SECRET' }); return; }
  if (req.header('X-Ingest-Secret') !== SECRET) { res.status(401).json({ error: 'bad secret' }); return; }
  next();
}

router.post('/whales', guard, (req: Request, res: Response) => {
  const holders: IncomingWhale[] = Array.isArray(req.body?.holders) ? req.body.holders : [];
  const count = replaceWhales(holders);
  logger.info(`ingest: replaced whales with ${count} rows`);
  res.json({ ok: true, count });
});

router.post('/frogs', guard, (req: Request, res: Response) => {
  const frogs: unknown[] = Array.isArray(req.body?.frogs) ? req.body.frogs : [];
  let count = 0;
  const tx = db.transaction(() => {
    for (const raw of frogs) {
      const g = raw as Partial<PosoGift>;
      if (!g.gift_id || !g.slug || g.number === undefined || !g.model || !g.backdrop || !g.pattern) continue;
      try { upsertFrog(g as PosoGift, null); count++; } catch { /* skip bad row */ }
    }
  });
  tx();
  logger.info(`ingest: upserted ${count} frogs`);
  res.json({ ok: true, count });
});

export default router;
