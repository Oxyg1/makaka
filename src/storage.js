/**
 * Persistent state module.
 * Wraps localStorage with a single JSON blob under key `frog-lagoon:v1`.
 * - Auto-saves on every mutation via `save()`.
 * - Robust to malformed/older data: missing keys are filled with defaults.
 */

const STORAGE_KEY = 'frog-lagoon:v1';

const DEFAULT_STATE = {
  // Run state — restored if the player closes the tab mid-session.
  run: {
    board: null,        // 2D array of cells: { level } | null
    score: 0,
    bestLevelThisRun: 1,
    mergesThisRun: 0,
    spawnsThisRun: 0,
    discoveredThisRun: 0,
    missions: null,     // current mission set
    active: false       // true while a session is in progress
  },

  // Meta progression — persists across runs.
  meta: {
    coins: 50,
    gems: 0,
    boosters: 3,
    bestLevelEver: 1,
    totalMerges: 0,
    discovered: {},   // { '1': true, '2': true, ... }
    tutorialDone: false
  },

  // Daily reward state.
  daily: {
    lastClaimDay: 0,  // ISO day number (days since epoch)
    streak: 0,
    history: []       // last claimed days (for UI strip)
  },

  // Settings.
  settings: {
    sound: true,
    lang: null        // null → autodetect
  }
};

let state = clone(DEFAULT_STATE);

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function merge(target, source) {
  // Deep-merge defaults with stored values.
  for (const k in target) {
    if (source && Object.prototype.hasOwnProperty.call(source, k)) {
      if (target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
        merge(target[k], source[k]);
      } else {
        target[k] = source[k];
      }
    }
  }
  return target;
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) merge(state, JSON.parse(raw));
  } catch (e) {
    console.warn('Storage load failed, using defaults', e);
  }
  return state;
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Storage save failed', e);
  }
}

export function get() { return state; }

export function resetAll() {
  state = clone(DEFAULT_STATE);
  save();
  return state;
}

export function resetRun() {
  state.run = clone(DEFAULT_STATE.run);
  save();
}

/**
 * Returns current "day number" (UTC, days since epoch). Stable across sessions.
 */
export function todayNumber() {
  return Math.floor(Date.now() / 86_400_000);
}
