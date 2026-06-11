/**
 * Core merge-game logic.
 *
 * State shape (kept inside storage.run, mirrored here for convenience):
 *  - board: 2D array [row][col] of { level } | null
 *  - missions: list of session goals
 *
 * The module is intentionally UI-agnostic. UI subscribes via `onEvent` and
 * re-renders when notified. This keeps game rules testable in isolation.
 */

import { get as getState, save } from './storage.js';
import { MAX_LEVEL } from './frogs.js';

export const ROWS = 7;
export const COLS = 6;

const SPAWN_COST_BASE = 5;
const SPAWN_COST_GROWTH = 0.10;   // 10% per spawn within this run
const MERGE_COIN_REWARD = (lvl) => 2 + lvl * 2;
const DISCOVERY_REWARD  = (lvl) => 25 + lvl * 8;

const listeners = new Set();
export function onEvent(fn)   { listeners.add(fn); return () => listeners.delete(fn); }
function emit(type, payload)  { listeners.forEach((fn) => fn({ type, ...payload })); }

/* ============================================================
   Board helpers
============================================================ */
function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

export function isInBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

export function cellAt(r, c) {
  const s = getState();
  return s.run.board?.[r]?.[c] ?? null;
}

function findEmpty() {
  const s = getState();
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!s.run.board[r][c]) cells.push({ r, c });
    }
  }
  return cells;
}

function hasAnyMove() {
  const s = getState();
  // If the board has a free cell, the player can keep spawning.
  if (findEmpty().length > 0) return true;
  // Otherwise, only true if at least one adjacent pair matches in level.
  const b = s.run.board;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cur = b[r][c]; if (!cur) continue;
      const right = b[r][c + 1]; if (right && right.level === cur.level) return true;
      const down  = b[r + 1]?.[c]; if (down && down.level === cur.level) return true;
    }
  }
  return false;
}

/* ============================================================
   Public game API
============================================================ */

/**
 * Begin a fresh run. Sets the board, missions, and emits start event.
 */
export function startRun() {
  const s = getState();
  s.run.board = emptyBoard();
  s.run.score = 0;
  s.run.bestLevelThisRun = 1;
  s.run.mergesThisRun = 0;
  s.run.spawnsThisRun = 0;
  s.run.discoveredThisRun = 0;
  s.run.active = true;
  s.run.missions = rollMissions(s.meta.bestLevelEver);
  // Level 1 counts as "seen" the moment the player starts — drives the
  // collection from 0/12 → 1/12 immediately and avoids a confusing locked
  // tadpole card on the collection screen.
  if (!s.meta.discovered[1]) s.meta.discovered[1] = true;
  // Seed the board with two starter frogs so the player has something to drag.
  spawnAt(level1(), 0);
  spawnAt(level1(), 1);
  save();
  emit('runStart');
}

/**
 * Resume any in-progress run from storage. Returns whether one existed.
 */
export function resumeRun() {
  const s = getState();
  if (s.run.active && s.run.board) {
    emit('runResume');
    return true;
  }
  return false;
}

/**
 * Force-end the current run (player chose to quit). Does not award rewards.
 */
export function endRun(reason = 'manual') {
  const s = getState();
  s.run.active = false;
  save();
  emit('runEnd', { reason });
}

function level1() { return { level: 1 }; }

function spawnAt(frog, index = -1) {
  const empties = findEmpty();
  if (empties.length === 0) return null;
  const target = index >= 0 ? empties[index % empties.length] : empties[(Math.random() * empties.length) | 0];
  const s = getState();
  s.run.board[target.r][target.c] = frog;
  return target;
}

/**
 * Spawn a new lowest-level frog. Costs coins (price ramps within a run).
 * Returns the placed coordinate or null if no room / no money.
 */
export function spawnFrog() {
  const s = getState();
  const cost = currentSpawnCost();
  if (s.meta.coins < cost) {
    emit('error', { code: 'notEnoughCoins' });
    return null;
  }
  if (findEmpty().length === 0) {
    emit('error', { code: 'noSpace' });
    return null;
  }
  s.meta.coins -= cost;
  const placed = spawnAt(level1());
  s.run.spawnsThisRun += 1;
  bumpMissions('spawn');
  save();
  emit('spawn', { cell: placed, cost });
  // Spawning fills the board — only after the place check for game over.
  checkGameOver();
  return placed;
}

export function currentSpawnCost() {
  const s = getState();
  return Math.round(SPAWN_COST_BASE * (1 + s.run.spawnsThisRun * SPAWN_COST_GROWTH));
}

/**
 * Attempt to merge frog at (fromR,fromC) onto frog at (toR,toC).
 * Returns:
 *   - { type:'merge', level:N, discovered:bool, reward:n }
 *   - { type:'move' } when destination is empty
 *   - null when nothing happens
 */
