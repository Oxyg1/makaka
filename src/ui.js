/**
 * UI layer — DOM rendering, screen routing, input.
 *
 * Architecture:
 *  - `showScreen(id)` toggles the active <section class="screen">.
 *  - The board is a CSS grid; each frog is a positioned <div> inside its cell.
 *  - Drag uses pointer events: works for mouse, touch and stylus uniformly.
 *  - Visual effects (particles, floating text) are pure DOM/CSS — no canvas.
 *
 * All copy comes from `locale.js`; never hard-code user-facing strings here.
 */

import * as Game from './game.js';
import * as Frogs from './frogs.js';
import { get as getState, save, todayNumber } from './storage.js';
import { t, getLang, setLang, availableLangs } from './locale.js';
import { sfx, setEnabled as setSfxEnabled, isEnabled as sfxEnabled } from './audio.js';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ============================================================
   Screen routing
============================================================ */
const SCREEN_STACK = [];
export function showScreen(id, push = true) {
  $$('.screen').forEach((s) => s.classList.remove('is-active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('is-active');
  if (push) SCREEN_STACK.push(id);
}
export function goBack() {
  SCREEN_STACK.pop();
  const prev = SCREEN_STACK[SCREEN_STACK.length - 1] || 'screen-menu';
  showScreen(prev, false);
}

/* ============================================================
   Toast
============================================================ */
let toastTimer = null;
export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 1800);
}

/* ============================================================
   Board rendering
============================================================ */
let boardEl, particleLayer;
let cellRects = [];
let drag = null;

export function initBoard() {
  boardEl = $('#board');
  particleLayer = $('#board-particles');
  boardEl.style.setProperty('--rows', Game.ROWS);
  boardEl.style.setProperty('--cols', Game.COLS);

  // Build cells once. Frogs are mounted/removed dynamically inside cells.
  boardEl.innerHTML = '';
  for (let r = 0; r < Game.ROWS; r++) {
    for (let c = 0; c < Game.COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      boardEl.appendChild(cell);
    }
  }

  boardEl.addEventListener('pointerdown', onPointerDown);
  // Cache cell rects on resize.
  window.addEventListener('resize', cacheRects, { passive: true });
  window.addEventListener('orientationchange', cacheRects, { passive: true });
}

function cellEl(r, c) {
  return boardEl.children[r * Game.COLS + c];
}

function cacheRects() {
  if (!boardEl) return;
  cellRects = [];
  for (let r = 0; r < Game.ROWS; r++) {
    cellRects[r] = [];
    for (let c = 0; c < Game.COLS; c++) {
      cellRects[r][c] = cellEl(r, c).getBoundingClientRect();
    }
  }
}

export function renderBoard() {
  const s = getState();
  if (!s.run.board) return;
  // Reconcile: ensure each cell contains the correct frog node.
  for (let r = 0; r < Game.ROWS; r++) {
    for (let c = 0; c < Game.COLS; c++) {
      const cell = cellEl(r, c);
      const data = s.run.board[r][c];
      const existing = cell.querySelector('.frog');

      if (!data) {
        if (existing) existing.remove();
        continue;
      }
      if (!existing) {
        cell.appendChild(buildFrogNode(data.level));
      } else if (+existing.dataset.level !== data.level) {
        existing.replaceWith(buildFrogNode(data.level));
      }
    }
  }
  cacheRects();
}

function buildFrogNode(level) {
  const node = document.createElement('div');
  node.className = 'frog spawn-pop';
  node.dataset.level = level;
  node.innerHTML = Frogs.getFrogVisual(level);
  // Per-level rarity badge.
  const badge = document.createElement('span');
  badge.className = 'frog__badge';
  badge.textContent = level;
  node.appendChild(badge);
  // Optional PNG upgrade — no-op if PNGs aren't shipped.
  Frogs.tryUpgradeToPng(node, level);
  return node;
}

/* ============================================================
   HUD
============================================================ */
export function renderHUD() {
  const s = getState();
  $('#hud-coins').textContent = s.meta.coins;
  $('#hud-gems').textContent  = s.meta.gems;
  $('#spawn-cost').textContent = Game.currentSpawnCost();
  $('#booster-count').textContent = s.meta.boosters;
}

