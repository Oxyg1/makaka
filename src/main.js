/**
 * Game bootstrap.
 *
 * Responsibilities:
 *  - Load state + locale + SDK
 *  - Run the loading animation
 *  - Wire up button event handlers
 *  - Hook into game events to update UI / play sfx
 *
 * Add new buttons by adding to the `wireButtons()` map. Add new game-event
 * reactions inside `Game.onEvent` below.
 */

import * as Storage from './storage.js';
import * as Locale  from './locale.js';
import * as Audio   from './audio.js';
import * as Ads     from './ads.js';
import * as Game    from './game.js';
import * as UI      from './ui.js';

const $ = (sel) => document.querySelector(sel);

async function boot() {
  // 1. Load persisted state.
  const state = Storage.load();

  // 2. Apply settings.
  Audio.setEnabled(state.settings.sound);
  Locale.setLang(state.settings.lang || Locale.detectLang());

  // 3. Try to start Yandex SDK in parallel with the loading screen.
  const sdkPromise = Ads.initYandex();

  // 4. Run loading bar animation (sells perceived polish).
  await runLoadingAnimation();

  await sdkPromise; // do not block past loading screen

  // 5. Wire UI.
  UI.initBoard();
  wireButtons();
  hookGameEvents();
  UI.renderMenu();

  // 6. Grant any idle income earned while the game was closed.
  const idleEarned = Game.tickIdle();
  if (idleEarned > 0) UI.toast(Locale.t('idle.welcome', { n: idleEarned }));

  // 7. Start a low-frequency ticker so idle income keeps flowing during play.
  //    requestAnimationFrame would be wasteful here — a 5s setInterval is fine.
  setInterval(() => {
    Game.tickIdle();
    if (document.getElementById('screen-game').classList.contains('is-active')) UI.renderHUD();
    if (document.getElementById('screen-menu').classList.contains('is-active')) UI.renderMenu();
    if (document.getElementById('screen-upgrades').classList.contains('is-active')) UI.renderUpgrades();
  }, 5000);

  // 8. Always boot into the main menu — it is the player's anchor point and
  //    shows progress, daily streak and collection counters.
  UI.showScreen('screen-menu');

  // 7. Prevent context menu on long-press for cleaner mobile feel.
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.board, .btn, .icon-btn')) e.preventDefault();
  });

  // 8. Make sure HUD updates if storage changes outside this tab (rare).
  window.addEventListener('storage', () => { Storage.load(); UI.renderHUD(); UI.renderMenu(); });
}

/**
 * Pretty loading bar — purely visual so the game feels intentional even on
 * fast loads. Yandex Games values short perceived load times.
 */
function runLoadingAnimation() {
  return new Promise((resolve) => {
    const fill = $('#loading-bar-fill');
    let p = 0;
    const tick = () => {
      p = Math.min(100, p + 6 + Math.random() * 12);
      fill.style.width = p + '%';
      if (p < 100) {
        setTimeout(tick, 80);
      } else {
        setTimeout(resolve, 200);
      }
    };
    tick();
  });
}