export function moveOrMerge(fromR, fromC, toR, toC) {
  if (!isInBounds(fromR, fromC) || !isInBounds(toR, toC)) return null;
  if (fromR === toR && fromC === toC) return null;
  const s = getState();
  const src = s.run.board[fromR][fromC];
  if (!src) return null;
  const dst = s.run.board[toR][toC];

  if (!dst) {
    // Move into empty cell.
    s.run.board[toR][toC] = src;
    s.run.board[fromR][fromC] = null;
    save();
    emit('move', { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } });
    return { type: 'move' };
  }

  if (dst.level !== src.level || dst.level >= MAX_LEVEL) {
    return null;
  }

  // Merge!
  const newLevel = src.level + 1;
  s.run.board[fromR][fromC] = null;
  s.run.board[toR][toC] = { level: newLevel };

  const coinReward = MERGE_COIN_REWARD(newLevel);
  s.meta.coins += coinReward;
  s.run.mergesThisRun += 1;
  s.meta.totalMerges += 1;
  s.run.bestLevelThisRun = Math.max(s.run.bestLevelThisRun, newLevel);
  s.meta.bestLevelEver   = Math.max(s.meta.bestLevelEver, newLevel);

  let discovered = false;
  if (!s.meta.discovered[newLevel]) {
    s.meta.discovered[newLevel] = true;
    discovered = true;
    s.run.discoveredThisRun += 1;
    const bonus = DISCOVERY_REWARD(newLevel);
    s.meta.coins += bonus;
    bumpMissions('discover');
  }

  bumpMissions('merge', newLevel);

  save();
  emit('merge', {
    from: { r: fromR, c: fromC },
    to:   { r: toR, c: toC },
    level: newLevel,
    discovered,
    coinReward
  });

  if (discovered) emit('discovery', { level: newLevel });

  checkGameOver();
  return { type: 'merge', level: newLevel, discovered, reward: coinReward };
}

/**
 * Manual booster: pops any single frog (e.g. the lowest level on the board).
 * Used after game-over rescue or as a chargeable tool.
 */
export function useBoosterRemoveLowest() {
  const s = getState();
  if (s.meta.boosters <= 0) {
    emit('error', { code: 'noBoosters' });
    return false;
  }
  // Find the lowest-level cell and remove it.
  let target = null;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const f = s.run.board[r][c];
      if (!f) continue;
      if (!target || f.level < target.level) target = { r, c, level: f.level };
    }
  }
  if (!target) return false;
  s.run.board[target.r][target.c] = null;
  s.meta.boosters -= 1;
  save();
  emit('booster', { cell: target });
  return true;
}

/**
 * Top up boosters (e.g. after a rewarded ad).
 */
export function grantBoosters(n = 1) {
  const s = getState();
  s.meta.boosters += n;
  save();
  emit('boostersChanged');
}

/**
 * Grant coins (rewards / ads).
 */
export function grantCoins(n) {
  const s = getState();
  s.meta.coins += n;
  save();
  emit('coinsChanged');
}

/* ============================================================
   Missions — small session goals to drive engagement
============================================================ */

function rollMissions(bestEver) {
  // Pick 3 missions calibrated to current progress.
  const targetLevel = Math.min(MAX_LEVEL, Math.max(3, bestEver + 1));
  return [
    { id: 'mergeTo', goal: targetLevel, progress: 0, done: false, reward: 30 + targetLevel * 5 },
    { id: 'mergeCount', goal: 10, progress: 0, done: false, reward: 25 },
    { id: 'spawnCount', goal: 8, progress: 0, done: false, reward: 15 }
  ];
}

function bumpMissions(kind, value) {
  const s = getState();
  const list = s.run.missions || [];
  let changed = false;
  for (const m of list) {
    if (m.done) continue;
    if (kind === 'merge' && m.id === 'mergeCount') { m.progress += 1; changed = true; }
    if (kind === 'merge' && m.id === 'mergeTo' && value >= m.goal) { m.progress = m.goal; changed = true; }
    if (kind === 'spawn' && m.id === 'spawnCount') { m.progress += 1; changed = true; }
    if (m.id === 'mergeCount' && m.progress >= m.goal) m.progress = m.goal;
    if (m.progress >= m.goal && !m.done) {
      m.done = true;
      s.meta.coins += m.reward;
      emit('missionDone', { mission: { ...m } });
    }
  }
  if (changed) emit('missionProgress');
}

export function getMissions() {
  const s = getState();
  return s.run.missions || [];
}

/* ============================================================
   Discovery / progress helpers
============================================================ */

/**
 * Returns 0..1 progress towards the next undiscovered level based on the
 * highest level currently on the board.
 */
export function discoveryProgress() {
  const s = getState();
  let highest = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const f = s.run.board?.[r]?.[c];
      if (f) highest = Math.max(highest, f.level);
    }
  }
  const target = nextUndiscoveredLevel();
  if (!target) return 1;
  // Progress is the highest current / target level (clamped).
  return Math.max(0, Math.min(1, highest / target));
}

export function nextUndiscoveredLevel() {
  const s = getState();
  for (let l = 1; l <= MAX_LEVEL; l++) {
    if (!s.meta.discovered[l]) return l;
  }
  return null;
}

export function discoveredCount() {
  const s = getState();
  return Object.keys(s.meta.discovered).length;
}

/* ============================================================
   Game-over check
============================================================ */
function checkGameOver() {
  const s = getState();
  if (!s.run.active) return;
  if (hasAnyMove()) return;
  s.run.active = false;
  save();
  emit('gameOver', {
    bestLevel:   s.run.bestLevelThisRun,
    merges:      s.run.mergesThisRun,
    discovered:  s.run.discoveredThisRun,
    coins:       s.meta.coins
  });
}

/* ============================================================
   Rescue after game over — pop a few cells to give a second chance
   (typically called after a rewarded ad).
============================================================ */
export function rescue(n = 4) {
  const s = getState();
  // Remove `n` lowest-level frogs to free space and reactivate the run.
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const f = s.run.board[r][c];
      if (f) cells.push({ r, c, level: f.level });
    }
  }
  cells.sort((a, b) => a.level - b.level);
  for (let i = 0; i < Math.min(n, cells.length); i++) {
    s.run.board[cells[i].r][cells[i].c] = null;
  }
  s.run.active = true;
  save();
  emit('rescued');
}
