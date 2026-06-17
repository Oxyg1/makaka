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
}

export function upsertFrog(g: PosoGift, ownerId: number | null): FrogRow {
  const ownerUn = g.owner_username ?? null;
  db.prepare(`
    INSERT INTO frogs
      (gift_id, slug, number, model, backdrop, pattern,
       model_rarity, backdrop_rarity, pattern_rarity,
       image_url, lottie_url, owner_id, owner_username, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
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
      updated_at = datetime('now')
  `).run(
    g.gift_id, g.slug, g.number, g.model, g.backdrop, g.pattern,
    g.model_rarity ?? null, g.backdrop_rarity ?? null, g.pattern_rarity ?? null,
    g.image_url ?? null, g.lottie_url ?? null, ownerId, ownerUn,
  );
  return db.prepare('SELECT * FROM frogs WHERE slug = ?').get(g.slug) as FrogRow;
}

export function setOwner(frogId: number, ownerId: number | null) {
  db.prepare(`UPDATE frogs SET owner_id = ?, updated_at = datetime('now') WHERE id = ?`).run(ownerId, frogId);
}