/* ============================================================
   Button wiring — kept in one place so it's easy to audit.
============================================================ */
function wireButtons() {
  // Menu
  $('#btn-play').addEventListener('click', () => { enterGame(); });
  $('#btn-collection').addEventListener('click', () => { UI.renderCollection(); UI.showScreen('screen-collection'); });
  $('#btn-upgrades').addEventListener('click',   () => { UI.renderUpgrades();  UI.showScreen('screen-upgrades');  });
  $('#btn-daily').addEventListener('click',      () => { UI.renderDaily();     UI.showScreen('screen-daily');     });
  $('#btn-sound').addEventListener('click', () => UI.toggleSound());
  $('#btn-lang').addEventListener('click',  () => UI.cycleLang());
  $('#btn-fullscreen').addEventListener('click', toggleFullscreen);

  // Back arrows on sub-screens
  document.querySelectorAll('[data-back]').forEach((el) => el.addEventListener('click', () => UI.goBack()));

  // Game
  $('#btn-back-menu').addEventListener('click', () => { Ads.gameplayStop(); UI.showScreen('screen-menu'); UI.renderMenu(); });
  $('#btn-pause').addEventListener('click', () => UI.showScreen('screen-pause'));
  $('#btn-spawn').addEventListener('click', () => {
    const placed = Game.spawnFrog();
    if (placed) {
      UI.renderBoard();
      UI.renderHUD();
      UI.renderDiscoverBar();
    }
  });
  $('#btn-booster').addEventListener('click', async () => {
    const s = Storage.get();
    if (s.meta.boosters > 0) {
      Game.useBoosterRemoveLowest();
      UI.renderBoard();
      UI.renderHUD();
      return;
    }
    // Out of boosters → offer a rewarded ad.
    const { rewarded } = await Ads.showRewarded();
    if (rewarded) { Game.grantBoosters(2); UI.toast('+2'); UI.renderHUD(); }
    else UI.toast(Locale.t('toast.adUnavailable'));
  });

  // Pause modal
  $('#btn-resume').addEventListener('click', () => UI.showScreen('screen-game'));
  $('#btn-restart').addEventListener('click', () => { enterGame(false, true); });
  // "Back to menu" from pause: keep the run alive so the player can resume
  // later. Endgame happens only via restart or natural game-over.
  $('#btn-to-menu').addEventListener('click', async () => {
    Ads.gameplayStop();
    UI.showScreen('screen-menu');
    UI.renderMenu();
    Ads.showFullscreen();
  });

  // Game over modal
  $('#btn-continue-ad').addEventListener('click', async () => {
    const { rewarded } = await Ads.showRewarded();
    if (rewarded) {
      Game.rescue(5);
      UI.renderBoard();
      UI.renderHUD();
      UI.showScreen('screen-game');
    } else {
      UI.toast(Locale.t('toast.adUnavailable'));
    }
  });
  $('#btn-play-again').addEventListener('click', async () => {
    // Fullscreen ad between runs, then a fresh start.
    await Ads.showFullscreen();
    enterGame(false, true);
  });
  $('#btn-gameover-menu').addEventListener('click', async () => { await Ads.showFullscreen(); UI.showScreen('screen-menu'); UI.renderMenu(); });

  // Daily
  $('#btn-claim-daily').addEventListener('click', () => {
    const amt = UI.claimDaily(1);
    if (amt > 0) { UI.toast(`+${amt}`); UI.renderDaily(); UI.renderMenu(); }
    else UI.toast(Locale.t('daily.alreadyClaimed'));
  });
  $('#btn-claim-daily-x2').addEventListener('click', async () => {
    const { rewarded } = await Ads.showRewarded();
    const amt = UI.claimDaily(rewarded ? 2 : 1);
    if (amt > 0) { UI.toast(`+${amt}`); UI.renderDaily(); UI.renderMenu(); }
    else UI.toast(Locale.t('daily.alreadyClaimed'));
  });

  // Discovery popup
  $('#discovery-ok').addEventListener('click', () => UI.hideDiscovery());
}

/* ============================================================
   Game events → UI side effects
============================================================ */
function hookGameEvents() {
  Game.onEvent((evt) => {
    if (evt.type === 'spawn')        { UI.renderBoard(); UI.renderHUD(); UI.renderDiscoverBar(); }
    if (evt.type === 'move')         { UI.renderBoard(); }
    if (evt.type === 'merge')        { /* drag handler already triggered the renders + sfx */ }
    if (evt.type === 'discovery')    { UI.showDiscovery(evt.level); UI.renderMenu(); UI.renderCollection(); UI.hideTutorial(); }
    if (evt.type === 'missionDone')  { UI.toast(`+${evt.mission.reward}`); UI.renderMissions(); UI.renderHUD(); }
    if (evt.type === 'missionProgress'){ UI.renderMissions(); }
    if (evt.type === 'gameOver')     { Ads.gameplayStop(); UI.showGameOver(evt); }
    if (evt.type === 'boostersChanged'){ UI.renderHUD(); }
    if (evt.type === 'coinsChanged') { UI.renderHUD(); UI.renderMenu(); }
    if (evt.type === 'rescued')      { UI.renderBoard(); UI.renderHUD(); }
    if (evt.type === 'upgradeBought'){ UI.renderHUD(); UI.renderMenu(); }
    if (evt.type === 'tap')          { /* HUD already updated by handler */ }
    if (evt.type === 'error') {
      if (evt.code === 'notEnoughCoins') UI.toast(Locale.t('toast.notEnoughCoins'));
      if (evt.code === 'noSpace')        UI.toast(Locale.t('toast.noSpace'));
      if (evt.code === 'noBoosters')     UI.toast(Locale.t('toast.noBoosters'));
    }
  });
}

/* ============================================================
   Game entry
============================================================ */
/**
 * Enter the game screen.
 *  - If there is an active run from a previous session, resume it (no progress lost).
 *  - Otherwise start a fresh run.
 * `forceNew` is set by the explicit "Restart" / "Play again" buttons.
 */
function enterGame(_resumeHint, forceNew = false) {
  Ads.gameplayStart();
  if (!forceNew && Game.resumeRun()) {
    // resumeRun returns true only if there is an active board to restore.
  } else {
    Game.startRun();
  }
  UI.renderBoard(); UI.renderHUD(); UI.renderMissions(); UI.renderDiscoverBar();
  UI.showScreen('screen-game');
  UI.maybeShowTutorial();
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el).catch(() => {});
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document).catch(() => {});
  }
}

// Pause when the tab loses focus — better mobile UX and ad compatibility.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Storage.get().run.active) {
    const game = document.getElementById('screen-game');
    if (game.classList.contains('is-active')) {
      Ads.gameplayStop();
      UI.showScreen('screen-pause');
    }
  }
});

boot();
