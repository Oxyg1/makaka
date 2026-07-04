// Мини-игры: прогресс, зачёт раундов, лидерборды, дневной бонус.
// Все монеты начисляются ЗДЕСЬ (на сервере) — клиент присылает только события.

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import {
  GAME_IDS, GameId, isGameId,
  DAILY_BONUS, DAILY_EARN_CAP, COIN_RATE, ROUND_CAPS, ROUND_MIN_INTERVAL,
  CLICKER, ClickerState, clickerMaxGain,
  addCoins, getBalance, earnedToday, dailyClaimedToday, hasTransaction,
  getProgress, saveProgress, getRank, getLeaderboard, tgOfUser,
} from '../services/games';

const router = Router();
router.use(authMiddleware);

function tgOr401(req: AuthRequest, res: { status: (n: number) => { json: (b: unknown) => void } }): string | null {
  const tg = tgOfUser(req.userId);
  if (!tg) res.status(401).json({ error: 'Пользователь не найден' });
  return tg;
}

// Конвертация очков раунда в монеты с учётом курса и дневного капа.
function awardRoundCoins(tg: string, game: GameId, roundScore: number): number {
  const rate = COIN_RATE[game];
  if (rate <= 0) return 0;
  const raw = Math.floor(roundScore / rate);
  const left = Math.max(0, DAILY_EARN_CAP - earnedToday(tg, game));
  const coins = Math.min(raw, left);
  if (coins > 0) addCoins(tg, coins, `earn:${game}`, game);
  return coins;
}

// ── Сводка для хаба «Игры» ────────────────────────────────────────────
router.get('/state', (req: AuthRequest, res) => {
  const tg = tgOr401(req, res); if (!tg) return;
  const games: Record<string, unknown> = {};
  for (const g of GAME_IDS) {
    const p = getProgress(tg, g);
    const { rank, players } = getRank(tg, g);
    games[g] = { best: p?.score ?? 0, level: p?.level ?? 0, rank, players, earned_today: earnedToday(tg, g), daily_cap: DAILY_EARN_CAP };
  }
  res.json({
    balance: getBalance(tg),
    daily_available: !dailyClaimedToday(tg),
    daily_bonus: DAILY_BONUS,
    games,
  });
});

// ── Дневной бонус ─────────────────────────────────────────────────────
router.post('/daily-bonus', (req: AuthRequest, res) => {
  const tg = tgOr401(req, res); if (!tg) return;
  if (dailyClaimedToday(tg)) { res.status(409).json({ error: 'Бонус уже получен сегодня' }); return; }
  const balance = addCoins(tg, DAILY_BONUS, 'daily', null);
  res.json({ ok: true, coins: DAILY_BONUS, balance });
});

// ── Прогресс: загрузка ────────────────────────────────────────────────
router.get('/:id/progress', (req: AuthRequest, res) => {
  const game = String(req.params.id);
  if (!isGameId(game)) { res.status(404).json({ error: 'Нет такой игры' }); return; }
  const tg = tgOr401(req, res); if (!tg) return;
  const p = getProgress(tg, game);
  let state: unknown = null;
  try { state = p?.state_json ? JSON.parse(p.state_json) : null; } catch { state = null; }
  res.json({ score: p?.score ?? 0, level: p?.level ?? 0, state, updated_at: p?.updated_at ?? null });
});

