---
name: verify
description: How to build/launch/drive this repo's browser games for verification
---

# Verifying games in this repo

Static site, no build step. Each game is one self-contained HTML file in `games/`;
`index.html` is the hub. Some games load Three.js from a CDN, so serve over HTTP
and allow network.

## Launch

No python on this machine. Quickest server: a ~10-line Node `http.createServer`
that reads files from the repo root (see any `verify-game*.js` from past sessions),
or `npx http-server`.

## Drive (headless)

Playwright with the system Edge browser works — install the `playwright` npm
package in the scratchpad (no browser download needed) and launch with
`chromium.launch({ channel: 'msedge', headless: true })`.

- Collect `console` type=error and `pageerror` events — a clean run has zero.
- Game state is reachable via `page.evaluate` (top-level `let/const` in the game
  script are visible to evaluate). Prefer driving real input paths (mouse clicks,
  `page.keyboard`) and reading state as evidence.

## Gotchas

- **Pointer lock**: `page.mouse.click` acquires it fine, but synthetic
  `keyboard.press('Escape')` does NOT exit pointer lock (that's browser-level).
  To test pause-on-Esc, call `document.exitPointerLock()` in evaluate instead.
- **Headless renders at ~24fps software** (no GPU). Game `dt` is capped at 50ms
  per frame, so game-time timers run slower than wall clock — wait ~2x the game
  duration you're testing. FPS numbers from headless are meaningless for real
  hardware.
- **CDN-failure fallbacks**: test with `page.route('**/three.min.js', r => r.abort())`.