export function renderMissions() {
  const wrap = $('#missions');
  wrap.innerHTML = '';
  for (const m of Game.getMissions()) {
    const el = document.createElement('div');
    el.className = 'mission' + (m.done ? ' mission--done' : '');
    const label = (() => {
      if (m.id === 'mergeTo')     return t('mission.mergeTo',    { n: m.goal });
      if (m.id === 'mergeCount')  return t('mission.mergeCount', { n: m.goal });
      if (m.id === 'spawnCount')  return t('mission.spawnCount', { n: m.goal });
      return '';
    })();
    el.innerHTML = `<span class="mission__check"></span><span>${label} (${Math.min(m.progress, m.goal)}/${m.goal})</span>`;
    wrap.appendChild(el);
  }
}

export function renderDiscoverBar() {
  const next = Game.nextUndiscoveredLevel();
  const fill = $('#discover-fill');
  const name = $('#next-discovery-name');
  if (!next) {
    fill.style.width = '100%';
    name.textContent = '★';
    return;
  }
  fill.style.width = (Game.discoveryProgress() * 100).toFixed(1) + '%';
  name.textContent = `${t(`frog.${next}.name`)} (lv ${next})`;
}

/* ============================================================
   Effects: particles + floating numbers
============================================================ */
function emitParticles(x, y, color = '#6be39a', count = 14) {
  if (!particleLayer) return;
  const layerRect = particleLayer.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    p.style.left = `${x - layerRect.left}px`;
    p.style.top  = `${y - layerRect.top}px`;
    p.style.background = color;
    p.style.boxShadow = `0 0 8px ${color}`;
    const angle = Math.random() * Math.PI * 2;
    const dist  = 40 + Math.random() * 60;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    p.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(.2)`, opacity: 0 }
      ],
      { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
    );
    particleLayer.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

function floatingText(text, x, y, color = '#6be39a') {
  const layerRect = particleLayer.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'floating-text';
  el.textContent = text;
  el.style.color = color;
  el.style.left = `${x - layerRect.left}px`;
  el.style.top  = `${y - layerRect.top}px`;
  particleLayer.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

/* ============================================================
   Input: drag / drop merge
============================================================ */
function onPointerDown(e) {
  const frog = e.target.closest('.frog');
  if (!frog) return;
  e.preventDefault();
  const cell = frog.parentElement;
  const r = +cell.dataset.r;
  const c = +cell.dataset.c;
  const rect = frog.getBoundingClientRect();

  drag = {
    pointerId: e.pointerId,
    fromR: r, fromC: c,
    el: frog,
    startX: e.clientX, startY: e.clientY,
    offsetX: e.clientX - (rect.left + rect.width / 2),
    offsetY: e.clientY - (rect.top + rect.height / 2),
    parent: cell
  };

  frog.classList.add('is-dragging');
  // Detach from cell so transforms stay clean.
  const overlayHost = boardEl;
  overlayHost.appendChild(frog);
  positionDraggedFrog(e.clientX, e.clientY);

  boardEl.setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  sfx.tap();
}

function positionDraggedFrog(clientX, clientY) {
  const bRect = boardEl.getBoundingClientRect();
  const f = drag.el;
  const w = f.offsetWidth;
  const h = f.offsetHeight;
  f.style.position = 'absolute';
  f.style.left = `${clientX - bRect.left - drag.offsetX - w / 2}px`;
  f.style.top  = `${clientY - bRect.top  - drag.offsetY - h / 2}px`;
  f.style.inset = 'auto';
  f.style.width = `${w}px`;
  f.style.height = `${h}px`;
}

function hoverCell(clientX, clientY) {
  for (let r = 0; r < Game.ROWS; r++) {
    for (let c = 0; c < Game.COLS; c++) {
      const rect = cellRects[r]?.[c];
      if (!rect) continue;
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return { r, c };
      }
    }
  }
  return null;
}

function onPointerMove(e) {
  if (!drag) return;
  positionDraggedFrog(e.clientX, e.clientY);
  // Hover highlight
  $$('.cell--hover, .cell--match').forEach((el) => el.classList.remove('cell--hover', 'cell--match'));
  const h = hoverCell(e.clientX, e.clientY);
  if (h) {
    const cell = cellEl(h.r, h.c);
    const dst = getState().run.board[h.r][h.c];
    const src = { level: +drag.el.dataset.level };
    if (dst && dst.level === src.level && dst.level < Frogs.MAX_LEVEL) {
      cell.classList.add('cell--match');
    } else {
      cell.classList.add('cell--hover');
    }
  }
}

function onPointerUp(e) {
  if (!drag) return;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);

  $$('.cell--hover, .cell--match').forEach((el) => el.classList.remove('cell--hover', 'cell--match'));

  const target = hoverCell(e.clientX, e.clientY);
  const f = drag.el;
  f.classList.remove('is-dragging');
  f.style.left = f.style.top = f.style.width = f.style.height = '';
  f.style.position = '';
  f.style.inset = '';

  const start = drag;
  drag = null;

  if (!target) { renderBoard(); return; }

  const result = Game.moveOrMerge(start.fromR, start.fromC, target.r, target.c);
  if (!result) {
    renderBoard();
    return;
  }
  // The board rerender handles DOM placement. Effects + sounds layered on top:
  if (result.type === 'merge') {
    sfx.merge();
    const cellRect = cellRects[target.r][target.c];
    const cx = cellRect.left + cellRect.width / 2;
    const cy = cellRect.top + cellRect.height / 2;
    emitParticles(cx, cy, Frogs.getFrogGlow(result.level), 18);
    floatingText(`+${result.reward}`, cx, cy - 4);
    renderBoard();
    // Pop animation on freshly merged cell.
    requestAnimationFrame(() => {
      const node = cellEl(target.r, target.c).querySelector('.frog');
      if (node) { node.classList.remove('spawn-pop'); node.classList.add('merge-pop'); }
    });
  } else {
    sfx.tap();
    renderBoard();
  }
  renderHUD();
  renderMissions();
  renderDiscoverBar();
}

/* ============================================================
   Tutorial — shown on first run, dismissed by first successful merge
============================================================ */
export function maybeShowTutorial() {
  const s = getState();
  if (s.meta.tutorialDone) return;
  const el = $('#tutorial');
  el.classList.add('is-active');
  el.setAttribute('aria-hidden', 'false');
  const hand = $('#tutorial-hand');
  // Animate hand from frog A to frog B.
  function animate() {
    if (!el.classList.contains('is-active')) return;
    const board = boardEl.getBoundingClientRect();
    const a = cellRects[0]?.[0];
    const b = cellRects[0]?.[1];
    if (!a || !b) { requestAnimationFrame(animate); return; }
    const ax = a.left + a.width / 2 - board.left - 18;
    const ay = a.top  + a.height / 2 - board.top  - 18;
    const bx = b.left + b.width / 2 - board.left - 18;
    const by = b.top  + b.height / 2 - board.top  - 18;
    hand.style.transform = `translate(${ax}px, ${ay}px)`;
    setTimeout(() => { hand.style.transform = `translate(${bx}px, ${by}px)`; }, 60);
    setTimeout(animate, 1300);
  }
  animate();
}

export function hideTutorial() {
  const s = getState();
  if (s.meta.tutorialDone) return;
  s.meta.tutorialDone = true;
  save();
  const el = $('#tutorial');
  el.classList.remove('is-active');
  el.setAttribute('aria-hidden', 'true');
}

/* ============================================================
   Discovery popup
============================================================ */
export function showDiscovery(level) {
  $('#discovery-art').innerHTML = Frogs.getFrogVisual(level);
  Frogs.tryUpgradeToPng($('#discovery-art'), level);
  $('#discovery-name').textContent = Frogs.getFrogName(level);
  $('#discovery-desc').textContent = Frogs.getFrogDescription(level);
  const pop = $('#discovery-popup');
  pop.classList.add('is-visible');
  pop.setAttribute('aria-hidden', 'false');
  sfx.discover();
}
export function hideDiscovery() {
  const pop = $('#discovery-popup');
  pop.classList.remove('is-visible');
  pop.setAttribute('aria-hidden', 'true');
}

/* ============================================================
   Menu
============================================================ */
export function renderMenu() {
  const s = getState();
  $('#menu-discovered').textContent = Game.discoveredCount();
  $('#menu-total').textContent = Frogs.MAX_LEVEL;
  $('#menu-best-level').textContent = s.meta.bestLevelEver;
  $('#menu-coins').textContent = s.meta.coins;
  $('#menu-streak').textContent = s.daily.streak;
  const pct = (Game.discoveredCount() / Frogs.MAX_LEVEL) * 100;
  $('#menu-progress-fill').style.width = pct + '%';
  // Sound icon state
  const off = $('#icon-sound-off');
  if (off) off.style.display = sfxEnabled() ? 'none' : '';
  // Language indicator
  $('#lang-text').textContent = getLang().toUpperCase();
}

/* ============================================================
   Collection screen
============================================================ */
export function renderCollection() {
  const s = getState();
  const grid = $('#collection-grid');
  grid.innerHTML = '';
  for (let lvl = 1; lvl <= Frogs.MAX_LEVEL; lvl++) {
    const unlocked = !!s.meta.discovered[lvl];
    const card = document.createElement('div');
    card.className = 'coll-card' + (unlocked ? '' : ' coll-card--locked');
    card.innerHTML = `
      <div class="coll-card__art">${Frogs.getFrogVisual(lvl)}</div>
      <div class="coll-card__name">${unlocked ? Frogs.getFrogName(lvl) : '???'}</div>
      <div class="coll-card__lvl">lv ${lvl}</div>
    `;
    if (unlocked) Frogs.tryUpgradeToPng(card.querySelector('.coll-card__art'), lvl);
    grid.appendChild(card);
  }
  $('#collection-count').textContent = Game.discoveredCount();
  $('#collection-total').textContent = Frogs.MAX_LEVEL;
}

/* ============================================================
   Daily rewards
============================================================ */
const DAILY_REWARDS = [10, 15, 20, 30, 45, 60, 100]; // 7-day cycle

export function renderDaily() {
  const s = getState();
  const grid = $('#daily-grid');
  grid.innerHTML = '';
  const today = todayNumber();
  const claimedToday = s.daily.lastClaimDay === today;
  const dayIndex = claimedToday ? (s.daily.streak - 1) : s.daily.streak;

  for (let i = 0; i < DAILY_REWARDS.length; i++) {
    const cell = document.createElement('div');
    let cls = 'daily-cell';
    if (i < dayIndex || (i === dayIndex && claimedToday)) cls += ' daily-cell--claimed';
    else if (i === dayIndex) cls += ' daily-cell--current';
    cell.className = cls;
    cell.innerHTML = `
      <span class="daily-cell__day">${t('daily.day')} ${i + 1}</span>
      <span class="daily-cell__amount">+${DAILY_REWARDS[i]}</span>
      <span class="daily-cell__icon"></span>
    `;
    grid.appendChild(cell);
  }

  // Disable claim button if already done.
  $('#btn-claim-daily').disabled = claimedToday;
  $('#btn-claim-daily-x2').disabled = claimedToday;
}

/**
 * Claim the daily reward. `multiplier` is 1 or 2 (after rewarded ad).
 * Returns the amount awarded or 0 if already claimed.
 */
export function claimDaily(multiplier = 1) {
  const s = getState();
  const today = todayNumber();
  if (s.daily.lastClaimDay === today) return 0;

  const yesterday = today - 1;
  if (s.daily.lastClaimDay === yesterday) {
    s.daily.streak = Math.min(s.daily.streak + 1, DAILY_REWARDS.length);
  } else {
    s.daily.streak = 1;
  }
  const dayIndex = s.daily.streak - 1;
  const reward = DAILY_REWARDS[dayIndex] * multiplier;
  s.meta.coins += reward;
  s.daily.lastClaimDay = today;
  save();
  return reward;
}

/* ============================================================
   Game-over modal
============================================================ */
export function showGameOver(payload) {
  $('#gameover-summary').textContent = t('gameover.summary', { n: payload.bestLevel });
  $('#gameover-coins').textContent = payload.coins;
  $('#gameover-best').textContent  = payload.bestLevel;
  $('#gameover-discovered').textContent = payload.discovered;
  showScreen('screen-gameover');
}

/* ============================================================
   Sound + language toggles
============================================================ */
export function toggleSound() {
  setSfxEnabled(!sfxEnabled());
  const s = getState();
  s.settings.sound = sfxEnabled();
  save();
  renderMenu();
}

export function cycleLang() {
  const langs = availableLangs();
  const idx = langs.indexOf(getLang());
  const next = langs[(idx + 1) % langs.length];
  setLang(next);
  const s = getState();
  s.settings.lang = next;
  save();
  toast(t('toast.languageChanged'));
  // Re-render dynamic UI that doesn't use [data-i18n].
  renderMenu();
  renderMissions();
  renderDiscoverBar();
  renderCollection();
  renderDaily();
}

export function refreshAllText() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}
