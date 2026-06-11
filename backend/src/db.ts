import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'cats.db');
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
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    breed TEXT,
    age INTEGER,
    description TEXT,
    photo_url TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER NOT NULL REFERENCES cats(id),
    rater_id INTEGER NOT NULL REFERENCES users(id),
    score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 10),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(cat_id, rater_id)
  );

  CREATE TABLE IF NOT EXISTS skips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER NOT NULL REFERENCES cats(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(cat_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    total_rated INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    last_rated_date TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_ratings_cat_id ON ratings(cat_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON ratings(rater_id);
  CREATE INDEX IF NOT EXISTS idx_cats_owner ON cats(owner_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_created ON ratings(created_at);
  CREATE INDEX IF NOT EXISTS idx_skips_user ON skips(user_id);

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    photo_url TEXT NOT NULL,
    caption TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(post_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);

  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    actor_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    text TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id);

  CREATE TABLE IF NOT EXISTS cat_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER NOT NULL REFERENCES cats(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(cat_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_cat_likes_cat ON cat_likes(cat_id);

  CREATE TABLE IF NOT EXISTS cat_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_cat_photos_cat ON cat_photos(cat_id);

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    telegram_payment_charge_id TEXT UNIQUE,
    feature TEXT NOT NULL,
    entity_id INTEGER,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

try { db.exec('ALTER TABLE users ADD COLUMN photo_url TEXT'); } catch { /* column already exists */ }
try { db.exec('ALTER TABLE star_transactions ADD COLUMN target_cat_id INTEGER'); } catch { /* exists */ }
try { db.exec('ALTER TABLE star_transactions ADD COLUMN target_post_id INTEGER'); } catch { /* exists */ }
try { db.exec('ALTER TABLE user_stats ADD COLUMN last_reminded_date TEXT'); } catch { /* exists */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS user_balance (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    balance INTEGER NOT NULL DEFAULT 0,
    total_received INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS star_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    related_user_id INTEGER REFERENCES users(id),
    telegram_charge_id TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_star_tx_user ON star_transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_star_tx_type ON star_transactions(type);

  CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    admin_note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_withdraw_status ON withdrawal_requests(status);

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
`);
