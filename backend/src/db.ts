import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'swamp.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT NOT NULL,
    photo_url TEXT,
    last_synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Каждая лягушка — уникальный NFT-подарок KissedFrog.
  -- Атрибуты редкости берутся из poso.see.tg.
  CREATE TABLE IF NOT EXISTS frogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gift_id TEXT UNIQUE NOT NULL,            -- внешний id из TG / poso
    slug TEXT UNIQUE NOT NULL,               -- KissedFrog-12345
    number INTEGER NOT NULL,                 -- #12345
    model TEXT NOT NULL,
    backdrop TEXT NOT NULL,
    pattern TEXT NOT NULL,
    model_rarity REAL,
    backdrop_rarity REAL,
    pattern_rarity REAL,
    image_url TEXT,
    lottie_url TEXT,
    owner_id INTEGER REFERENCES users(id),   -- null = unknown / wild
    owner_username TEXT,                     -- кэш для отображения если ещё нет user-а
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_frogs_owner ON frogs(owner_id);
  CREATE INDEX IF NOT EXISTS idx_frogs_model ON frogs(model);
  CREATE INDEX IF NOT EXISTS idx_frogs_backdrop ON frogs(backdrop);
  CREATE INDEX IF NOT EXISTS idx_frogs_pattern ON frogs(pattern);

  -- Открытый ордер на обмен / продажу. Один frog — один активный ордер.
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frog_id INTEGER NOT NULL REFERENCES frogs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK(kind IN ('trade','sell','any')),
    price_stars INTEGER,                     -- для sell / any
    wants_models TEXT,                       -- JSON-список желаемых моделей
    wants_backdrops TEXT,
    wants_patterns TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','locked','done','cancelled')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_active_frog
    ON orders(frog_id) WHERE status IN ('open','locked');

  -- Конкретное предложение между двумя сторонами.
  -- from_user предлагает свой frog (или звёзды) в обмен на to_frog у to_user.
  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    from_user_id INTEGER NOT NULL REFERENCES users(id),
    to_user_id INTEGER NOT NULL REFERENCES users(id),
    from_frog_id INTEGER REFERENCES frogs(id),
    to_frog_id INTEGER NOT NULL REFERENCES frogs(id),
    stars INTEGER,                           -- доп. звёзды от from -> to
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','accepted','declined','cancelled','awaiting_escrow','completed','expired')),
    from_escrow_at TEXT,                     -- когда from-сторона передала на эскроу
    to_escrow_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_offers_to ON offers(to_user_id, status);
  CREATE INDEX IF NOT EXISTS idx_offers_from ON offers(from_user_id, status);
  CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    actor_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    text TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, read);

  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL REFERENCES users(id),
    frog_id INTEGER NOT NULL REFERENCES frogs(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, frog_id)
  );
`);
