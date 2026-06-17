/**
 * Frog data + asset module.
 *
 * Each evolution level is described by a palette and a rarity name. The
 * actual visual is rendered by `getFrogVisual(level)` which returns an HTML
 * string the UI can drop into a container.
 *
 * ASSET STRATEGY (important — read before swapping in custom art):
 *  - By default each level is rendered as a procedural SVG (no network calls).
 *  - If a PNG exists at `/assets/frogs/<level>.png` the UI will use it instead.
 *    Set `USE_PNG_IF_AVAILABLE = true` below and place the PNGs in
 *    `assets/frogs/`. They are loaded lazily and cached per level.
 *  - To add more evolution levels: append entries to FROG_LEVELS and add
 *    matching `frog.<n>.name` / `frog.<n>.desc` keys in `src/locale.js`.
 */

import { t } from './locale.js';

// Toggle to true once you ship PNG art under `/assets/frogs/`.
export const USE_PNG_IF_AVAILABLE = false;

// 12 evolution stages. Palette = [light, base, dark] body colors.
export const FROG_LEVELS = [
  { id: 1,  palette: ['#cfe9b2', '#9bc97a', '#5a8a3d'], glow: 'rgba(155,201,122,.45)' },
  { id: 2,  palette: ['#b9e7a9', '#7fc26b', '#3d8a3d'], glow: 'rgba(127,194,107,.45)' },
  { id: 3,  palette: ['#bfe1ff', '#74b6e8', '#235f9a'], glow: 'rgba(116,182,232,.5)'  },
  { id: 4,  palette: ['#ffe8a8', '#f5c25b', '#a07515'], glow: 'rgba(245,194,91,.5)'   },
  { id: 5,  palette: ['#a3f5d4', '#34c997', '#0f7a5b'], glow: 'rgba(52,201,151,.55)'  },
  { id: 6,  palette: ['#d0c3ff', '#9078e3', '#3f2a8a'], glow: 'rgba(144,120,227,.55)' },
  { id: 7,  palette: ['#ffc0b0', '#f08164', '#963820'], glow: 'rgba(240,129,100,.55)' },
  { id: 8,  palette: ['#ffe1a4', '#ff8f4d', '#a83a1c'], glow: 'rgba(255,143,77,.6)'   },
  { id: 9,  palette: ['#d2dffa', '#7a8bd9', '#293c80'], glow: 'rgba(122,139,217,.55)' },
  { id: 10, palette: ['#e5f3ff', '#9ec9ee', '#3b6e9a'], glow: 'rgba(158,201,238,.7)'  },
  { id: 11, palette: ['#fff0a8', '#ff97d0', '#7a2a8a'], glow: 'rgba(255,151,208,.7)'  },
  { id: 12, palette: ['#ffe7a0', '#ffb547', '#8a5a00'], glow: 'rgba(255,181,71,.75)'  }
];

export const MAX_LEVEL = FROG_LEVELS.length;

// Cache PNG availability checks so we never probe the network twice per level.
const pngCache = new Map(); // level -> Promise<boolean>

function pngExists(level) {
  if (!USE_PNG_IF_AVAILABLE) return Promise.resolve(false);
  if (pngCache.has(level)) return pngCache.get(level);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `assets/frogs/${level}.png`;
  });
  pngCache.set(level, p);
  return p;
}

/**
 * Build a procedural SVG for the given level. Same silhouette across the
 * collection (so they read as evolutions of one species) but each rarity
 * gets a custom palette plus an extra ornament for higher tiers.
 */
