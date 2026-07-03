// ── Игровая экономика SWAMP: «Монеты», анти-чит, цены ─────────────────
//
// Все начисления и списания монет идут ТОЛЬКО через этот модуль:
//   - addCoins() пишет транзакцию + атомарно двигает баланс,
//   - анти-чит: очки за раунд капаются константами, дневной заработок
//     на игру ограничен, кликер валидируется по формулам апгрейдов
//     (те же формулы, что на клиенте) × прошедшее время.
//
// Монетизация (sink → source):
//   заработок: очки игр → монеты по курсу COIN_RATE + дневной бонус
//              + ачивки кликера (первая покупка каждого тира);
//   траты:     бусты BOOST_PRICES внутри игр;
//   пополнение: пакеты COIN_PACKS за Telegram Stars (routes/coins.ts).

import { db } from '../db';

export const GAME_IDS = ['merge', 'mosquito', 'clicker'] as const;
export type GameId = (typeof GAME_IDS)[number];
export function isGameId(v: string): v is GameId {
  return (GAME_IDS as readonly string[]).includes(v);
}

// ── Экономика: константы ──────────────────────────────────────────────
// Калибровка: монета ≈ 1 Star ≈ 1.2₽. Бесплатный потолок ~125 монет/день
// (3 игры × 200/кап недостижим за разумную сессию) — монеты ощущаются
// ценными, бусты подталкивают к магазину.
export const DAILY_BONUS = 25;              // монет за первый вход в игры за день
export const DAILY_EARN_CAP = 200;          // потолок заработка монет с одной игры в день

// Сколько ОЧКОВ стоит 1 монета (курс конвертации результата раунда).
export const COIN_RATE: Record<GameId, number> = { merge: 25, mosquito: 15, clicker: 0 /* монеты только за ачивки */ };

// Потолок очков за один раунд (анти-чит). Выше — обрезаем.
// Комары: серия ×2 (буст) и золотые ×3 дают до ~4.5к за идеальный раунд.
export const ROUND_CAPS: Record<GameId, number> = { merge: 20000, mosquito: 5200, clicker: 0 };

// Минимальный интервал между зачётами раундов, сек (нельзя слать очки очередью).
export const ROUND_MIN_INTERVAL: Record<GameId, number> = { merge: 25, mosquito: 30, clicker: 0 };

// Цены бустов (id → монеты). Клиент присылает только id — цену берём здесь.
export const BOOST_PRICES: Record<string, number> = {
  'merge:field5': 300,      // расширение поля 4×4 → 5×5 (навсегда)
  'merge:potion': 60,       // зелье: спавн ×2 быстрее на 60 сек
  'merge:unfreeze': 30,     // разморозить замёрзшую клетку
  'mosquito:time': 40,      // +15 сек к раунду
  'mosquito:zone': 30,      // увеличенная зона тапа на раунд
  'mosquito:double': 50,    // двойные очки на раунд
  'clicker:frenzy': 100,    // клик ×2 на 1 час
  'clicker:golden': 500,    // золотая лягушка: постоянный множитель ×1.5
  'clicker:skip': 200,      // скидка 50% на следующий апгрейд
};

// Пакеты монет за Telegram Stars (XTR). База 1⭐ = 1 монета,
// крупные пакеты — со скидкой по звёздам (100⭐ ≈ 120₽).
export const COIN_PACKS: Record<string, { coins: number; stars: number }> = {
  p100: { coins: 100, stars: 100 },    // ~120₽
  p500: { coins: 500, stars: 450 },    // −10%
  p1500: { coins: 1500, stars: 1275 }, // −15%
  p5000: { coins: 5000, stars: 4000 }, // −20%
};

// Произвольная сумма пополнения (1⭐ = 1 монета, без скидки).
export const CUSTOM_PURCHASE = { min: 50, max: 100_000 };

// ── Формулы кликера (зеркало клиентских — по ним валидируем скорость) ─
export const CLICKER = {
  clickPower: (lvl: number) => 1 + lvl,
  maxClicksPerSec: 12,
  // pps одного помощника каждого тира и число тиров
  helperPps: [1, 4, 15, 50, 160, 500, 1500, 5000],
  tierMilestoneCoins: (tier: number) => 10 * (tier + 1), // монет за ПЕРВУЮ покупку тира
  completionCoins: 200,                                   // за покупку последнего тира
  // клиент считает оффлайн как 25% pps максимум за 2ч; серверный кап
  // чуть шире (люфт на несинхронные часы), но тоже жёсткий
  offlineCapSec: 2.5 * 3600,
};

export interface ClickerState {
  points?: number;            // текущие очки (тратятся на апгрейды)
  clickLevel?: number;
  helpers?: number[];         // количество помощников по тирам
  golden?: boolean;
  frenzyUntil?: number;
}

export function clickerPps(state: ClickerState): number {
  const helpers = Array.isArray(state.helpers) ? state.helpers : [];
  let pps = 0;
  for (let i = 0; i < CLICKER.helperPps.length; i++) pps += (helpers[i] ?? 0) * CLICKER.helperPps[i];
  return state.golden ? pps * 1.5 : pps;
}

