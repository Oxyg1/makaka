# Frog art

Drop PNG files here named `1.png` through `12.png` (matching `FROG_LEVELS` in `src/frogs.js`).

When you're ready to ship them:

1. Place PNGs in this folder.
2. Open `src/frogs.js` and set `USE_PNG_IF_AVAILABLE = true`.
3. The UI will probe for each level's PNG on demand and swap the SVG out transparently.

Recommended export:
- Square 512×512 PNG with transparent background.
- Centered subject with ~10% safe-area padding.
- The same silhouette across levels so the evolution reads visually.
