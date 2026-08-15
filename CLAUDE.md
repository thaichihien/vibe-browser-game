# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A collection of vanilla HTML/CSS/JS browser games, deployed as a static site to GitHub Pages
(<https://thaichihien.github.io/vibe-browser-game/>). No framework, no build step, no
`package.json`, no dependencies to install. `index.html` is the hub; every game is one
self-contained file in `games/`.

## Commands

```bash
# serve locally (opening index.html over file:// works but is not the tested path)
python3 -m http.server 8000

# run the test suite — the bare directory form fails, the glob is required
node --test 'tests/*.test.mjs'

# run one test file
node --test tests/rules.test.mjs

# run one test by name
node --test --test-name-pattern 'PLUS' tests/rules.test.mjs
```

Tests use Node 22 built-ins only (`node:test`, `node:assert`, `node:vm`). There is no linter
and no formatter.

For launching and driving games headlessly (Playwright against the system browser), see the
`verify` skill in `.claude/skills/verify/`.

## Architecture

### The hub — `index.html`

A single-file SPA styled as "ARCADE.SYS" (neon/cyberpunk). Its shape matters more than its CSS:

- **The `games` array at the top of the `<script>` is the only source of truth.** Sidebar
  sectors, category chips, counts, the NEW badge and the spotlight carousel are all derived
  from it — nothing reads the filesystem. See "Adding a new game" below for the entry shape.
- A new `category` value creates its own sector automatically, but needs a matching glyph in
  **`CATEGORY_ICONS`, which must stay monochrome** — emoji codepoints (🕹, 🌱) render in
  colour and break the sidebar's uniform look.
- Routing is hash-based over two routes: `#/home` (hero carousel + rails) and `#/library`
  (filter/sort grid), plus `#/library/<Category>`, `#/favorites`, `#/recent`. `applyHash()`
  resets filter state then re-renders, so **anything that navigates must go through
  `go(hash)` and let `hashchange` drive the render** — work queued straight after setting
  the hash runs before the new DOM exists (that is why focusing search uses a
  `state.wantSearch` flag consumed in `render()`).
- Hub state in `localStorage`: `gamehub:favorites`, `gamehub:lastPlayed`.

### Games — `games/*.html`

One file per game: inline `<style>`, markup, inline `<script>`, emoji for all art. No image,
audio or font assets, and no network requests — with **three exceptions**:
`games/magic-shooter.html` loads Three.js from a CDN (test its CDN-failure fallback when
touching it), `games/grid-storm/` ships ~17 MB of background music in `music/*.mp3`, and
`games/farmer-dream.html` ships ~16 MB in `games/music/farmer-dream/`. Both music players
treat a failed track as "skip to the next one", so the games still run if the files are
missing. Single-file games keep their audio under `games/music/<slug>/` rather than a
sibling folder, which would read as a folder game. `games/jungle-king.backup.html` is a
leftover backup, not linked from the hub.

Recurring house conventions across games: Web Audio synth for sound with a mute flag in
`localStorage` under `<gameCamelCase>.muted` (`coCaNgua.muted`, `coThu.muted`,
`dauTruongSinhVat.muted` — note the key kept its pre-rename name), a start screen, a rules
modal, and an end overlay. The three board games (`jungle-game`, `co-ca-ngua`,
`monster-battle`) have **Vietnamese UI copy**; the arcade/action games are in English.

### The testable-region pattern — `games/monster-battle.html` + `tests/`

Only this game is unit-tested, and the mechanism is worth understanding before editing it:

- Its `<script>` opens with two comment-delimited regions,
  `/* ==== ENGINE:START ==== */ … END` (`CARDS`, `neighborsOf`, `OPPOSITE`, `Rules`, `Deal`)
  and `/* ==== AI:START ==== */ … END` (`AI`).
- `tests/harness.mjs` reads the HTML, extracts those regions by marker, and evaluates them in
  a `node:vm` context whose globals are only `{ console, Math, JSON }`.
- **Both regions must stay DOM-free.** A stray `document` or `window` reference inside them
  breaks the entire suite — that is the point of the bare context.
- `harness.mjs` hard-codes the game's path in `GAME`; renaming the file requires updating it.
- `bridge()` in the harness deep-clones values out of the vm realm because
  `assert.deepStrictEqual` compares prototypes across realms.
- `Rules.resolve` returns **ordered flip waves** rather than a final board. The renderer
  replays them as staggered animations and the AI searches over them, which is what keeps
  the engine DOM-free.
- `tests/syntax.test.mjs` parses the whole `<script>` body, so UI-only edits still have a gate.

### Docs — `docs/superpowers/`

`specs/YYYY-MM-DD-<game>-design.md` then `plans/YYYY-MM-DD-<game>.md` (checkbox task lists)
for the recent games. The plans record deliberate deviations from their specs; read the plan
before changing a game it covers. Files here keep their original slugs even after a game is
renamed (`dau-truong-sinh-vat` → `monster-battle`).

## Adding a new game

A new game is not finished when its file runs. **It must be registered in `index.html` or it
is unreachable** — nothing scans the `games/` directory, so an unregistered file simply never
appears in the hub. Shipping one means all three of:

1. **`games/<slug>.html`** — the game itself, self-contained per "Games — `games/*.html`" above.
   A game big enough to warrant it may instead be a **folder**, `games/<slug>/` with its own
   `index.html`, `style.css` and ES modules — `games/last-quarter/` is the only one so far.
   The tradeoff is that ES modules do not load over `file://`, so a folder game must be opened
   through a server; GitHub Pages is unaffected. Everything else still applies: vanilla JS, no
   build step, no dependencies, emoji for all art, no network requests.
2. **The `games` array in `index.html`** — append one object. All of these fields are required;
   several features silently misbehave if any is omitted:

   ```js
   {
     icon: "🧪",                                   // emoji only — do NOT put it in `title`
     title: "Monster battle",
     description: "Đấu bài sinh vật 3×3: SAME, PLUS và combo lật ngược thế trận!",
     category: "Board",                            // new value ⇒ also add it to CATEGORY_ICONS
     tags: ["Cards", "vs AI", "Tiếng Việt"],       // searchable; shown as pills
     added: "2026-07-28",                          // ISO; drives newest-sort and the NEW badge
     color: "linear-gradient(135deg, #12103a, #d946a6)",  // last hex stop becomes the card glow
     path: "games/monster-battle.html"    // folder games point at their index.html
   }
   ```

   Pick a `color` distinct from the existing entries — the gradient is the card's identity in
   the grid, and its final stop is what the neon hover glow is derived from.
3. **The game list in `README.md`** — one line.

Then load the hub and confirm the card renders, opens, and lands in the right sector. The
README is currently stale on this point: it lists only 8 games and claims they live in the
repo root rather than `games/`.

## Conventions

- Conventional commits with a short scope, usually the game slug:
  `feat(sinh-vat): …`, `fix(jungle): …`, `style(co-ca-ngua): …`, `docs(...)`, `test(...)`.
  Bodies explain the failure being fixed, not just the change.