// Максимально правдоподобный прирост totalEarned кликера за elapsed секунд.
export function clickerMaxGain(prevState: ClickerState, elapsedSec: number): number {
  const power = CLICKER.clickPower(prevState.clickLevel ?? 0) * (prevState.golden ? 1.5 : 1) * 2; // ×2 на случай frenzy
  const active = power * CLICKER.maxClicksPerSec * Math.min(elapsedSec, 6 * 3600);
  const passive = clickerPps(prevState) * Math.min(elapsedSec, CLICKER.offlineCapSec);
  return Math.ceil((active + passive) * 1.3) + 50; // +30% и константа — люфт на лаги/новые апгрейды
}

// ── Монеты: базовые операции ──────────────────────────────────────────
export function getBalance(tg: string): number {
  const row = db.prepare(`SELECT balance FROM user_coins WHERE telegram_id = ?`).get(tg) as { balance: number } | undefined;
  return row?.balance ?? 0;
}

/** Атомарно: транзакция в лог + баланс. delta<0 — списание (упадёт, если не хватает). */
export const addCoins = db.transaction((tg: string, delta: number, reason: string, game: string | null) => {
  if (!Number.isFinite(delta) || delta === 0) return getBalance(tg);
  if (delta < 0 && getBalance(tg) + delta < 0) throw new Error('INSUFFICIENT');
  db.prepare(`
    INSERT INTO user_coins (telegram_id, balance) VALUES (?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = datetime('now')
  `).run(tg, delta);
  db.prepare(`INSERT INTO coin_transactions (telegram_id, delta, reason, game) VALUES (?, ?, ?, ?)`)
    .run(tg, delta, reason, game);
  return getBalance(tg);
});

/** Сколько монет юзер уже заработал сегодня (UTC) в конкретной игре. */
export function earnedToday(tg: string, game: GameId): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(delta), 0) AS s FROM coin_transactions
    WHERE telegram_id = ? AND game = ? AND delta > 0
      AND reason LIKE 'earn:%' AND date(created_at) = date('now')
  `).get(tg, game) as { s: number };
  return row.s;
}

export function dailyClaimedToday(tg: string): boolean {
  const row = db.prepare(`
    SELECT 1 AS x FROM coin_transactions
    WHERE telegram_id = ? AND reason = 'daily' AND date(created_at) = date('now') LIMIT 1
  `).get(tg);
  return !!row;
}

export function hasTransaction(tg: string, reason: string): boolean {
  return !!db.prepare(`SELECT 1 FROM coin_transactions WHERE telegram_id = ? AND reason = ? LIMIT 1`).get(tg, reason);
}

// ── Прогресс игр ──────────────────────────────────────────────────────
export interface ProgressRow {
  telegram_id: string;
  game_id: string;
  level: number;
  score: number;
  state_json: string | null;
  updated_at: string;
}

export function getProgress(tg: string, game: GameId): ProgressRow | undefined {
  return db.prepare(`SELECT * FROM game_progress WHERE telegram_id = ? AND game_id = ?`).get(tg, game) as ProgressRow | undefined;
}

export function saveProgress(tg: string, game: GameId, patch: { level?: number; score?: number; state?: unknown }) {
  const prev = getProgress(tg, game);
  const level = patch.level ?? prev?.level ?? 0;
  const score = patch.score ?? prev?.score ?? 0;
  const state = patch.state !== undefined ? JSON.stringify(patch.state) : prev?.state_json ?? null;
  db.prepare(`
    INSERT INTO game_progress (telegram_id, game_id, level, score, state_json, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(telegram_id, game_id) DO UPDATE SET
      level = excluded.level, score = excluded.score,
      state_json = excluded.state_json, updated_at = datetime('now')
  `).run(tg, game, level, score, state);
}

export function getRank(tg: string, game: GameId): { rank: number | null; players: number } {
  const players = (db.prepare(`SELECT COUNT(*) AS c FROM game_progress WHERE game_id = ? AND score > 0`).get(game) as { c: number }).c;
  const mine = getProgress(tg, game);
  if (!mine || mine.score <= 0) return { rank: null, players };
  const above = (db.prepare(`SELECT COUNT(*) AS c FROM game_progress WHERE game_id = ? AND score > ?`).get(game, mine.score) as { c: number }).c;
  return { rank: above + 1, players };
}

export function getLeaderboard(game: GameId, limit = 100) {
  return db.prepare(`
    SELECT gp.telegram_id, gp.score, gp.level,
           u.first_name AS name, u.username, u.photo_url
    FROM game_progress gp
    LEFT JOIN users u ON u.telegram_id = gp.telegram_id
    WHERE gp.game_id = ? AND gp.score > 0
    ORDER BY gp.score DESC, gp.updated_at ASC
    LIMIT ?
  `).all(game, limit);
}

export function tgOfUser(userId?: number): string | null {
  const u = db.prepare(`SELECT telegram_id FROM users WHERE id = ?`).get(userId) as { telegram_id: string } | undefined;
  return u?.telegram_id ?? null;
}