export function svgForLevel(level) {
  const data = FROG_LEVELS[level - 1] || FROG_LEVELS[0];
  const [light, base, dark] = data.palette;
  const gid = `fg${level}`;
  const ornament = level >= 6 ? `
    <ellipse cx="50" cy="35" rx="6" ry="4" fill="${light}" opacity=".55"/>
    <ellipse cx="40" cy="46" rx="3" ry="2" fill="${light}" opacity=".4"/>
    <ellipse cx="60" cy="46" rx="3" ry="2" fill="${light}" opacity=".4"/>` : '';
  const crown = level >= 10 ? `
    <path d="M 36 12 L 42 22 L 50 8 L 58 22 L 64 12 L 62 26 L 38 26 Z"
          fill="#ffd76a" stroke="#7c5a00" stroke-width="1"/>` : '';
  const sparkle = level >= 8 ? `
    <circle cx="22" cy="22" r="1.6" fill="#fff" opacity=".85"/>
    <circle cx="80" cy="20" r="1.2" fill="#fff" opacity=".7"/>
    <circle cx="86" cy="60" r="1.4" fill="#fff" opacity=".75"/>` : '';
  // Optional rainbow stripes for tier 11.
  const rainbow = level === 11 ? `
    <ellipse cx="50" cy="68" rx="30" ry="6" fill="url(#rb${level})" opacity=".45"/>
    <defs><linearGradient id="rb${level}" x1="0" x2="1">
      <stop offset="0%" stop-color="#ff6e6e"/><stop offset="33%" stop-color="#ffd76a"/>
      <stop offset="66%" stop-color="#7be39a"/><stop offset="100%" stop-color="#74b6e8"/>
    </linearGradient></defs>` : '';

  return `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="${gid}" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${base}"/>
    </radialGradient>
    <radialGradient id="${gid}-eye" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#dbe9ef"/>
    </radialGradient>
  </defs>

  <!-- Legs -->
  <ellipse cx="22" cy="78" rx="14" ry="8" fill="${dark}" opacity="0.85"/>
  <ellipse cx="78" cy="78" rx="14" ry="8" fill="${dark}" opacity="0.85"/>

  <!-- Body -->
  <ellipse cx="50" cy="62" rx="34" ry="28" fill="url(#${gid})"/>
  <!-- Belly highlight -->
  <ellipse cx="50" cy="74" rx="22" ry="13" fill="#ffffff" opacity="0.30"/>

  ${rainbow}
  ${ornament}

  <!-- Head bumps (where the eyes sit) -->
  <circle cx="34" cy="32" r="14" fill="url(#${gid})"/>
  <circle cx="66" cy="32" r="14" fill="url(#${gid})"/>

  <!-- Eye whites -->
  <circle cx="34" cy="30" r="8" fill="url(#${gid}-eye)"/>
  <circle cx="66" cy="30" r="8" fill="url(#${gid}-eye)"/>

  <!-- Pupils -->
  <circle cx="34" cy="32" r="4" fill="#1a1a1a"/>
  <circle cx="66" cy="32" r="4" fill="#1a1a1a"/>
  <circle cx="35.6" cy="30.4" r="1.6" fill="#fff"/>
  <circle cx="67.6" cy="30.4" r="1.6" fill="#fff"/>

  <!-- Smile -->
  <path d="M 36 56 Q 50 66 64 56" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Cheek blush for lower tiers -->
  ${level <= 6 ? `
    <ellipse cx="28" cy="56" rx="4" ry="2.4" fill="#ff8aa6" opacity=".55"/>
    <ellipse cx="72" cy="56" rx="4" ry="2.4" fill="#ff8aa6" opacity=".55"/>` : ''}

  ${sparkle}
  ${crown}
</svg>`.trim();
}

/**
 * Returns ready-to-mount HTML for a frog of the given level.
 * Uses PNG if both USE_PNG_IF_AVAILABLE is on AND the file exists.
 * Falls back to procedural SVG otherwise. Always synchronous.
 */
export function getFrogVisual(level) {
  // Synchronous SVG is the default — fast and always available.
  return svgForLevel(level);
}

/**
 * Asynchronously upgrades an existing frog node to PNG if available.
 * Call this after mounting if you want the prettier PNG art when shipped.
 */
export async function tryUpgradeToPng(node, level) {
  const ok = await pngExists(level);
  if (!ok) return;
  node.innerHTML = `<img src="assets/frogs/${level}.png" alt="" draggable="false">`;
}

export function getFrogName(level)        { return t(`frog.${level}.name`); }
export function getFrogDescription(level) { return t(`frog.${level}.desc`); }
export function getFrogGlow(level)        { return FROG_LEVELS[level - 1]?.glow ?? 'rgba(255,255,255,.4)'; }
