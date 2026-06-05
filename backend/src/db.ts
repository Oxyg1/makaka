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

  CREATE INDEX IF NOT EXISTS idx_ratings_cat_id ON ratings(cat_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON ratings(rater_id);
  CREATE INDEX IF NOT EXISTS idx_cats_owner ON cats(owner_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_created ON ratings(created_at);
`);
