import { db } from '../db';
import type { PosoGift } from './poso';

export interface FrogRow {
  id: number;
  gift_id: string;
  slug: string;
  number: number;
  model: string;
  backdrop: string;
  pattern: string;
  model_rarity: number | null;
  backdrop_rarity: number | null;
  pattern_rarity: number | null;
  image_url: string | null;
  lottie_url: string | null;
  owner_id: number | null;
  owner_username: string | null;
  owner_telegram_id: string | null;
}

export function upsertFrog(g: PosoGift, ownerId: number | null): FrogRow {
  const ownerUn = g.owner_username ?? null;
  const ownerTg = g.owner_telegram_id ?? null;

  db.prepare(`DELETE FROM frogs WHERE gift_id = ? AND slug <> ?`).run(g.gift_id, g.slug);

  db.prepare(`
    INSERT INTO frogs
      (gift_id, slug, number, model, backdrop, pattern,
       model_rarity, backdrop_rarity, pattern_rarity,
       image_url, lottie_url, owner_id, owner_username, owner_telegram_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      gift_id = excluded.gift_id,
      model = excluded.model,
      backdrop = excluded.backdrop,
      pattern = excluded.pattern,
      model_rarity = COALESCE(excluded.model_rarity, frogs.model_rarity),
      backdrop_rarity = COALESCE(excluded.backdrop_rarity, frogs.backdrop_rarity),
      pattern_rarity = COALESCE(excluded.pattern_rarity, frogs.pattern_rarity),
      image_url = COALESCE(excluded.image_url, frogs.image_url),
      lottie_url = COALESCE(excluded.lottie_url, frogs.lottie_url),
      owner_id = COALESCE(excluded.owner_id, frogs.owner_id),
      owner_username = COALESCE(excluded.owner_username, frogs.owner_username),
      owner_telegram_id = COALESCE(excluded.owner_telegram_id, frogs.owner_telegram_id),
      updated_at = datetime('now')
  `).run(
    g.gift_id, g.slug, g.number, g.model, g.backdrop, g.pattern,
    g.model_rarity ?? null, g.backdrop_rarity ?? null, g.pattern_rarity ?? null,
    g.image_url ?? null, g.lottie_url ?? null, ownerId, ownerUn, ownerTg,
  );
  return db.prepare('SELECT * FROM frogs WHERE slug = ?').get(g.slug) as FrogRow;
}
