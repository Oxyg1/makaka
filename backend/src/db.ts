import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'swamp.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 1. Создаём таблицы (если ещё нет).
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

  CREATE TABLE IF NOT EXISTS frogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gift_id TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    number INTEGER NOT NULL,
    model TEXT NOT NULL,
    backdrop TEXT NOT NULL,
    pattern TEXT NOT NULL,
    model_rarity REAL,
    backdrop_rarity REAL,
    pattern_rarity REAL,
    image_url TEXT,
    lottie_url TEXT,
    owner_id INTEGER REFERENCES users(id),
    owner_username TEXT,
    owner_telegram_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frog_id INTEGER NOT NULL REFERENCES frogs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    wants_models TEXT,
    wants_backdrops TEXT,
    wants_patterns TEXT,
    note TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    from_user_id INTEGER NOT NULL REFERENCES users(id),
    to_user_id INTEGER NOT NULL REFERENCES users(id),
    from_frog_id INTEGER NOT NULL REFERENCES frogs(id),
    to_frog_id INTEGER NOT NULL REFERENCES frogs(id),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','accepted','declined','cancelled')),
    accepted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

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

  -- Топ-холдеры KissedFrog. Наполняется ingest'ом (userbot раз в день).
  CREATE TABLE IF NOT EXISTS whales (
    telegram_id TEXT PRIMARY KEY,
    username TEXT,
    name TEXT,
    photo_url TEXT,
    gifts_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Цвета фонов из Telegram (парсер). Источник истины для палитры карточек.
  CREATE TABLE IF NOT EXISTS backdrops (
    name TEXT PRIMARY KEY,
    center_color TEXT,
    edge_color TEXT,
    pattern_color TEXT,
    text_color TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Аккаунты-маркеты/хранилища (Portals, MRKT, *Relayer и т.п.).
  -- Их прячем из холдеров и помечаем лягушек «на маркете».
  CREATE TABLE IF NOT EXISTS markets (
    telegram_id TEXT PRIMARY KEY,
    name TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Холдеры-кошельки (владелец = TON-адрес, не telegram-аккаунт).
  CREATE TABLE IF NOT EXISTS wallet_holders (
    address TEXT PRIMARY KEY,
    gifts_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Привязки кошельков к юзерам (после доказательства владения, TON Connect).
  CREATE TABLE IF NOT EXISTS wallet_links (
    address TEXT PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// 2. Миграции — добавляем недостающие колонки в старых БД.
function safeAlter(sql: string) { try { db.exec(sql); } catch { /* column exists */ } }
safeAlter(`ALTER TABLE frogs ADD COLUMN owner_telegram_id TEXT`);
safeAlter(`ALTER TABLE frogs ADD COLUMN owner_address TEXT`);

// 3. Создаём индексы (после того как все колонки точно на месте).
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_frogs_owner ON frogs(owner_id);
  CREATE INDEX IF NOT EXISTS idx_frogs_owner_tg ON frogs(owner_telegram_id);
  CREATE INDEX IF NOT EXISTS idx_frogs_owner_addr ON frogs(owner_address);
  CREATE INDEX IF NOT EXISTS idx_frogs_model ON frogs(model);
  CREATE INDEX IF NOT EXISTS idx_frogs_backdrop ON frogs(backdrop);
  CREATE INDEX IF NOT EXISTS idx_frogs_pattern ON frogs(pattern);

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_active_frog
    ON orders(frog_id) WHERE status = 'open';

  CREATE INDEX IF NOT EXISTS idx_offers_to ON offers(to_user_id, status);
  CREATE INDEX IF NOT EXISTS idx_offers_from ON offers(from_user_id, status);

  CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, read);

  CREATE INDEX IF NOT EXISTS idx_whales_count ON whales(gifts_count DESC);
`);