// ── Прогресс: сохранение ──────────────────────────────────────────────
// merge/mosquito: сохраняется только state (score двигает /score).
// clicker: score = totalEarned (монотонный), валидируем скорость прироста
//          по формулам апгрейдов × прошедшее время; ачивки за тиры → монеты.
router.post('/:id/progress', (req: AuthRequest, res) => {
  const game = String(req.params.id);
  if (!isGameId(game)) { res.status(404).json({ error: 'Нет такой игры' }); return; }
  const tg = tgOr401(req, res); if (!tg) return;

  const body = req.body as { state?: unknown; score?: number; level?: number };
  const prev = getProgress(tg, game);

  if (game !== 'clicker') {
    // состояние поля/настройки — без очков
    saveProgress(tg, game, { state: body.state, level: clampInt(body.level, 0, 99) ?? prev?.level });
    res.json({ ok: true, score: prev?.score ?? 0, balance: getBalance(tg), coins_earned: 0 });
    return;
  }

  // ── кликер ──
  const prevState: ClickerState = safeParse(prev?.state_json) ?? {};
  const newState: ClickerState = (body.state && typeof body.state === 'object' ? body.state : {}) as ClickerState;
  const prevScore = prev?.score ?? 0;
  const wantScore = clampInt(body.score, 0, 1e15) ?? prevScore;

  const elapsedSec = prev?.updated_at
    ? Math.max(1, (Date.now() - Date.parse(prev.updated_at + 'Z')) / 1000)
    : 60;
  const maxGain = clickerMaxGain(prevState, elapsedSec);
  const score = Math.max(prevScore, Math.min(wantScore, prevScore + maxGain)); // монотонно + кап

  // Ачивки: первая покупка каждого тира помощников → монеты (сервер сам решает)
  let coinsEarned = 0;
  const prevHelpers = Array.isArray(prevState.helpers) ? prevState.helpers : [];
  const newHelpers = Array.isArray(newState.helpers) ? newState.helpers.map(n => clampInt(n, 0, 9999) ?? 0) : [];
  for (let t = 0; t < CLICKER.helperPps.length; t++) {
    if ((newHelpers[t] ?? 0) >= 1 && (prevHelpers[t] ?? 0) === 0) {
      const reason = `milestone:clicker:tier${t}`;
      if (!hasTransaction(tg, reason)) {
        addCoins(tg, CLICKER.tierMilestoneCoins(t), reason, 'clicker');
        coinsEarned += CLICKER.tierMilestoneCoins(t);
      }
    }
  }
  // Прохождение: куплен последний тир
  const done = (newHelpers[CLICKER.helperPps.length - 1] ?? 0) >= 1;
  if (done && !hasTransaction(tg, 'milestone:clicker:complete')) {
    addCoins(tg, CLICKER.completionCoins, 'milestone:clicker:complete', 'clicker');
    coinsEarned += CLICKER.completionCoins;
  }

  const level = newHelpers.filter(n => n >= 1).length;
  saveProgress(tg, 'clicker', { state: { ...newState, helpers: newHelpers }, score, level });
  res.json({ ok: true, score, balance: getBalance(tg), coins_earned: coinsEarned });
});

// ── Зачёт раунда (merge / mosquito) ───────────────────────────────────
router.post('/:id/score', (req: AuthRequest, res) => {
  const game = String(req.params.id);
  if (!isGameId(game) || game === 'clicker') { res.status(404).json({ error: 'Нет такой игры' }); return; }
  const tg = tgOr401(req, res); if (!tg) return;

  const raw = clampInt((req.body as { score?: number }).score, 0, 1e9) ?? 0;
  const roundScore = Math.min(raw, ROUND_CAPS[game]); // анти-чит: потолок за раунд

  // анти-чит: не чаще одного зачёта в N секунд
  const lastTx = db.prepare(`
    SELECT created_at FROM coin_transactions
    WHERE telegram_id = ? AND reason = ? ORDER BY id DESC LIMIT 1
  `).get(tg, `earn:${game}`) as { created_at: string } | undefined;
  if (lastTx && (Date.now() - Date.parse(lastTx.created_at + 'Z')) / 1000 < ROUND_MIN_INTERVAL[game]) {
    res.status(429).json({ error: 'Слишком часто. Подождите немного.' });
    return;
  }

  const coins = awardRoundCoins(tg, game, roundScore);
  const prev = getProgress(tg, game);
  const best = Math.max(prev?.score ?? 0, roundScore);
  saveProgress(tg, game, { score: best });

  res.json({ ok: true, score: roundScore, best, coins_earned: coins, balance: getBalance(tg) });
});

// ── Лидерборд ─────────────────────────────────────────────────────────
router.get('/:id/leaderboard', (req: AuthRequest, res) => {
  const game = String(req.params.id);
  if (!isGameId(game)) { res.status(404).json({ error: 'Нет такой игры' }); return; }
  const tg = tgOr401(req, res); if (!tg) return;
  const { rank } = getRank(tg, game);
  const mine = getProgress(tg, game);
  res.json({
    top: getLeaderboard(game, 100),
    me: { score: mine?.score ?? 0, rank },
  });
});

function clampInt(v: unknown, min: number, max: number): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function safeParse(s: string | null | undefined): ClickerState | null {
  if (!s) return null;
  try { return JSON.parse(s) as ClickerState; } catch { return null; }
}

export default router;
