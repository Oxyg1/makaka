// Приём данных от внешнего userbot'а (раз в день).
// Защита — общий секрет в заголовке X-Ingest-Secret (env INGEST_SECRET).
//
//   POST /api/ingest/whales  { holders: [{ telegram_id, username?, name?, photo_url?, gifts_count }] }
//   POST /api/ingest/frogs   { frogs:   [{ gift_id, slug, number, model, backdrop, pattern, ... }] }
//   GET  /api/ingest/stats   — что лежит в БД (для проверки после прогона)
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
  try {
    const holders: IncomingWhale[] = Array.isArray(req.body?.holders) ? req.body.holders : [];
    const count = replaceWhales(holders);
    logger.info(`ingest: replaced whales with ${count} rows`);
    res.json({ ok: true, count });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(`ingest /whales failed: ${message}`);
    res.status(500).json({ ok: false, error: message });
  }
});

router.post('/frogs', guard, (req: Request, res: Response) => {
  const frogs: unknown[] = Array.isArray(req.body?.frogs) ? req.body.frogs : [];
  let count = 0;
  const errors: string[] = [];
  try {
    const tx = db.transaction(() => {
      for (const raw of frogs) {
        const g = raw as Partial<PosoGift>;
        if (!g.gift_id || !g.slug || g.number === undefined || !g.model || !g.backdrop || !g.pattern) continue;
        try { upsertFrog(g as PosoGift, null); count++; }
        catch (e) { if (errors.length < 5) errors.push(`${g.slug}: ${e instanceof Error ? e.message : String(e)}`); }
      }
    });
    tx();
    logger.info(`ingest: upserted ${count}/${frogs.length} frogs` + (errors.length ? ` (errs: ${errors.join('; ')})` : ''));
    res.json({ ok: true, count, received: frogs.length, errors });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(`ingest /frogs failed: ${message}`);
    res.status(500).json({ ok: false, error: message, count });
  }
});

// Что реально лежит в БД — удобно проверить после прогона userbot'а.
router.get('/stats', guard, (_req: Request, res: Response) => {
  const w = db.prepare(`SELECT COUNT(*) AS c FROM whales`).get() as { c: number };
  const f = db.prepare(`SELECT COUNT(*) AS c FROM frogs`).get() as { c: number };
  const topWhales = db.prepare(
    `SELECT telegram_id, username, name, gifts_count FROM whales ORDER BY gifts_count DESC LIMIT 10`,
  ).all();
  const sampleFrogs = db.prepare(
    `SELECT slug, model, backdrop, pattern, owner_telegram_id FROM frogs ORDER BY id DESC LIMIT 10`,
  ).all();
  res.json({ whales: w.c, frogs: f.c, topWhales, sampleFrogs });
});

export default router;
