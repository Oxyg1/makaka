/**
 * Yandex Games SDK integration.
 *
 * This module is a thin wrapper around `YaGames` so that the rest of the game
 * never touches the SDK directly. Every function is async and safe to call
 * even when the SDK is missing (e.g. local dev) — it then falls back to a
 * no-op or simulated reward.
 *
 * Integration points to extend later:
 *  - Add `purchase(productId)` once IAP catalog is configured in the Yandex Games console.
 *  - Add `getLeaderboard()` / `setLeaderboardScore()` for global score tables.
 *
 * Docs: https://yandex.ru/dev/games/doc/en/sdk/sdk-about
 */

let ysdk = null;          // YaGames SDK instance
let player = null;        // player profile (optional)
let ready = false;
let lastInterstitial = 0; // throttle fullscreen ads

const INTERSTITIAL_COOLDOWN_MS = 60_000; // do not spam fullscreen ads

/**
 * Initialise the SDK. Resolves to true if available.
 * Safe to call multiple times; subsequent calls return the cached instance.
 */
export async function initYandex() {
  if (ready) return true;
  if (typeof YaGames === 'undefined') {
    console.info('[ads] YaGames SDK not present — running in dev mode');
    return false;
  }
  try {
    ysdk = await YaGames.init();
    ready = true;
    // Player profile is optional and best-effort.
    try { player = await ysdk.getPlayer(); } catch (_) { /* anonymous */ }
    // Tell the platform that the loading screen is gone.
    try { ysdk.features.LoadingAPI?.ready(); } catch (_) {}
    console.info('[ads] Yandex SDK ready');
    return true;
  } catch (e) {
    console.warn('[ads] Yandex SDK init failed', e);
    return false;
  }
}

/** True after the SDK successfully initialised. */
export function isReady() { return ready; }

/**
 * Notify the platform that gameplay has started (pause music, etc).
 */
export function gameplayStart() {
  try { ysdk?.features.GameplayAPI?.start(); } catch (_) {}
}

/**
 * Notify the platform that gameplay has stopped (resume music, etc).
 */
export function gameplayStop() {
  try { ysdk?.features.GameplayAPI?.stop(); } catch (_) {}
}

/**
 * Show a fullscreen (interstitial) ad.
 * Throttled to avoid annoying the player.
 *
 * @returns {Promise<{shown:boolean}>}
 */
export async function showFullscreen() {
  if (Date.now() - lastInterstitial < INTERSTITIAL_COOLDOWN_MS) return { shown: false };
  if (!ready || !ysdk?.adv) return { shown: false };
  lastInterstitial = Date.now();

  return new Promise((resolve) => {
    ysdk.adv.showFullscreenAdv({
      callbacks: {
        onClose: (wasShown) => resolve({ shown: !!wasShown }),
        onError: () => resolve({ shown: false })
      }
    });
  });
}

/**
 * Show a rewarded video and resolve with whether the reward should be granted.
 * In dev mode (SDK absent) we still resolve true after a brief delay so the
 * reward flow can be tested locally.
 *
 * @returns {Promise<{rewarded:boolean}>}
 */
export async function showRewarded() {
  if (!ready || !ysdk?.adv) {
    // Dev fallback: simulate a rewarded ad.
    await new Promise((r) => setTimeout(r, 300));
    return { rewarded: true };
  }
  return new Promise((resolve) => {
    let granted = false;
    ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen:   () => {},
        onRewarded: () => { granted = true; },
        onClose:  () => resolve({ rewarded: granted }),
        onError:  () => resolve({ rewarded: false })
      }
    });
  });
}

/**
 * Save player state to Yandex cloud (when authorised). Best-effort: failures
 * are swallowed because the game also persists to localStorage.
 */
export async function cloudSave(data) {
  try { await player?.setData(data, true); } catch (_) {}
}

export async function cloudLoad() {
  try { return await player?.getData(); } catch (_) { return null; }
}

/* =========================================================================
   Placeholder: in-app purchases
   When IAPs are configured in the Yandex Games console (cosmetics, boosters),
   wire them up via `ysdk.getPayments({ signed: true })` and expose a small
   `purchase(productId)` API here. Keep the call site UI-agnostic.
   ========================================================================= */
