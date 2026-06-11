# Frog Lagoon — HTML5 Merge Game

A retention-tuned merge game built for **Yandex Games**. Pure HTML / CSS / vanilla JS, zero build step, ESM modules, SVG-only art with a clean upgrade path to PNG assets.

## Features

- Merge mechanic on a 6×7 lily-pad board with 12 evolution tiers
- Pointer-events drag & drop — works the same on mouse, touch and pen
- Procedural SVG frogs (no emoji, no raster) with a hot-swap path to PNG
- Tutorial appears only on the first run and dismisses itself after the first merge
- Discovery popup with animated rays on every new species
- Session missions (evolve to N / merge N times / spawn N times) — auto-rerolled per run
- Daily reward grid with streak bonus + ×2 via rewarded ad
- Collection screen with locked silhouettes
- Pause / resume, sound on/off, language toggle (RU / EN), fullscreen
- Auto-save to `localStorage` on every state change
- Yandex SDK integration (interstitials, rewarded videos, gameplay markers, cloud save)
- Game-over rescue via rewarded ad
- 60 FPS on low-end devices: DOM-based board, throttled rerenders, no canvas
- Mobile-first responsive layout with safe-area insets

## Project structure

```
.
├── index.html              # All screens & shells; loads SDK + ESM entry
├── style.css               # Premium-casual visual system (glassmorphism, soft shadows)
├── src/
│   ├── main.js             # Bootstrap: loading, SDK init, wiring
│   ├── game.js             # Pure merge logic, missions, rescue
│   ├── ui.js               # DOM rendering, drag/drop, effects
│   ├── frogs.js            # Per-level palette + procedural SVG + PNG hot-swap
│   ├── locale.js           # ru/en dictionaries; t(key, params)
│   ├── storage.js          # localStorage wrapper (single JSON blob)
│   ├── audio.js            # WebAudio SFX (zero-asset, on/off)
│   └── ads.js              # YaGames SDK wrapper (interstitial / rewarded / cloud)
└── assets/
    └── frogs/              # Drop 1.png … 12.png here to replace SVG art
```

## Running locally

The game is plain static files — any web server works.

```bash
# any of:
python3 -m http.server 8080
npx serve .
```

Then open `http://localhost:8080`.

> ESM imports need to be served over HTTP — opening `index.html` from disk will fail with CORS errors.

## Where to drop frog PNGs

1. Add files `assets/frogs/1.png` … `assets/frogs/12.png`.
2. In `src/frogs.js` flip:

   ```js
   export const USE_PNG_IF_AVAILABLE = true;
   ```

3. PNGs are loaded lazily and replace the SVG automatically — no other code changes needed.

## Yandex Games SDK

The SDK loader lives in `index.html`:

```html
<script src="https://yandex.ru/games/sdk/v2"></script>
```

All interaction goes through `src/ads.js`. The relevant calls and their hook sites:

| Capability        | Wrapper                            | Where it fires                                                  |
| ----------------- | ---------------------------------- | --------------------------------------------------------------- |
| Init + ready      | `Ads.initYandex()`                 | `src/main.js` boot                                              |
| Fullscreen ad     | `Ads.showFullscreen()`             | Between runs, leaving game to menu                              |
| Rewarded video    | `Ads.showRewarded()`               | "Continue (Ad)" on game over, "Claim ×2" daily, refill boosters |
| Gameplay markers  | `Ads.gameplayStart()` / `Stop()`   | Entering/leaving the game screen                                |
| Cloud save / load | `Ads.cloudSave()` / `cloudLoad()`  | Hook into `Storage.save()` if you need cross-device progress    |
| IAP (placeholder) | TODO — wire via `ysdk.getPayments` | See bottom of `src/ads.js`                                      |

In dev (SDK absent) `Ads.showRewarded()` resolves `{ rewarded: true }` after a small delay so the reward flows can still be tested locally.

## Publishing to Yandex Games

1. Build/zip the contents of this folder (no build step needed — flat ZIP).
2. Upload via the Yandex Games developer console.
3. Confirm:
   - Screen orientation: portrait (works in landscape too, no rotation lock)
   - The SDK loader URL is reachable from the iframe sandbox
   - Privacy policy URL is provided in the console

## Customisation cheatsheet

- **More evolutions** — extend `FROG_LEVELS` in `src/frogs.js` and add `frog.N.name` / `frog.N.desc` keys to every locale dict in `src/locale.js`.
- **Different board size** — change `ROWS` / `COLS` in `src/game.js`; CSS adapts automatically.
- **Economy tuning** — `SPAWN_COST_BASE`, `MERGE_COIN_REWARD`, `DISCOVERY_REWARD` in `src/game.js`. Daily reward ladder lives in `DAILY_REWARDS` inside `src/ui.js`.
- **New language** — add a key to `STRINGS` in `src/locale.js`. The UI rebuilds on `setLang(code)`.

## Why no canvas?

A grid-based merge UI doesn't need pixel-level rendering. DOM nodes + CSS transforms get us crisp scaling, GPU-accelerated animations, accessible structure, and far simpler input handling — at zero perf cost for 42 cells. WebAudio handles SFX so the asset payload stays tiny (important for catalog load times).
