# Đấu Trường Sinh Vật Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Laboratz-style (Triple Triad) 3×3 card battler as one self-contained HTML file with a 30-card emoji creature roster, vs-AI and hot-seat modes, and a neon-lab theme.

**Architecture:** Single file `games/dau-truong-sinh-vat.html`. Inside it, a **pure rules engine** (`CARDS`, `Rules`, `Deal`) and a **pure AI** (`AI`) live in comment-delimited regions with no DOM access; a render/interaction layer consumes them. `Rules.resolve` returns *ordered flip waves*, which the renderer replays as staggered animations and the AI searches over without touching the DOM. Because the engine regions are DOM-free, a Node harness extracts and unit-tests them directly — real red/green cycles for the rules, manual playtest for the visuals.

**Tech Stack:** Vanilla HTML/CSS/JS, CSS Grid, Web Animations API, Web Audio API, emoji glyphs. Tests: Node 22 built-ins only (`node:test`, `node:assert`, `node:vm`). No libraries, no install step, no build.

## Global Constraints

- Single self-contained game file at `games/dau-truong-sinh-vat.html`; no external CSS/JS/image/font/audio files, no network requests.
- Emoji only for all creature art and icons (no SVG/image assets).
- UI copy in **Vietnamese**, consistent with `games/jungle-game.html` and `games/co-ca-ngua.html`.
- Board is 3×3, cells indexed `0..8` (`row = (idx/3)|0`, `col = idx % 3`). The board does **not** wrap.
- Card edges are `n`,`e`,`s`,`w`, each `1..10`. **10 renders as the string `A`.**
- Resolution order is exactly: **SAME → PLUS → BASIC → COMBO**. Only cards flipped by SAME or PLUS seed the COMBO cascade.
- `score(P) = board cards owned by P + cards left in P's hand`; the two scores always total 10; 5–5 is a draw.
- Both hands are dealt face-up (Triple Triad "Open" rule) all match.
- Hand recipe: **2 Common + 2 Uncommon + 1 Rare** per side, drawn without replacement from the shared 30-card roster.
- No persistence except the sound-mute flag in `localStorage` under key `dauTruongSinhVat.muted`.
- Palette: void `#07040f`, panel `rgba(14,10,30,.72)`, player 0 cyan `#22d3ee`, player 1 magenta `#f472d0`, Common rim `#7c8798`, Uncommon rim `#34d399`, Rare rim `#fbbf24`.
- Rim colour encodes **rarity**; card fill tint encodes **ownership**. Never conflate the two.
- Every engine function is **pure** — no DOM, no `window`, no mutation of its arguments.
- Commit after each task using the repo trailer format (shown in each Step 5).

### Deviation from spec §7.1 (deliberate)

The spec called for an in-page `window.__selfTest()` logging pass/fail to the console. Node 22 is available on this machine, so the same ten cases become a real test suite under `tests/` with a genuine exit code, run via `node --test tests/`. This is strictly better than console logging and removes the duplication of maintaining both. `__selfTest()` is **not** implemented.

---

## File Structure

- `games/dau-truong-sinh-vat.html` — the entire game (Tasks 1–12).
- `tests/harness.mjs` — extracts marked regions from the HTML and evaluates them in a `node:vm` context (Task 1).
- `tests/rules.test.mjs` — rules engine unit tests (Tasks 1–6).
- `tests/ai.test.mjs` — AI behaviour tests (Task 7).
- `tests/syntax.test.mjs` — parses the full `<script>` body so every UI task has an automated gate (Task 1).
- `index.html` — hub; add one entry to the `games` array (Task 12).
- `README.md` — add one line to the game list (Task 12).

Within `dau-truong-sinh-vat.html`, the `<script>` body is organised top-to-bottom:

1. `/* ==== ENGINE:START ==== */` … `/* ==== ENGINE:END ==== */` — `CARDS`, `neighborsOf`, `OPPOSITE`, `Rules`, `Deal`. DOM-free.
2. `/* ==== AI:START ==== */` … `/* ==== AI:END ==== */` — `AI`. DOM-free, depends only on region 1.
3. State object and DOM references.
4. Rendering — `renderBoard()`, `renderHands()`, `renderStatus()`.
5. Interaction — selection, hover preview, placement.
6. Animation — wave playback, callouts, effects.
7. `Sound` IIFE.
8. Wiring — start screen, controls, rules modal, win overlay, init.

**The two marked regions must stay DOM-free.** Every rules test depends on that; a stray `document` reference breaks the whole suite.

---

## Authoritative Card Roster (reference for Task 1)

Values are `n/e/s/w`. Ids are array indices, `0..29`.

| # | Emoji | Name | Rarity | n | e | s | w |
|---|---|---|---|---|---|---|---|
| 0 | 🐀 | Chuột Thí Nghiệm | common | 3 | 2 | 4 | 1 |
| 1 | 🐁 | Chuột Nhắt | common | 1 | 4 | 2 | 3 |
| 2 | 🦗 | Dế Đột Biến | common | 2 | 5 | 1 | 3 |
| 3 | 🐛 | Sâu Nhớt | common | 5 | 1 | 3 | 2 |
| 4 | 🕷️ | Nhện Ống Nghiệm | common | 4 | 3 | 2 | 3 |
| 5 | 🐸 | Ếch Axit | common | 2 | 6 | 1 | 3 |
| 6 | 🦎 | Thằn Lằn Tái Sinh | common | 6 | 2 | 3 | 2 |
| 7 | 🐍 | Rắn Neon | common | 3 | 5 | 4 | 1 |
| 8 | 🦂 | Bọ Cạp Phóng Xạ | common | 5 | 2 | 6 | 1 |
| 9 | 🐙 | Bạch Tuộc Biến Gen | common | 2 | 7 | 3 | 2 |
| 10 | 🦇 | Dơi Siêu Âm | common | 7 | 3 | 2 | 3 |
| 11 | 🐜 | Kiến Chúa Nhỏ | common | 4 | 4 | 3 | 4 |
| 12 | 🪲 | Bọ Giáp Sắt | common | 3 | 3 | 7 | 3 |
| 13 | 🐢 | Rùa Vỏ Thép | common | 2 | 4 | 4 | 6 |
| 14 | 🦅 | Đại Bàng Sinh Học | uncommon | 8 | 4 | 2 | 3 |
| 15 | 🐺 | Sói Đột Biến | uncommon | 5 | 6 | 4 | 2 |
| 16 | 🦈 | Cá Mập Bể Nuôi | uncommon | 3 | 8 | 5 | 2 |
| 17 | 🦉 | Cú Quét Tia | uncommon | 7 | 3 | 5 | 3 |
| 18 | 🐊 | Cá Sấu Nhân Bản | uncommon | 4 | 5 | 8 | 2 |
| 19 | 🦏 | Tê Giác Bọc Giáp | uncommon | 2 | 4 | 6 | 7 |
| 20 | 🐗 | Lợn Lòi Cuồng Nộ | uncommon | 6 | 7 | 3 | 4 |
| 21 | 🦍 | Khỉ Đột Cường Hóa | uncommon | 5 | 5 | 6 | 5 |
| 22 | 🐻 | Gấu Phóng Xạ | uncommon | 9 | 4 | 6 | 2 |
| 23 | 🦖 | Khủng Long Thu Nhỏ | uncommon | 6 | 8 | 5 | 3 |
| 24 | 🐉 | Rồng Ống Nghiệm | rare | 9 | 7 | 6 | 3 |
| 25 | 👾 | Sinh Vật Lạ | rare | 7 | 9 | 4 | 5 |
| 26 | 🦑 | Mực Khổng Lồ | rare | 5 | 6 | 9 | 6 |
| 27 | 👹 | Quỷ Đột Biến | rare | 8 | 5 | 7 | 7 |
| 28 | 🐲 | Long Vương Gen | rare | 10 | 6 | 8 | 4 |
| 29 | 🦠 | Siêu Vi Nguyên Tổ | rare | 7 | 10 | 6 | 7 |

Counts: 14 common (0–13), 10 uncommon (14–23), 6 rare (24–29).

---

## Task 1: Test harness, game skeleton, card roster

**Files:**
- Create: `games/dau-truong-sinh-vat.html`
- Create: `tests/harness.mjs`
- Create: `tests/rules.test.mjs`
- Create: `tests/syntax.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `harness.load(markers, names)` → object of named globals from the extracted regions. `CARDS` — array of 30 `{id, emoji, name, r, n, e, s, w}` where `r` ∈ `'common'|'uncommon'|'rare'`. Marker regions `ENGINE` and `AI` in the HTML.

- [ ] **Step 1: Write the harness**

Create `tests/harness.mjs`:

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAME = path.join(ROOT, 'games', 'dau-truong-sinh-vat.html');

export function readGame() {
  return readFileSync(GAME, 'utf8');
}

// Pull out the full <script> body — used by the syntax gate.
export function scriptBody() {
  const m = readGame().match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('No <script> block found in ' + GAME);
  return m[1];
}

// Pull out one comment-delimited region, e.g. ENGINE.
export function extract(marker) {
  const re = new RegExp(
    `/\\* ==== ${marker}:START ==== \\*/([\\s\\S]*?)/\\* ==== ${marker}:END ==== \\*/`
  );
  const m = readGame().match(re);
  if (!m) throw new Error(`Marker ${marker} not found in ` + GAME);
  return m[1];
}

// Evaluate the given regions in a bare context and hand back the named globals.
// The context has no `document` or `window` on purpose: if engine code ever
// touches the DOM, these tests fail loudly instead of silently passing.
export function load(markers, names) {
  const code = markers.map(extract).join('\n');
  const ctx = { console, Math, JSON };
  vm.createContext(ctx);
  vm.runInContext(`${code}\nglobalThis.__exports = { ${names.join(', ')} };`, ctx);
  return ctx.__exports;
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/syntax.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { scriptBody } from './harness.mjs';

test('game script parses without syntax errors', () => {
  assert.doesNotThrow(() => new vm.Script(scriptBody()));
});
```

Create `tests/rules.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';

const { CARDS } = load(['ENGINE'], ['CARDS']);

test('roster has exactly 30 cards with sequential ids', () => {
  assert.equal(CARDS.length, 30);
  CARDS.forEach((c, i) => assert.equal(c.id, i));
});

test('rarity counts are 14 common, 10 uncommon, 6 rare', () => {
  const by = r => CARDS.filter(c => c.r === r).length;
  assert.equal(by('common'), 14);
  assert.equal(by('uncommon'), 10);
  assert.equal(by('rare'), 6);
});

test('every edge value is an integer in 1..10', () => {
  for (const c of CARDS) {
    for (const d of ['n', 'e', 's', 'w']) {
      assert.ok(Number.isInteger(c[d]), `${c.name}.${d} not an integer`);
      assert.ok(c[d] >= 1 && c[d] <= 10, `${c.name}.${d} out of range: ${c[d]}`);
    }
  }
});

test('edge sums stay inside their rarity band', () => {
  const band = { common: [10, 16], uncommon: [17, 22], rare: [25, 30] };
  for (const c of CARDS) {
    const sum = c.n + c.e + c.s + c.w;
    const [lo, hi] = band[c.r];
    assert.ok(sum >= lo && sum <= hi, `${c.name} sum ${sum} outside ${c.r} band ${lo}-${hi}`);
  }
});

test('every card has a distinct emoji and name', () => {
  assert.equal(new Set(CARDS.map(c => c.emoji)).size, 30);
  assert.equal(new Set(CARDS.map(c => c.name)).size, 30);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `Marker ENGINE not found` and `No <script> block found`, because the game file does not exist yet.

- [ ] **Step 4: Create the game skeleton with the roster**

Create `games/dau-truong-sinh-vat.html`:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Đấu Trường Sinh Vật</title>
<style>
*{box-sizing:border-box}
body{
    margin:0;
    min-height:100vh;
    font-family:'Segoe UI',system-ui,sans-serif;
    color:#e8f6ff;
    background:#07040f;
}
</style>
</head>
<body>
<div class="container" id="app"></div>

<script>
/* ==== ENGINE:START ==== */
const RARITY_BAND = {
    common:   [10, 16],
    uncommon: [17, 22],
    rare:     [25, 30]
};

// id === index. n/e/s/w are the four edge values, 1..10 (10 displays as "A").
const CARDS = [
    {id:0,  emoji:'🐀',  name:'Chuột Thí Nghiệm',   r:'common',   n:3,  e:2,  s:4, w:1},
    {id:1,  emoji:'🐁',  name:'Chuột Nhắt',          r:'common',   n:1,  e:4,  s:2, w:3},
    {id:2,  emoji:'🦗',  name:'Dế Đột Biến',         r:'common',   n:2,  e:5,  s:1, w:3},
    {id:3,  emoji:'🐛',  name:'Sâu Nhớt',            r:'common',   n:5,  e:1,  s:3, w:2},
    {id:4,  emoji:'🕷️',  name:'Nhện Ống Nghiệm',     r:'common',   n:4,  e:3,  s:2, w:3},
    {id:5,  emoji:'🐸',  name:'Ếch Axit',            r:'common',   n:2,  e:6,  s:1, w:3},
    {id:6,  emoji:'🦎',  name:'Thằn Lằn Tái Sinh',   r:'common',   n:6,  e:2,  s:3, w:2},
    {id:7,  emoji:'🐍',  name:'Rắn Neon',            r:'common',   n:3,  e:5,  s:4, w:1},
    {id:8,  emoji:'🦂',  name:'Bọ Cạp Phóng Xạ',     r:'common',   n:5,  e:2,  s:6, w:1},
    {id:9,  emoji:'🐙',  name:'Bạch Tuộc Biến Gen',  r:'common',   n:2,  e:7,  s:3, w:2},
    {id:10, emoji:'🦇',  name:'Dơi Siêu Âm',         r:'common',   n:7,  e:3,  s:2, w:3},
    {id:11, emoji:'🐜',  name:'Kiến Chúa Nhỏ',       r:'common',   n:4,  e:4,  s:3, w:4},
    {id:12, emoji:'🪲',  name:'Bọ Giáp Sắt',         r:'common',   n:3,  e:3,  s:7, w:3},
    {id:13, emoji:'🐢',  name:'Rùa Vỏ Thép',         r:'common',   n:2,  e:4,  s:4, w:6},
    {id:14, emoji:'🦅',  name:'Đại Bàng Sinh Học',   r:'uncommon', n:8,  e:4,  s:2, w:3},
    {id:15, emoji:'🐺',  name:'Sói Đột Biến',        r:'uncommon', n:5,  e:6,  s:4, w:2},
    {id:16, emoji:'🦈',  name:'Cá Mập Bể Nuôi',      r:'uncommon', n:3,  e:8,  s:5, w:2},
    {id:17, emoji:'🦉',  name:'Cú Quét Tia',         r:'uncommon', n:7,  e:3,  s:5, w:3},
    {id:18, emoji:'🐊',  name:'Cá Sấu Nhân Bản',     r:'uncommon', n:4,  e:5,  s:8, w:2},
    {id:19, emoji:'🦏',  name:'Tê Giác Bọc Giáp',    r:'uncommon', n:2,  e:4,  s:6, w:7},
    {id:20, emoji:'🐗',  name:'Lợn Lòi Cuồng Nộ',    r:'uncommon', n:6,  e:7,  s:3, w:4},
    {id:21, emoji:'🦍',  name:'Khỉ Đột Cường Hóa',   r:'uncommon', n:5,  e:5,  s:6, w:5},
    {id:22, emoji:'🐻',  name:'Gấu Phóng Xạ',        r:'uncommon', n:9,  e:4,  s:6, w:2},
    {id:23, emoji:'🦖',  name:'Khủng Long Thu Nhỏ',  r:'uncommon', n:6,  e:8,  s:5, w:3},
    {id:24, emoji:'🐉',  name:'Rồng Ống Nghiệm',     r:'rare',     n:9,  e:7,  s:6, w:3},
    {id:25, emoji:'👾',  name:'Sinh Vật Lạ',         r:'rare',     n:7,  e:9,  s:4, w:5},
    {id:26, emoji:'🦑',  name:'Mực Khổng Lồ',        r:'rare',     n:5,  e:6,  s:9, w:6},
    {id:27, emoji:'👹',  name:'Quỷ Đột Biến',        r:'rare',     n:8,  e:5,  s:7, w:7},
    {id:28, emoji:'🐲',  name:'Long Vương Gen',      r:'rare',     n:10, e:6,  s:8, w:4},
    {id:29, emoji:'🦠',  name:'Siêu Vi Nguyên Tổ',   r:'rare',     n:7,  e:10, s:6, w:7}
];
/* ==== ENGINE:END ==== */
</script>
</body>
</html>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/`
Expected: PASS — 6 tests (5 rules + 1 syntax).

- [ ] **Step 6: Commit**

```bash
git add games/dau-truong-sinh-vat.html tests/
git commit -m "$(cat <<'EOF'
feat(sinh-vat): card roster and Node test harness

Adds the 30-card emoji creature roster in a DOM-free ENGINE region plus a
node:vm harness that extracts and unit-tests it. Node 22 built-ins only.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 2: `Rules.resolve` — BASIC capture

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (ENGINE region)
- Modify: `tests/rules.test.mjs`

**Interfaces:**
- Consumes: `CARDS` from Task 1.
- Produces:
  - `OPPOSITE` — `{n:'s', e:'w', s:'n', w:'e'}`.
  - `neighborsOf(idx)` → `[{dir, cell}, ...]` for in-board neighbours only.
  - `Rules.resolve(board, cellIdx, cardId, owner)` → `{waves, same, plus, comboDepth}`. `board` is a 9-element array of `null | {cardId, owner}`; `owner` is `0|1`. Returns ordered flip waves; **mutates nothing**.

- [ ] **Step 1: Write the failing tests**

Append to `tests/rules.test.mjs` (and extend the destructure at the top of the file to `load(['ENGINE'], ['CARDS', 'Rules', 'neighborsOf'])`):

```js
// Board helper: `spec` maps cell index -> [cardId, owner].
function makeBoard(spec) {
  const b = Array(9).fill(null);
  for (const [idx, [cardId, owner]] of Object.entries(spec)) {
    b[Number(idx)] = { cardId, owner };
  }
  return b;
}
const flat = res => res.waves.flat();

test('neighborsOf respects board edges — no wrapping', () => {
  assert.deepEqual(neighborsOf(0).map(n => n.dir).sort(), ['e', 's']);
  assert.deepEqual(neighborsOf(4).map(n => n.dir).sort(), ['e', 'n', 's', 'w']);
  assert.deepEqual(neighborsOf(8).map(n => n.dir).sort(), ['n', 'w']);
  // cell 3 is column 0 — it must have no west neighbour
  assert.ok(!neighborsOf(3).some(n => n.dir === 'w'));
});

test('BASIC: higher facing edge flips one enemy card', () => {
  // cell 4 holds enemy 🐀 (id 0, w:1). We place 🐲 (id 28, e:6) at cell 3.
  // Our east 6 vs their west 1 -> flip.
  const board = makeBoard({ 4: [0, 1] });
  const res = Rules.resolve(board, 3, 28, 0);
  assert.deepEqual(flat(res), [4]);
});

test('BASIC: equal facing edges do not flip', () => {
  // 🐜 (id 11) has e:4 and w:4. Place it against itself across a boundary.
  const board = makeBoard({ 4: [11, 1] });
  const res = Rules.resolve(board, 3, 11, 0);
  assert.deepEqual(flat(res), []);
});

test('BASIC: never flips a card you already own', () => {
  const board = makeBoard({ 4: [0, 0] });
  const res = Rules.resolve(board, 3, 28, 0);
  assert.deepEqual(flat(res), []);
});

test('resolve does not mutate the board it is given', () => {
  const board = makeBoard({ 4: [0, 1] });
  const snapshot = JSON.stringify(board);
  Rules.resolve(board, 3, 28, 0);
  assert.equal(JSON.stringify(board), snapshot);
});

test('resolve reports no combo when only BASIC fired', () => {
  const board = makeBoard({ 4: [0, 1] });
  const res = Rules.resolve(board, 3, 28, 0);
  assert.equal(res.same, false);
  assert.equal(res.plus, false);
  assert.equal(res.comboDepth, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/rules.test.mjs`
Expected: FAIL — `Rules is not defined`.

- [ ] **Step 3: Implement BASIC resolution**

Insert into the ENGINE region of `games/dau-truong-sinh-vat.html`, after `CARDS`:

```js
const OPPOSITE = {n:'s', e:'w', s:'n', w:'e'};

// In-board neighbours of a cell. The 3x3 grid does not wrap.
function neighborsOf(idx){
    const row = (idx/3)|0, col = idx%3;
    const out = [];
    if(row>0) out.push({dir:'n', cell:idx-3});
    if(col<2) out.push({dir:'e', cell:idx+1});
    if(row<2) out.push({dir:'s', cell:idx+3});
    if(col>0) out.push({dir:'w', cell:idx-1});
    return out;
}

const Rules = (()=>{
    // Facing-edge comparison data for every occupied neighbour of `cellIdx`.
    function contacts(board, cellIdx, cardId, owner){
        const me = CARDS[cardId];
        return neighborsOf(cellIdx)
            .filter(n => board[n.cell])
            .map(n => {
                const occ = board[n.cell];
                return {
                    cell:   n.cell,
                    dir:    n.dir,
                    mine:   me[n.dir],
                    theirs: CARDS[occ.cardId][OPPOSITE[n.dir]],
                    enemy:  occ.owner !== owner
                };
            });
    }

    function resolve(board, cellIdx, cardId, owner){
        const info = contacts(board, cellIdx, cardId, owner);
        const flipped = new Set();

        // BASIC — strictly greater facing edge flips an enemy.
        info.forEach(i => {
            if(i.enemy && i.mine > i.theirs) flipped.add(i.cell);
        });

        return {
            waves: [[...flipped]],
            same: false,
            plus: false,
            comboDepth: 0
        };
    }

    return {resolve};
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: PASS — all 12 tests.

- [ ] **Step 5: Commit**

```bash
git add games/dau-truong-sinh-vat.html tests/rules.test.mjs
git commit -m "$(cat <<'EOF'
feat(sinh-vat): BASIC capture rule in pure Rules.resolve

Higher facing edge flips an adjacent enemy card. Board edges do not wrap
and resolve never mutates its arguments.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 3: SAME rule

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (ENGINE region)
- Modify: `tests/rules.test.mjs`

**Interfaces:**
- Consumes: `Rules.resolve`, `makeBoard`, `flat` from Task 2.
- Produces: `resolve(...).same` is `true` when the SAME rule fired.

**Rule:** collect every occupied neighbour whose facing edge **equals** ours. If that set has **≥2 members** and **≥1 is enemy-owned**, flip every enemy-owned member. Friendly members count toward the ≥2 threshold but are never flipped.

- [ ] **Step 1: Write the failing tests**

Append to `tests/rules.test.mjs`:

```js
// Standard SAME fixture, used by several tests below.
// Place 🐜 (id 11: n4 e4 s3 w4) at centre cell 4. Cell 4's occupied contacts:
//   west  = cell 3 = 🐢 (id 13, e:4)  -> our w:4 ties  -> SAME contact
//   east  = cell 5 = 🐗 (id 20, w:4)  -> our e:4 ties  -> SAME contact
// Neither tie can be taken by BASIC, which needs a *strictly* greater edge.
test('SAME: two equal facing edges flip both enemies', () => {
  const board = makeBoard({ 3: [13, 1], 5: [20, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, true);
  assert.deepEqual(flat(res).sort((a, b) => a - b), [3, 5]);
});

test('SAME: a single equal edge is not enough', () => {
  const board = makeBoard({ 5: [20, 1] }); // one equal contact only
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, false);
});

test('SAME: friendly neighbour counts toward the threshold but is not flipped', () => {
  // Same geometry, but cell 3 is ours. SAME still fires — two equal contacts —
  // and only the enemy at cell 5 flips.
  const board = makeBoard({ 3: [13, 0], 5: [20, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, true);
  assert.deepEqual(flat(res), [5]);
});

test('SAME takes cards BASIC never could', () => {
  // This is the whole point of the rule. Both contacts are exact ties, so a
  // BASIC-only engine flips nothing here.
  const board = makeBoard({ 3: [13, 1], 5: [20, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(CARDS[13].e, CARDS[11].w); // tie, not a win
  assert.equal(CARDS[20].w, CARDS[11].e); // tie, not a win
  assert.deepEqual(flat(res).sort((a, b) => a - b), [3, 5]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/rules.test.mjs`
Expected: FAIL — `res.same` is `false` and cell 3 is missing from the flip list.

- [ ] **Step 3: Implement SAME**

Replace the body of `resolve` in the ENGINE region with:

```js
    function resolve(board, cellIdx, cardId, owner){
        const info = contacts(board, cellIdx, cardId, owner);
        const flipped = new Set();
        const seeds = new Set();   // flipped by SAME/PLUS -> these seed COMBO
        let same = false;

        // SAME — >=2 contacts with exactly equal facing edges, >=1 of them enemy.
        const tied = info.filter(i => i.mine === i.theirs);
        if(tied.length >= 2 && tied.some(i => i.enemy)){
            same = true;
            tied.filter(i => i.enemy).forEach(i => { flipped.add(i.cell); seeds.add(i.cell); });
        }

        // BASIC — strictly greater facing edge flips an enemy.
        info.forEach(i => {
            if(i.enemy && i.mine > i.theirs) flipped.add(i.cell);
        });

        return {
            waves: [[...flipped]],
            same,
            plus: false,
            comboDepth: 0
        };
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: PASS — all 16 tests.

- [ ] **Step 5: Commit**

```bash
git add games/dau-truong-sinh-vat.html tests/rules.test.mjs
git commit -m "$(cat <<'EOF'
feat(sinh-vat): SAME capture rule

Two or more exactly-tied facing edges flip every enemy in the tied set.
Friendly neighbours count toward the threshold without being flipped.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 4: PLUS rule

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (ENGINE region)
- Modify: `tests/rules.test.mjs`

**Interfaces:**
- Consumes: `Rules.resolve` from Task 3.
- Produces: `resolve(...).plus` is `true` when the PLUS rule fired.

**Rule:** for every occupied neighbour compute `sum = myEdge + theirFacingEdge`. Group neighbours by that sum. For every group with **≥2 members** and **≥1 enemy-owned member**, flip every enemy-owned member of that group. PLUS is evaluated independently of SAME; both may fire on one placement.

- [ ] **Step 1: Write the failing tests**

Append to `tests/rules.test.mjs`:

```js
// PLUS fixture, deliberately built so BASIC and SAME both flip nothing —
// every capture here is PLUS's doing alone.
// Place 🐜 (id 11: n4 e4 s3 w4) at centre cell 4:
//   west = cell 3 = 🐍 (id 7,  e:5) -> our w:4 loses to 5;  sum 4 + 5 = 9
//   east = cell 5 = 👾 (id 25, w:5) -> our e:4 loses to 5;  sum 4 + 5 = 9
// Sums tie at 9, so PLUS flips both despite our edges being *weaker*.
test('PLUS: two equal edge-sums flip both enemies', () => {
  const board = makeBoard({ 3: [7, 1], 5: [25, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.plus, true);
  assert.equal(res.same, false);
  assert.deepEqual(flat(res).sort((a, b) => a - b), [3, 5]);
});

test('PLUS: differing sums do not fire, and weak edges take nothing', () => {
  // 🐀 (id 0, e:2) west -> sum 6;  👾 (id 25, w:5) east -> sum 9.
  const board = makeBoard({ 3: [0, 1], 5: [25, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.plus, false);
  assert.deepEqual(flat(res), [3]); // only the BASIC flip on 🐀 (4 > 2)
});

test('PLUS: a group of friendly-only cards does not fire', () => {
  const board = makeBoard({ 3: [7, 0], 5: [25, 0] }); // equal sums, both ours
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.plus, false);
  assert.deepEqual(flat(res), []);
});

test('SAME and PLUS both fire on a board that satisfies each', () => {
  // The Task 3 SAME fixture also has tied sums (4+4 and 4+4), so both rules
  // fire on the same placement. They are checked independently.
  const board = makeBoard({ 3: [13, 1], 5: [20, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, true);
  assert.equal(res.plus, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/rules.test.mjs`
Expected: FAIL — `res.plus` is hardcoded `false`, and the PLUS-only case flips nothing.

- [ ] **Step 3: Implement PLUS**

In `resolve`, insert this block between the SAME block and the BASIC block:

```js
        // PLUS — group contacts by (myEdge + theirEdge); any group with >=2
        // members and >=1 enemy flips all enemies in that group.
        let plus = false;
        const bySum = new Map();
        info.forEach(i => {
            const k = i.mine + i.theirs;
            if(!bySum.has(k)) bySum.set(k, []);
            bySum.get(k).push(i);
        });
        bySum.forEach(group => {
            if(group.length >= 2 && group.some(i => i.enemy)){
                plus = true;
                group.filter(i => i.enemy).forEach(i => { flipped.add(i.cell); seeds.add(i.cell); });
            }
        });
```

And change the return to `plus,` instead of `plus: false,`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: PASS — all 20 tests.

- [ ] **Step 5: Commit**

```bash
git add games/dau-truong-sinh-vat.html tests/rules.test.mjs
git commit -m "$(cat <<'EOF'
feat(sinh-vat): PLUS capture rule

Neighbours grouped by edge-sum; any group with two or more members and at
least one enemy flips every enemy in the group. Independent of SAME.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 5: COMBO cascade

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (ENGINE region)
- Modify: `tests/rules.test.mjs`

**Interfaces:**
- Consumes: `Rules.resolve` from Task 4.
- Produces: `resolve(...).waves` is `[[placement flips], [combo wave 1], [combo wave 2], ...]`, and `comboDepth === waves.length - 1`.

**Rule:** every card flipped by SAME or PLUS — **not** by BASIC — then attacks its own neighbours using the BASIC comparison. Anything it flips joins the next wave and attacks in turn. Breadth-first until a wave flips nothing. `waves[0]` bundles SAME/PLUS/BASIC flips together as an *animation grouping only*; the seed distinction is tracked internally via the `seeds` set.

- [ ] **Step 1: Write the failing tests**

Append to `tests/rules.test.mjs`:

```js
// Cell layout:  0 1 2
//               3 4 5
//               6 7 8
test('COMBO: a SAME-flipped card cascades into its own neighbour', () => {
  // Task 3's SAME fixture, plus a weak enemy below cell 3.
  // SAME flips cell 3 (🐢 id 13) and cell 5 (🐗 id 20).
  // The captured 🐢 at cell 3 has s:4, and cell 6 holds 🐀 (id 0, n:3) -> 4 > 3, combo.
  const board = makeBoard({ 3: [13, 1], 5: [20, 1], 6: [0, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, true);
  assert.deepEqual(res.waves[0].sort((a, b) => a - b), [3, 5]);
  assert.deepEqual(res.waves[1], [6]);
  assert.equal(res.comboDepth, 1);
});

test('COMBO: cards flipped by BASIC do not seed a cascade', () => {
  // Place 🐲 (id 28: n10 e6 s8 w4) at cell 4 — pure BASIC flip on cell 5.
  // Cell 5 = 🐀 (id 0, w:1) flips. Cell 8 below it holds a weak enemy 🐁 (id 1, n:1),
  // which the flipped 🐀 (id 0, s:4) would beat — but BASIC flips never combo.
  const board = makeBoard({ 5: [0, 1], 8: [1, 1] });
  const res = Rules.resolve(board, 4, 28, 0);
  assert.deepEqual(res.waves[0], [5]);
  assert.equal(res.waves.length, 1);
  assert.equal(res.comboDepth, 0);
});

test('COMBO: cascade runs multiple levels deep, one array per level', () => {
  // A deliberate three-wave chain:
  //   place 🐜 (id 11: s:3) at cell 4 -> SAME flips cell 3 (🐢 id 13) and cell 5 (🐗 id 20)
  //   captured 🐢 at cell 3 (s:4) beats cell 6 = 🐁 (id 1, n:1)   -> wave 1
  //   captured 🐁 at cell 6 (e:4) beats cell 7 = 🦇 (id 10, w:3)  -> wave 2
  //
  // Cell 7 is a DIRECT neighbour of the placement cell 4, so it must survive
  // wave 0 to be available for the cascade. 🦇 (id 10, n:7) is chosen so that
  // against our s:3 it is not a SAME tie (3 != 7), loses no BASIC comparison
  // (3 > 7 is false), and its PLUS sum (3+7=10) does not join the 8-group the
  // two SAME contacts form (4+4). Substituting a card that fails any of those
  // three conditions collapses the chain to two waves.
  const board = makeBoard({ 3: [13, 1], 5: [20, 1], 6: [1, 1], 7: [10, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.waves.length, 3);
  assert.deepEqual(res.waves[0].sort((a, b) => a - b), [3, 5]);
  assert.deepEqual(res.waves[1], [6]);
  assert.deepEqual(res.waves[2], [7]);
  assert.equal(res.comboDepth, 2);
});

test('COMBO: a card is never flipped twice in one resolution', () => {
  const board = makeBoard({ 3: [13, 1], 5: [20, 1], 6: [1, 1], 7: [10, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  const all = res.waves.flat();
  assert.equal(new Set(all).size, all.length);
});

test('PLUS: a three-member sum group flips every enemy in it', () => {
  // Same geometry, but cell 7 holds 🐛 (id 3, n:5): our s:3 + their n:5 = 8,
  // which joins the 8-sum group the two SAME contacts already form (4+4).
  // All three contacts share sum 8, so PLUS takes all three at once.
  const board = makeBoard({ 3: [13, 1], 5: [20, 1], 7: [3, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.plus, true);
  assert.deepEqual(res.waves[0].sort((a, b) => a - b), [3, 5, 7]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/rules.test.mjs`
Expected: FAIL — `res.waves.length` is always 1; `waves[1]` is `undefined`.

- [ ] **Step 3: Implement the cascade**

Replace the return statement of `resolve` with:

```js
        // Apply the placement and the first wave to a scratch board, then run
        // the COMBO cascade breadth-first from the SAME/PLUS seeds only.
        const sim = board.slice();
        sim[cellIdx] = {cardId, owner};
        flipped.forEach(c => { sim[c] = {cardId: sim[c].cardId, owner}; });

        const waves = [[...flipped]];
        let frontier = [...seeds];

        while(frontier.length){
            const next = [];
            frontier.forEach(src => {
                const attacker = CARDS[sim[src].cardId];
                neighborsOf(src).forEach(n => {
                    const occ = sim[n.cell];
                    if(!occ || occ.owner === owner) return;
                    if(attacker[n.dir] > CARDS[occ.cardId][OPPOSITE[n.dir]]){
                        sim[n.cell] = {cardId: occ.cardId, owner};
                        next.push(n.cell);
                    }
                });
            });
            if(next.length) waves.push(next);
            frontier = next;
        }

        return {waves, same, plus, comboDepth: waves.length - 1};
```

The `sim[n.cell].owner === owner` guard is what prevents a card being flipped twice: once flipped it belongs to `owner`, so no later attacker considers it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: PASS — all 24 tests.

- [ ] **Step 5: Commit**

```bash
git add games/dau-truong-sinh-vat.html tests/rules.test.mjs
git commit -m "$(cat <<'EOF'
feat(sinh-vat): COMBO cascade returned as ordered waves

Cards flipped by SAME or PLUS attack their own neighbours breadth-first,
one array per level. BASIC flips never seed a cascade.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 6: `Rules.score`, `Rules.legalCells`, `Deal.hands`

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (ENGINE region)
- Modify: `tests/rules.test.mjs`

**Interfaces:**
- Consumes: `CARDS`, `Rules` from Task 5.
- Produces:
  - `Rules.score(board, hands)` → `[s0, s1]`.
  - `Rules.legalCells(board)` → array of empty cell indices.
  - `Rules.winner(board, hands)` → `0 | 1 | null` (`null` = draw).
  - `Deal.hands(rng)` → `[[cardId × 5], [cardId × 5]]`. `rng` is a zero-arg function returning `[0,1)`, defaulting to `Math.random`.

- [ ] **Step 1: Write the failing tests**

Extend the destructure at the top of `tests/rules.test.mjs` to `load(['ENGINE'], ['CARDS', 'Rules', 'neighborsOf', 'Deal'])`, then append:

```js
// Deterministic RNG so deal/AI tests are reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('score counts owned board cards plus cards left in hand', () => {
  const board = makeBoard({ 0: [1, 0], 1: [2, 0], 2: [3, 1] });
  const hands = [[10, 11], [12, 13, 14]];
  assert.deepEqual(Rules.score(board, hands), [4, 4]);
});

test('scores always total 10 for a full board and empty hands', () => {
  const board = Array.from({ length: 9 }, (_, i) => ({ cardId: i, owner: i % 2 }));
  const [a, b] = Rules.score(board, [[], [29]]);
  assert.equal(a + b, 10);
});

test('winner returns the higher scorer and null on a 5-5 draw', () => {
  const draw = Array.from({ length: 9 }, (_, i) => ({ cardId: i, owner: i < 5 ? 0 : 1 }));
  assert.equal(Rules.winner(draw, [[], [29]]), null); // 5 vs 4+1 = 5
  const win = Array.from({ length: 9 }, (_, i) => ({ cardId: i, owner: i < 6 ? 0 : 1 }));
  assert.equal(Rules.winner(win, [[], [29]]), 0);     // 6 vs 3+1 = 4
});

test('legalCells lists only empty cells', () => {
  const board = makeBoard({ 0: [1, 0], 4: [2, 1] });
  assert.deepEqual(Rules.legalCells(board), [1, 2, 3, 5, 6, 7, 8]);
});

test('deal gives each side 2 common, 2 uncommon, 1 rare', () => {
  const rng = seeded(42);
  for (let i = 0; i < 50; i++) {
    const hands = Deal.hands(rng);
    for (const hand of hands) {
      assert.equal(hand.length, 5);
      const by = r => hand.filter(id => CARDS[id].r === r).length;
      assert.equal(by('common'), 2);
      assert.equal(by('uncommon'), 2);
      assert.equal(by('rare'), 1);
    }
  }
});

test('deal never gives the same card to both sides', () => {
  const rng = seeded(7);
  for (let i = 0; i < 50; i++) {
    const [a, b] = Deal.hands(rng);
    assert.equal(new Set([...a, ...b]).size, 10);
  }
});

test('deal is varied across seeds', () => {
  const seen = new Set();
  const rng = seeded(99);
  for (let i = 0; i < 20; i++) seen.add(Deal.hands(rng)[0].join(','));
  assert.ok(seen.size > 10, `deal too repetitive: only ${seen.size} distinct hands in 20`);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/rules.test.mjs`
Expected: FAIL — `Rules.score is not a function`, `Deal is not defined`.

- [ ] **Step 3: Implement scoring, legal cells and dealing**

Add to the `Rules` IIFE (and update its return to `{resolve, score, legalCells, winner}`):

```js
    function score(board, hands){
        const s = [0, 0];
        board.forEach(c => { if(c) s[c.owner]++; });
        s[0] += hands[0].length;
        s[1] += hands[1].length;
        return s;
    }

    function legalCells(board){
        const out = [];
        board.forEach((c, i) => { if(!c) out.push(i); });
        return out;
    }

    function winner(board, hands){
        const [a, b] = score(board, hands);
        if(a === b) return null;
        return a > b ? 0 : 1;
    }
```

Then add the `Deal` module after `Rules` in the ENGINE region:

```js
const Deal = (()=>{
    function shuffle(arr, rng){
        const a = arr.slice();
        for(let i = a.length - 1; i > 0; i--){
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Both sides get 2 common + 2 uncommon + 1 rare, drawn without replacement
    // from the shared roster, so hands are varied but never lopsided.
    function hands(rng = Math.random){
        const pool = r => shuffle(CARDS.filter(c => c.r === r).map(c => c.id), rng);
        const c = pool('common'), u = pool('uncommon'), x = pool('rare');
        return [
            [c[0], c[1], u[0], u[1], x[0]],
            [c[2], c[3], u[2], u[3], x[1]]
        ];
    }

    return {hands, shuffle};
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: PASS — all 31 tests.

- [ ] **Step 5: Commit**

```bash
git add games/dau-truong-sinh-vat.html tests/rules.test.mjs
git commit -m "$(cat <<'EOF'
feat(sinh-vat): scoring, legal cells and balanced dealing

score() sums owned board cards plus cards in hand and always totals 10.
Deal.hands gives each side 2 common + 2 uncommon + 1 rare, no duplicates.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 7: AI opponent

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (new AI region)
- Create: `tests/ai.test.mjs`

**Interfaces:**
- Consumes: `CARDS`, `Rules`, `neighborsOf` from the ENGINE region.
- Produces: `AI.pick(board, hands, me, difficulty, rng)` → `{cardId, cellIdx}`. `difficulty` ∈ `'easy'|'normal'|'hard'`. `rng` defaults to `Math.random`. Pure — no DOM, no mutation.

Because both hands are face-up, lookahead uses only information the human also sees.

- [ ] **Step 1: Write the failing tests**

Create `tests/ai.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';

const { CARDS, Rules, Deal, AI } = load(
  ['ENGINE', 'AI'],
  ['CARDS', 'Rules', 'Deal', 'AI']
);

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeBoard(spec) {
  const b = Array(9).fill(null);
  for (const [idx, [cardId, owner]] of Object.entries(spec)) {
    b[Number(idx)] = { cardId, owner };
  }
  return b;
}

// Play one full match and return final scores.
function playMatch(diffA, diffB, rng) {
  const hands = Deal.hands(rng);
  const board = Array(9).fill(null);
  let turn = rng() < 0.5 ? 0 : 1;
  while (Rules.legalCells(board).length) {
    const diff = turn === 0 ? diffA : diffB;
    const mv = AI.pick(board, hands, turn, diff, rng);
    const res = Rules.resolve(board, mv.cellIdx, mv.cardId, turn);
    board[mv.cellIdx] = { cardId: mv.cardId, owner: turn };
    res.waves.flat().forEach(c => { board[c].owner = turn; });
    hands[turn].splice(hands[turn].indexOf(mv.cardId), 1);
    turn = 1 - turn;
  }
  return Rules.score(board, hands);
}

for (const diff of ['easy', 'normal', 'hard']) {
  test(`${diff} AI always returns a legal move`, () => {
    const rng = seeded(1);
    for (let i = 0; i < 100; i++) {
      const hands = Deal.hands(rng);
      const board = makeBoard({ 4: [hands[1][0], 1] });
      hands[1].shift();
      const mv = AI.pick(board, hands, 0, diff, rng);
      assert.ok(hands[0].includes(mv.cardId), `${diff} played a card not in hand`);
      assert.ok(Rules.legalCells(board).includes(mv.cellIdx), `${diff} played on a taken cell`);
    }
  });
}

test('normal AI takes an available capture', () => {
  // Enemy 🐀 (id 0, w:1) sits at cell 4. Hand holds 🐲 (id 28, e:6), which
  // flips it from cell 3. A greedy AI must find that.
  const board = makeBoard({ 4: [0, 1] });
  const hands = [[28, 1, 2, 3, 5], [29]];
  const mv = AI.pick(board, hands, 0, 'normal', seeded(3));
  const res = Rules.resolve(board, mv.cellIdx, mv.cardId, 0);
  assert.ok(res.waves.flat().length >= 1, 'normal AI passed up a free capture');
});

test('hard beats normal over a run of matches', () => {
  const rng = seeded(2026);
  let hardWins = 0, normalWins = 0;
  for (let i = 0; i < 60; i++) {
    const [a, b] = playMatch('hard', 'normal', rng);
    if (a > b) hardWins++;
    else if (b > a) normalWins++;
  }
  assert.ok(hardWins > normalWins, `hard ${hardWins} vs normal ${normalWins}`);
});

test('normal beats easy over a run of matches', () => {
  const rng = seeded(1234);
  let normalWins = 0, easyWins = 0;
  for (let i = 0; i < 60; i++) {
    const [a, b] = playMatch('normal', 'easy', rng);
    if (a > b) normalWins++;
    else if (b > a) easyWins++;
  }
  assert.ok(normalWins > easyWins, `normal ${normalWins} vs easy ${easyWins}`);
});

test('AI.pick does not mutate the board or hands', () => {
  const board = makeBoard({ 4: [0, 1] });
  const hands = [[28, 1, 2, 3, 5], [29]];
  const snap = JSON.stringify({ board, hands });
  AI.pick(board, hands, 0, 'hard', seeded(9));
  assert.equal(JSON.stringify({ board, hands }), snap);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/ai.test.mjs`
Expected: FAIL — `Marker AI not found in .../dau-truong-sinh-vat.html`.

- [ ] **Step 3: Implement the AI**

Add a new region to `games/dau-truong-sinh-vat.html`, immediately after `/* ==== ENGINE:END ==== */`:

```js
/* ==== AI:START ==== */
const AI = (()=>{
    const sum = c => c.n + c.e + c.s + c.w;

    // How exposed a card is once placed: the total of edges that face an
    // empty in-board cell, i.e. the edges an opponent could attack next.
    // Higher is safer, because a high edge is harder to beat.
    function safety(board, cellIdx, cardId){
        const card = CARDS[cardId];
        return neighborsOf(cellIdx)
            .filter(n => !board[n.cell])
            .reduce((a, n) => a + card[n.dir], 0);
    }

    function allMoves(board, hand){
        const cells = Rules.legalCells(board);
        const out = [];
        hand.forEach(cardId => cells.forEach(cellIdx => out.push({cardId, cellIdx})));
        return out;
    }

    function flipsFor(board, mv, me){
        return Rules.resolve(board, mv.cellIdx, mv.cardId, me).waves
            .reduce((a, w) => a + w.length, 0);
    }

    // Greedy: most flips, then spend the weaker card, then sit safest.
    function scoreGreedy(board, mv, me){
        return [
            flipsFor(board, mv, me),
            -sum(CARDS[mv.cardId]),
            safety(board, mv.cellIdx, mv.cardId)
        ];
    }

    function better(a, b){
        for(let i = 0; i < a.length; i++){
            if(a[i] !== b[i]) return a[i] > b[i];
        }
        return false;
    }

    function bestGreedy(board, hand, me){
        let best = null, bestKey = null;
        allMoves(board, hand).forEach(mv => {
            const key = scoreGreedy(board, mv, me);
            if(!best || better(key, bestKey)){ best = mv; bestKey = key; }
        });
        return {move: best, key: bestKey};
    }

    // Apply a move to copies, leaving the caller's state untouched.
    function applied(board, hands, mv, me){
        const res = Rules.resolve(board, mv.cellIdx, mv.cardId, me);
        const nb = board.slice();
        nb[mv.cellIdx] = {cardId: mv.cardId, owner: me};
        res.waves.flat().forEach(c => { nb[c] = {cardId: nb[c].cardId, owner: me}; });
        const nh = [hands[0].slice(), hands[1].slice()];
        nh[me].splice(nh[me].indexOf(mv.cardId), 1);
        return {board: nb, hands: nh, flips: res.waves.flat().length};
    }

    function pick(board, hands, me, difficulty, rng = Math.random){
        const moves = allMoves(board, hands[me]);
        if(!moves.length) return null;

        if(difficulty === 'easy'){
            if(rng() < 0.2) return bestGreedy(board, hands[me], me).move;
            return moves[Math.floor(rng() * moves.length)];
        }

        if(difficulty === 'normal'){
            return bestGreedy(board, hands[me], me).move;
        }

        // hard — 1-ply: assume the opponent replies with their best greedy move.
        const foe = 1 - me;
        let best = null, bestKey = null;
        moves.forEach(mv => {
            const after = applied(board, hands, mv, me);
            let reply = 0;
            if(after.hands[foe].length && Rules.legalCells(after.board).length){
                const r = bestGreedy(after.board, after.hands[foe], foe);
                reply = r.key ? r.key[0] : 0;
            }
            const key = [
                after.flips - reply,
                -sum(CARDS[mv.cardId]),
                safety(board, mv.cellIdx, mv.cardId)
            ];
            if(!best || better(key, bestKey)){ best = mv; bestKey = key; }
        });
        return best;
    }

    return {pick};
})();
/* ==== AI:END ==== */
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: PASS — all 38 tests.

If `hard beats normal` fails, the eval is wrong — **do not tune the seed to make it pass.** The likely fix is that raw flip counts are too blunt a currency: switch the `hard` objective from `after.flips - reply` to a true board-score delta, i.e. compare `Rules.score(after.board, after.hands)[me]` against the score after the opponent's best reply. Re-run and confirm before moving on.

- [ ] **Step 5: Commit**

```bash
git add games/dau-truong-sinh-vat.html tests/ai.test.mjs
git commit -m "$(cat <<'EOF'
feat(sinh-vat): three-difficulty AI over the pure rules engine

Easy random with a greedy streak, Normal greedy on flips with card-value
and safety tie-breaks, Hard 1-ply against the opponent's best greedy reply.
Verified by head-to-head match runs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 8: Neon-lab shell, board and card rendering

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (`<style>`, body markup, render layer)

**Interfaces:**
- Consumes: `CARDS`, `Rules`, `Deal` from the ENGINE region.
- Produces: `state` object; `cardFace(cardId, owner)` → card `HTMLElement`; `renderBoard()`, `renderHands()`, `renderStatus()`; `edgeLabel(v)` → `String(v)` or `'A'` when `v === 10`.

Verification for this task and Tasks 9–11 is the syntax gate plus a browser playtest — these tasks touch the DOM, which the Node harness deliberately cannot load.

- [ ] **Step 1: Replace the `<style>` block**

```css
*{box-sizing:border-box}
:root{
    --void:#07040f;
    --panel:rgba(14,10,30,.72);
    --cyan:#22d3ee;
    --magenta:#f472d0;
    --rim-common:#7c8798;
    --rim-uncommon:#34d399;
    --rim-rare:#fbbf24;
    --card: clamp(64px, min(calc((100vh - 260px)/3), calc((100vw - 460px)/3)), 128px);
}
body{
    margin:0;min-height:100vh;overflow-x:hidden;
    font-family:'Segoe UI',system-ui,sans-serif;
    color:#e8f6ff;
    background:
      radial-gradient(circle at 18% 12%, rgba(34,211,238,.16), transparent 34%),
      radial-gradient(circle at 84% 20%, rgba(244,114,208,.14), transparent 32%),
      radial-gradient(circle at 50% 96%, rgba(126,58,242,.16), transparent 44%),
      linear-gradient(180deg,#07040f 0%,#0d0722 55%,#07040f 100%);
}
/* scanlines + vignette */
body::before{
    content:'';position:fixed;inset:0;z-index:0;pointer-events:none;
    background:repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px);
    mix-blend-mode:overlay;
}
body::after{
    content:'';position:fixed;inset:0;z-index:0;pointer-events:none;
    background:radial-gradient(circle at 50% 45%, transparent 45%, rgba(0,0,0,.65) 100%);
}
.container{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px}
.header{display:flex;align-items:center;justify-content:space-between;width:min(1120px,100%);gap:16px;flex-wrap:wrap}
.title{
    display:flex;align-items:center;gap:12px;padding:8px 18px;border-radius:18px;
    background:linear-gradient(135deg,rgba(34,211,238,.18),rgba(244,114,208,.14));
    border:1px solid rgba(34,211,238,.45);
    box-shadow:0 0 28px rgba(34,211,238,.28), inset 0 1px 0 rgba(255,255,255,.12);
}
.title h1{
    margin:0;font-size:clamp(19px,2.6vw,30px);font-weight:900;letter-spacing:2px;
    color:#d8fbff;text-shadow:0 0 14px rgba(34,211,238,.8);
}
.controls{display:flex;gap:10px;flex-wrap:wrap}
.btn{
    border:1px solid rgba(255,255,255,.18);cursor:pointer;
    padding:9px 14px;border-radius:12px;font-weight:800;font-size:14px;color:#e8f6ff;
    background:rgba(255,255,255,.07);
    transition:transform .16s, box-shadow .16s, background .16s;
}
.btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.14);box-shadow:0 0 18px rgba(34,211,238,.35)}
.btn:active{transform:translateY(0)}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.btn-primary{background:linear-gradient(135deg,#22d3ee,#7c3aed);border-color:transparent;color:#06121a}
.main{
    width:min(1120px,100%);display:grid;
    grid-template-columns:minmax(120px,1fr) auto minmax(120px,1fr);
    gap:16px;align-items:center;justify-items:center;
}
/* ---- hands ---- */
.hand{display:flex;flex-direction:column;gap:8px;align-items:center}
.hand-label{
    font-size:13px;font-weight:900;letter-spacing:1px;padding:5px 12px;border-radius:10px;
    background:var(--panel);border:1px solid rgba(255,255,255,.14);
}
.hand.p0 .hand-label{color:var(--cyan);border-color:rgba(34,211,238,.5)}
.hand.p1 .hand-label{color:var(--magenta);border-color:rgba(244,114,208,.5)}
/* ---- card ---- */
.card{
    position:relative;width:var(--card);height:var(--card);border-radius:12px;
    display:flex;align-items:center;justify-content:center;
    font-size:calc(var(--card)*.42);
    border:2px solid var(--rim);
    background:linear-gradient(160deg,var(--fill-a),var(--fill-b));
    box-shadow:0 8px 20px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.16);
    user-select:none;transition:transform .18s, box-shadow .18s;
    transform-style:preserve-3d;
}
.card.own0{--fill-a:rgba(34,211,238,.34);--fill-b:rgba(8,47,73,.92)}
.card.own1{--fill-a:rgba(244,114,208,.34);--fill-b:rgba(74,10,58,.92)}
.card.common{--rim:var(--rim-common)}
.card.uncommon{--rim:var(--rim-uncommon)}
.card.rare{--rim:var(--rim-rare);box-shadow:0 8px 20px rgba(0,0,0,.5), 0 0 16px rgba(251,191,36,.4)}
/* holographic sheen */
.card::after{
    content:'';position:absolute;inset:0;border-radius:10px;pointer-events:none;
    background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.22) 50%,transparent 62%);
    opacity:0;transition:opacity .25s;
}
.card:hover::after{opacity:1}
.card .edge{
    position:absolute;font-size:calc(var(--card)*.17);font-weight:900;line-height:1;
    color:#fff;text-shadow:0 0 6px rgba(0,0,0,.95),0 1px 2px rgba(0,0,0,.9);
}
.card .edge.n{top:5%;left:50%;transform:translateX(-50%)}
.card .edge.s{bottom:5%;left:50%;transform:translateX(-50%)}
.card .edge.w{left:6%;top:50%;transform:translateY(-50%)}
.card .edge.e{right:6%;top:50%;transform:translateY(-50%)}
.card.selectable{cursor:pointer}
.card.selectable:hover{transform:translateY(-6px);box-shadow:0 14px 30px rgba(0,0,0,.6),0 0 22px rgba(34,211,238,.5)}
.card.selected{transform:translateY(-10px) scale(1.04);box-shadow:0 0 0 3px #fff,0 16px 34px rgba(0,0,0,.6)}
.card.spent{opacity:.22;filter:grayscale(1);pointer-events:none}
/* ---- board ---- */
.board-frame{
    padding:12px;border-radius:20px;
    background:linear-gradient(150deg,rgba(34,211,238,.10),rgba(124,58,242,.12));
    border:1px solid rgba(34,211,238,.34);
    box-shadow:0 24px 60px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.10);
}
.board{display:grid;grid-template-columns:repeat(3,var(--card));grid-template-rows:repeat(3,var(--card));gap:6px}
.slot{
    position:relative;width:var(--card);height:var(--card);border-radius:12px;
    border:1px dashed rgba(34,211,238,.28);
    background:radial-gradient(circle at 50% 50%, rgba(34,211,238,.08), rgba(7,4,15,.5));
}
.slot.open{cursor:pointer;border-style:solid;border-color:rgba(34,211,238,.75);box-shadow:inset 0 0 20px rgba(34,211,238,.28)}
.slot.open:hover{box-shadow:inset 0 0 30px rgba(34,211,238,.55),0 0 22px rgba(34,211,238,.45)}
.slot .card{position:absolute;inset:0;width:100%;height:100%}
/* ghost preview of cards that would flip */
.card.doomed{outline:3px solid #fff;outline-offset:-3px;animation:doomPulse .7s ease-in-out infinite}
@keyframes doomPulse{0%,100%{outline-color:rgba(255,255,255,.35)}50%{outline-color:rgba(255,255,255,1)}}
/* ---- status ---- */
.statusbar{display:flex;flex-direction:column;align-items:center;gap:8px;width:min(1120px,100%)}
.status{
    display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;
    height:56px;width:min(440px,100%);padding:8px 16px;border-radius:14px;
    background:var(--panel);border:2px solid var(--turnColor,rgba(255,255,255,.2));
    box-shadow:0 0 22px rgba(0,0,0,.5);transition:border-color .3s;overflow:hidden;
}
.status .st-turn{font-size:15px;font-weight:900}
.status .st-sub{font-size:12px;opacity:.82}
.score{
    display:flex;align-items:center;justify-content:center;gap:16px;
    height:52px;padding:8px 22px;border-radius:14px;
    background:var(--panel);border:1px solid rgba(255,255,255,.14);
}
.score .sc{font-size:26px;font-weight:900;line-height:1}
.score .sc.p0{color:var(--cyan);text-shadow:0 0 14px rgba(34,211,238,.7)}
.score .sc.p1{color:var(--magenta);text-shadow:0 0 14px rgba(244,114,208,.7)}
.score .dash{opacity:.4;font-size:20px}
@media (max-width:900px){
    :root{--card:clamp(56px, calc((100vw - 60px)/3), 96px)}
    .main{grid-template-columns:1fr;gap:10px}
    .hand{flex-direction:row;flex-wrap:wrap;justify-content:center}
    .hand.p1{order:-1}
}
```

- [ ] **Step 2: Replace the body markup**

```html
<div class="container">
    <div class="header">
        <div class="title"><span style="font-size:30px">🧪</span><h1>ĐẤU TRƯỜNG SINH VẬT</h1></div>
        <div class="controls">
            <button class="btn" id="soundBtn">🔊 Âm thanh</button>
            <button class="btn" id="rulesBtn">📖 Luật chơi</button>
            <button class="btn btn-primary" id="restartBtn">🔄 Ván mới</button>
        </div>
    </div>

    <div class="statusbar">
        <div class="status" id="status">
            <span class="st-turn">Lượt: BẠN</span>
            <span class="st-sub">chọn một lá bài</span>
        </div>
        <div class="score">
            <span class="sc p0" id="score0">5</span>
            <span class="dash">—</span>
            <span class="sc p1" id="score1">5</span>
        </div>
    </div>

    <div class="main">
        <div class="hand p0" id="hand0"><div class="hand-label">🟦 BẠN</div></div>
        <div class="board-frame"><div class="board" id="board"></div></div>
        <div class="hand p1" id="hand1"><div class="hand-label">🟥 ĐỐI THỦ</div></div>
    </div>
</div>
```

- [ ] **Step 3: Add state and rendering below the AI region**

```js
/* ── STATE ── */
const state = {
    board: Array(9).fill(null),
    hands: [[], []],
    turn: 0,
    mode: 'ai',            // 'ai' | 'hotseat'
    difficulty: 'normal',
    selected: null,        // cardId currently picked up
    busy: false,
    gameOver: false
};

const boardEl  = document.getElementById('board');
const statusEl = document.getElementById('status');

const edgeLabel = v => v === 10 ? 'A' : String(v);

function cardFace(cardId, owner){
    const c = CARDS[cardId];
    const el = document.createElement('div');
    el.className = `card ${c.r} own${owner}`;
    el.dataset.cardId = cardId;
    el.title = c.name;
    el.innerHTML =
        `<span class="edge n">${edgeLabel(c.n)}</span>` +
        `<span class="edge e">${edgeLabel(c.e)}</span>` +
        `<span class="edge s">${edgeLabel(c.s)}</span>` +
        `<span class="edge w">${edgeLabel(c.w)}</span>` +
        `<span class="emoji">${c.emoji}</span>`;
    return el;
}

function renderBoard(){
    boardEl.innerHTML = '';
    for(let i = 0; i < 9; i++){
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.cell = i;
        const occ = state.board[i];
        if(occ) slot.appendChild(cardFace(occ.cardId, occ.owner));
        boardEl.appendChild(slot);
    }
}

function renderHands(){
    [0, 1].forEach(p => {
        const wrap = document.getElementById('hand' + p);
        wrap.querySelectorAll('.card').forEach(el => el.remove());
        state.hands[p].forEach(cardId => {
            const el = cardFace(cardId, p);
            el.dataset.owner = p;
            wrap.appendChild(el);
        });
    });
}

function renderStatus(){
    const [s0, s1] = Rules.score(state.board, state.hands);
    document.getElementById('score0').textContent = s0;
    document.getElementById('score1').textContent = s1;

    const mine = state.turn === 0;
    const colour = mine ? 'var(--cyan)' : 'var(--magenta)';
    statusEl.style.setProperty('--turnColor', colour);

    let turnText, subText;
    if(state.gameOver){
        turnText = 'Ván đấu kết thúc';
        subText  = '🏁';
    }else if(state.mode === 'ai' && !mine){
        turnText = 'Lượt: ĐỐI THỦ';
        subText  = 'đang suy nghĩ…';
    }else{
        turnText = state.mode === 'hotseat'
            ? (mine ? 'Lượt: NGƯỜI 1' : 'Lượt: NGƯỜI 2')
            : 'Lượt: BẠN';
        subText = state.selected === null ? 'chọn một lá bài' : 'chọn một ô trống';
    }
    statusEl.querySelector('.st-turn').textContent = turnText;
    statusEl.querySelector('.st-sub').textContent = subText;
}

function newMatch(){
    state.board = Array(9).fill(null);
    state.hands = Deal.hands();
    state.turn = Math.random() < 0.5 ? 0 : 1;
    state.selected = null;
    state.busy = false;
    state.gameOver = false;
    renderBoard();
    renderHands();
    renderStatus();
}

newMatch();
```

- [ ] **Step 4: Verify**

Run: `node --test tests/`
Expected: PASS — 38 tests, including the syntax gate on the now much larger script.

Then open `games/dau-truong-sinh-vat.html` in a browser and confirm: 3×3 empty board renders, five face-up cards per side, each card shows its emoji and four edge numbers with `A` for 10, rarity rims are visibly slate/green/amber, cyan and magenta fills differ clearly, and the score reads `5 — 5`.

- [ ] **Step 5: Commit**

```bash
git add games/dau-truong-sinh-vat.html
git commit -m "$(cat <<'EOF'
feat(sinh-vat): neon-lab shell, board and card rendering

Scanline/vignette backdrop, 3x3 glass board, card faces with N/E/S/W edge
values (A for 10), rarity rims and ownership fills as separate channels.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 9: Selection, hover preview and placement

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (interaction layer)

**Interfaces:**
- Consumes: `state`, `renderBoard`, `renderHands`, `renderStatus`, `Rules`, `AI`.
- Produces: `selectCard(cardId)`, `clearPreview()`, `previewAt(cellIdx)`, `markOpenSlots()`, `commitMove(cellIdx)`, `applyWaves(waves, owner)`, `endTurn()`, `aiTurn()`, `isHumanTurn()`. Calls `playWaves(res, owner, cellIdx, done)`, stubbed here and implemented in Task 10.

The hover preview is the feature that teaches SAME/PLUS/COMBO: it calls the same `Rules.resolve` the real move will use and outlines exactly the cards that would flip.

- [ ] **Step 1: Add the interaction layer below the render layer**

```js
/* ── INTERACTION ── */
function isHumanTurn(){
    if(state.gameOver || state.busy) return false;
    return state.mode === 'hotseat' || state.turn === 0;
}

function clearPreview(){
    boardEl.querySelectorAll('.card.doomed').forEach(el => el.classList.remove('doomed'));
}

function previewAt(cellIdx){
    clearPreview();
    if(state.selected === null || state.board[cellIdx]) return;
    const res = Rules.resolve(state.board, cellIdx, state.selected, state.turn);
    res.waves.flat().forEach(cell => {
        const el = boardEl.querySelector(`[data-cell="${cell}"] .card`);
        if(el) el.classList.add('doomed');
    });
}

function markOpenSlots(){
    boardEl.querySelectorAll('.slot').forEach(slot => {
        const empty = !state.board[Number(slot.dataset.cell)];
        slot.classList.toggle('open', empty && state.selected !== null && isHumanTurn());
    });
}

function selectCard(cardId){
    if(!isHumanTurn()) return;
    if(!state.hands[state.turn].includes(cardId)) return;
    state.selected = state.selected === cardId ? null : cardId;
    document.querySelectorAll('.hand .card').forEach(el => {
        el.classList.toggle('selected', Number(el.dataset.cardId) === state.selected);
    });
    clearPreview();
    markOpenSlots();
    renderStatus();
}

function applyWaves(waves, owner){
    waves.flat().forEach(cell => { state.board[cell].owner = owner; });
}

function commitMove(cellIdx){
    const cardId = state.selected;
    const owner = state.turn;
    state.busy = true;
    state.selected = null;
    clearPreview();

    const res = Rules.resolve(state.board, cellIdx, cardId, owner);
    state.board[cellIdx] = {cardId, owner};
    state.hands[owner].splice(state.hands[owner].indexOf(cardId), 1);

    renderBoard();
    renderHands();

    playWaves(res, owner, cellIdx, () => {
        applyWaves(res.waves, owner);
        renderBoard();
        renderStatus();
        state.busy = false;
        endTurn();
    });
}

function endTurn(){
    if(!Rules.legalCells(state.board).length){
        finishMatch();
        return;
    }
    state.turn = 1 - state.turn;
    markOpenSlots();
    renderStatus();
    if(state.mode === 'ai' && state.turn === 1) aiTurn();
}

function aiTurn(){
    state.busy = true;
    renderStatus();
    setTimeout(() => {
        const mv = AI.pick(state.board, state.hands, 1, state.difficulty);
        state.busy = false;
        state.selected = mv.cardId;
        state.turn = 1;
        commitMove(mv.cellIdx);
    }, 620);
}

boardEl.addEventListener('click', e => {
    const slot = e.target.closest('.slot');
    if(!slot || !isHumanTurn() || state.selected === null) return;
    const cell = Number(slot.dataset.cell);
    if(state.board[cell]) return;
    commitMove(cell);
});

boardEl.addEventListener('mouseover', e => {
    const slot = e.target.closest('.slot');
    if(!slot || !isHumanTurn()) return;
    previewAt(Number(slot.dataset.cell));
});
boardEl.addEventListener('mouseleave', clearPreview);

document.addEventListener('click', e => {
    const card = e.target.closest('.hand .card');
    if(!card) return;
    if(Number(card.dataset.owner) !== state.turn) return;
    selectCard(Number(card.dataset.cardId));
});
```

- [ ] **Step 2: Add a temporary `playWaves` and `finishMatch` so the file runs**

Task 10 replaces `playWaves` with the animated version. For now:

```js
/* ── ANIMATION (placeholder, replaced in Task 10) ── */
function playWaves(res, owner, cellIdx, done){ done(); }

function finishMatch(){
    state.gameOver = true;
    state.selected = null;
    markOpenSlots();
    renderStatus();
}
```

- [ ] **Step 3: Update `newMatch` to hand the first turn to the AI when it wins the coin flip**

Append to the end of `newMatch()`, before its closing brace:

```js
    markOpenSlots();
    if(state.mode === 'ai' && state.turn === 1) aiTurn();
```

- [ ] **Step 4: Verify**

Run: `node --test tests/`
Expected: PASS — 38 tests.

Then playtest in a browser: click one of your cards (it lifts, empty slots light up), hover an empty slot (enemy cards that would flip get a white outline), click to place. Confirm the AI answers within ~0.6s, the score updates after every placement, cards cannot be played on an occupied slot, and clicking a selected card again deselects it.

- [ ] **Step 5: Commit**

```bash
git add games/dau-truong-sinh-vat.html
git commit -m "$(cat <<'EOF'
feat(sinh-vat): card selection, flip preview and turn loop

Hovering an empty slot outlines exactly which enemy cards would flip, using
the same Rules.resolve the real move runs. AI replies on its own turn.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 10: Flip animation, combo callouts and effects

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (`<style>` and animation layer)

**Interfaces:**
- Consumes: `state`, `boardEl`, `cardFace`, `renderBoard`.
- Produces: `playWaves(res, owner, cellIdx, done)` — replaces the Task 9 placeholder; calls `done()` after the final wave settles. `callout(text, kind)`, `shakeBoard()`, `confettiBurst()`.

`state.busy` stays `true` for the whole cascade, so no input or AI turn can start mid-animation.

- [ ] **Step 1: Add the animation CSS**

Append to the `<style>` block:

```css
.card.flipping{animation:cardFlip .38s ease-in-out}
@keyframes cardFlip{
    0%{transform:rotateY(0) scale(1)}
    50%{transform:rotateY(90deg) scale(1.14)}
    100%{transform:rotateY(0) scale(1)}
}
.card.landing{animation:cardLand .32s cubic-bezier(.2,.9,.2,1.3)}
@keyframes cardLand{
    0%{transform:scale(1.5) translateY(-18px);opacity:0}
    100%{transform:scale(1) translateY(0);opacity:1}
}
.callout{
    position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);
    z-index:1600;pointer-events:none;
    font-size:clamp(30px,6vw,64px);font-weight:900;letter-spacing:3px;
    animation:calloutPop .95s cubic-bezier(.2,.9,.2,1.2) forwards;
}
.callout.same{color:#22d3ee;text-shadow:0 0 26px rgba(34,211,238,.95)}
.callout.plus{color:#a78bfa;text-shadow:0 0 26px rgba(167,139,250,.95)}
.callout.combo{color:#fbbf24;text-shadow:0 0 26px rgba(251,191,36,.95)}
@keyframes calloutPop{
    0%{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(-8deg)}
    35%{opacity:1;transform:translate(-50%,-50%) scale(1.18) rotate(2deg)}
    75%{opacity:1;transform:translate(-50%,-50%) scale(1)}
    100%{opacity:0;transform:translate(-50%,-58%) scale(.94)}
}
.board-frame.shake{animation:frameShake .48s cubic-bezier(.36,.07,.19,.97)}
@keyframes frameShake{
    15%{transform:translate(-7px,3px) rotate(-.7deg)}
    35%{transform:translate(7px,-3px) rotate(.7deg)}
    60%{transform:translate(-5px,-2px) rotate(-.5deg)}
    100%{transform:translate(0,0)}
}
.confetti{position:fixed;top:-20px;z-index:2500;pointer-events:none;width:9px;height:14px;border-radius:2px;animation:confettiFall var(--dur,2.6s) linear forwards}
@keyframes confettiFall{
    0%{opacity:1;transform:translateY(0) rotate(0)}
    100%{opacity:.85;transform:translateY(106vh) rotate(760deg)}
}
```

- [ ] **Step 2: Replace the placeholder `playWaves`**

```js
/* ── ANIMATION ── */
const WAVE_MS = 380;

function callout(text, kind){
    const el = document.createElement('div');
    el.className = 'callout ' + kind;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function shakeBoard(){
    const frame = document.querySelector('.board-frame');
    frame.classList.remove('shake');
    void frame.offsetWidth;
    frame.classList.add('shake');
    setTimeout(() => frame.classList.remove('shake'), 500);
}

// Flip one wave: swap each card's owner class and run the flip keyframe.
function flipWave(cells, owner){
    cells.forEach(cell => {
        const el = boardEl.querySelector(`[data-cell="${cell}"] .card`);
        if(!el) return;
        el.classList.remove('flipping');
        void el.offsetWidth;
        el.classList.add('flipping');
        // swap the fill halfway through, while the card is edge-on
        setTimeout(() => {
            el.classList.remove('own0', 'own1');
            el.classList.add('own' + owner);
        }, WAVE_MS / 2);
    });
}

function playWaves(res, owner, cellIdx, done){
    const placed = boardEl.querySelector(`[data-cell="${cellIdx}"] .card`);
    if(placed) placed.classList.add('landing');
    Sound.place();

    if(res.same) callout('SAME!', 'same');
    if(res.plus) setTimeout(() => callout('PLUS!', 'plus'), res.same ? 260 : 0);

    let t = 240;
    res.waves.forEach((cells, i) => {
        if(!cells.length) return;
        setTimeout(() => {
            flipWave(cells, owner);
            Sound.flip(i);
            if(i > 0) callout(`COMBO ×${i + 1}`, 'combo');
        }, t);
        t += WAVE_MS;
    });

    if(res.comboDepth >= 2) setTimeout(shakeBoard, 240 + WAVE_MS);
    setTimeout(done, t + 120);
}
```

- [ ] **Step 3: Add the confetti burst used by the win overlay in Task 11**

```js
function confettiBurst(){
    const cols = ['#22d3ee','#f472d0','#fbbf24','#a78bfa','#34d399','#ffffff'];
    for(let i = 0; i < 110; i++){
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.background = cols[Math.floor(Math.random() * cols.length)];
        c.style.setProperty('--dur', (2 + Math.random() * 2).toFixed(2) + 's');
        c.style.animationDelay = (Math.random() * .7).toFixed(2) + 's';
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4600);
    }
}
```

- [ ] **Step 4: Verify**

Run: `node --test tests/`
Expected: PASS — 38 tests. (`Sound` does not exist yet; Task 11 adds it. If the browser console shows `Sound is not defined` during this task's playtest, that is expected and resolved by Task 11 — the syntax gate still passes because the reference is only evaluated at call time.)

Playtest: place a card that captures. Confirm the flip reads as a 3D rotation with the colour swapping edge-on, that a SAME or PLUS capture shows its callout, that a combo shows `COMBO ×2` on the second wave, and that the board shakes on a 3-deep chain. Confirm you cannot click anything until the cascade finishes.

- [ ] **Step 5: Commit**

```bash
git add games/dau-truong-sinh-vat.html
git commit -m "$(cat <<'EOF'
feat(sinh-vat): flip animation, combo callouts and board shake

Waves replay staggered at 380ms with the card fill swapping edge-on, plus
SAME/PLUS/COMBO callouts. Input stays locked until the cascade settles.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 11: Sound, start screen, rules modal and win overlay

**Files:**
- Modify: `games/dau-truong-sinh-vat.html` (`<style>`, markup, sound + wiring layers)

**Interfaces:**
- Consumes: `state`, `newMatch`, `Rules`, `confettiBurst`.
- Produces: `Sound` with `place()`, `flip(waveIndex)`, `same()`, `win()`, `lose()`, `toggle()`, `muted`. `finishMatch()` — replaces the Task 9 placeholder. `openStart()`, `closeStart()`.

`Sound` mirrors the `Sound` IIFE in `games/co-ca-ngua.html`: oscillator + noise helpers behind a master gain, mute persisted to `localStorage`.

- [ ] **Step 1: Add overlay CSS**

```css
.overlay{
    position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at center, rgba(8,4,20,.72), rgba(3,1,8,.93));
    backdrop-filter:blur(7px);
    opacity:0;visibility:hidden;transition:opacity .32s;
}
.overlay.show{opacity:1;visibility:visible}
.panel{
    position:relative;text-align:center;padding:28px 34px;border-radius:22px;
    max-width:min(93vw,480px);max-height:86vh;overflow-y:auto;
    background:linear-gradient(160deg,rgba(20,14,44,.97),rgba(7,4,15,.98));
    border:1px solid rgba(34,211,238,.42);
    box-shadow:0 30px 70px rgba(0,0,0,.72), 0 0 40px rgba(34,211,238,.18);
    transform:translateY(22px) scale(.94);transition:transform .38s cubic-bezier(.2,.9,.2,1.2);
}
.overlay.show .panel{transform:translateY(0) scale(1)}
.panel h2{margin:10px 0 6px;font-size:26px;font-weight:900;letter-spacing:1px}
.panel h3{margin:0 0 14px;color:#7ff0ff;font-size:21px}
.panel p{margin:0 0 18px;font-size:15px;line-height:1.55;color:#c9d8e6}
.panel .big{font-size:62px;line-height:1;filter:drop-shadow(0 8px 18px rgba(0,0,0,.6))}
.panel ul{margin:0 0 18px;padding-left:20px;line-height:1.65;text-align:left;font-size:14px}
.panel li{margin-bottom:6px}
.panel li b{color:#7ff0ff}
.opt-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}
.opt{
    padding:10px 16px;border-radius:12px;cursor:pointer;font-weight:800;font-size:14px;
    background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:#e8f6ff;
    transition:background .18s, box-shadow .18s;
}
.opt.on{background:linear-gradient(135deg,rgba(34,211,238,.34),rgba(124,58,242,.34));
    border-color:#22d3ee;box-shadow:0 0 18px rgba(34,211,238,.5)}
.panel .btn{width:100%;font-size:16px;padding:13px}
.close-x{
    position:absolute;top:12px;right:14px;width:32px;height:32px;border-radius:50%;
    border:none;cursor:pointer;font-weight:900;
    background:rgba(255,255,255,.1);color:#fff;transition:transform .2s, background .2s;
}
.close-x:hover{background:rgba(255,255,255,.24);transform:rotate(90deg)}
```

- [ ] **Step 2: Add the three overlays to the markup**

Insert before the closing `</div>` of `.container`:

```html
<div class="overlay show" id="startOverlay">
    <div class="panel">
        <div class="big">🧪</div>
        <h2>ĐẤU TRƯỜNG SINH VẬT</h2>
        <p>Đặt bài lên lưới 3×3. Cạnh mạnh hơn sẽ lật quân đối thủ về phía bạn.</p>
        <div class="opt-row" id="modeRow">
            <div class="opt on" data-mode="ai">🤖 Đấu với máy</div>
            <div class="opt" data-mode="hotseat">👥 2 người</div>
        </div>
        <div class="opt-row" id="diffRow">
            <div class="opt" data-diff="easy">Dễ</div>
            <div class="opt on" data-diff="normal">Thường</div>
            <div class="opt" data-diff="hard">Khó</div>
        </div>
        <button class="btn btn-primary" id="startBtn">⚡ Bắt đầu</button>
    </div>
</div>

<div class="overlay" id="rulesOverlay">
    <div class="panel">
        <button class="close-x" id="rulesClose" aria-label="Đóng">✕</button>
        <h3>📖 Luật chơi</h3>
        <ul>
            <li>Mỗi bên có <b>5 lá bài</b>, đều <b>lật ngửa</b>. Lần lượt đặt bài lên lưới <b>3×3</b>.</li>
            <li>Mỗi lá có <b>4 con số</b> ở bốn cạnh (10 hiện là <b>A</b>).</li>
            <li><b>Cơ bản:</b> cạnh của bạn <b>lớn hơn</b> cạnh đối diện thì lật lá đó về phía bạn.</li>
            <li><b>SAME:</b> nếu có <b>từ 2 cạnh trở lên bằng nhau đúng bằng</b> cạnh đối diện, lật tất cả quân địch trong nhóm đó — kể cả khi số của chúng lớn hơn.</li>
            <li><b>PLUS:</b> nếu <b>tổng</b> (cạnh bạn + cạnh địch) của từ 2 phía trở lên <b>bằng nhau</b>, lật tất cả quân địch trong nhóm đó.</li>
            <li><b>COMBO:</b> quân bị lật bởi SAME hoặc PLUS sẽ <b>tự tấn công</b> hàng xóm của nó theo luật cơ bản, tạo phản ứng dây chuyền.</li>
            <li>Hết ô trống thì tính điểm: <b>số quân trên bàn + số bài còn trên tay</b>. Ai nhiều hơn thì thắng, 5–5 là hòa. 🏆</li>
        </ul>
        <button class="btn btn-primary" id="rulesOk">Đã hiểu 👍</button>
    </div>
</div>

<div class="overlay" id="endOverlay">
    <div class="panel">
        <div class="big" id="endEmoji">🏆</div>
        <h2 id="endTitle">Chiến thắng!</h2>
        <p id="endReason"></p>
        <button class="btn btn-primary" id="againBtn">🔄 Chơi lại</button>
    </div>
</div>
```

- [ ] **Step 3: Add the `Sound` module**

```js
/* ── SOUND (Web Audio, synthesized) ── */
const Sound = (()=>{
    let ac = null, master = null;
    let muted = localStorage.getItem('dauTruongSinhVat.muted') === '1';

    function ensure(){
        if(!ac){
            const AC = window.AudioContext || window.webkitAudioContext;
            if(!AC) return null;
            ac = new AC();
            master = ac.createGain();
            master.gain.value = .8;
            master.connect(ac.destination);
        }
        if(ac.state === 'suspended') ac.resume();
        return ac;
    }

    function tone({freq=440, type='sine', dur=.15, gain=.18, slideTo=null, when=0}){
        if(muted || !ensure()) return;
        const t0 = ac.currentTime + when;
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if(slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
        g.gain.setValueAtTime(.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + .006);
        g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
        osc.connect(g); g.connect(master);
        osc.start(t0); osc.stop(t0 + dur + .03);
    }

    function noise({dur=.2, gain=.16, type='bandpass', freq=1200, freqTo=null, when=0}){
        if(muted || !ensure()) return;
        const t0 = ac.currentTime + when;
        const frames = Math.floor(ac.sampleRate * dur);
        const buf = ac.createBuffer(1, frames, ac.sampleRate);
        const d = buf.getChannelData(0);
        for(let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource(); src.buffer = buf;
        const f = ac.createBiquadFilter(); f.type = type;
        f.frequency.setValueAtTime(freq, t0);
        if(freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur);
        const g = ac.createGain();
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
        src.connect(f); f.connect(g); g.connect(master);
        src.start(t0); src.stop(t0 + dur + .03);
    }

    return {
        get muted(){ return muted; },
        toggle(){
            muted = !muted;
            localStorage.setItem('dauTruongSinhVat.muted', muted ? '1' : '0');
            if(!muted){ ensure(); this.place(); }
            return muted;
        },
        place(){
            tone({freq:320, type:'triangle', dur:.09, gain:.14, slideTo:180});
            noise({dur:.06, gain:.07, type:'lowpass', freq:900});
        },
        // pitch climbs with each combo wave
        flip(wave = 0){
            const base = 520 * Math.pow(1.22, wave);
            tone({freq:base, type:'square', dur:.11, gain:.10, slideTo:base * 1.7});
            noise({dur:.07, gain:.05, type:'highpass', freq:2600});
        },
        same(){
            [523.25, 659.25, 783.99].forEach((f, i) =>
                tone({freq:f, type:'triangle', dur:.26, gain:.12, when:i * .05}));
        },
        win(){
            [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
                tone({freq:f, type:'triangle', dur:.42, gain:.15, when:i * .11});
                tone({freq:f * 2, type:'sine', dur:.3, gain:.05, when:i * .11});
            });
        },
        lose(){
            [440, 349.23, 261.63].forEach((f, i) =>
                tone({freq:f, type:'sawtooth', dur:.42, gain:.12, when:i * .16}));
        }
    };
})();

function updateSoundUI(){
    document.getElementById('soundBtn').textContent = Sound.muted ? '🔇 Âm: TẮT' : '🔊 Âm: BẬT';
}
```

Then, in `playWaves` from Task 10, add `if(res.same || res.plus) Sound.same();` immediately after the `Sound.place();` line.

- [ ] **Step 4: Replace `finishMatch` and add all the wiring**

```js
function finishMatch(){
    state.gameOver = true;
    state.selected = null;
    markOpenSlots();
    renderStatus();

    const [s0, s1] = Rules.score(state.board, state.hands);
    const w = Rules.winner(state.board, state.hands);
    const emoji = document.getElementById('endEmoji');
    const title = document.getElementById('endTitle');
    const reason = document.getElementById('endReason');

    if(w === null){
        emoji.textContent = '🤝';
        title.textContent = 'HÒA!';
        reason.textContent = `Tỉ số ${s0} — ${s1}. Không ai chiếm được ưu thế.`;
        Sound.lose();
    }else{
        const humanWon = state.mode === 'hotseat' ? true : w === 0;
        const who = state.mode === 'hotseat'
            ? (w === 0 ? 'NGƯỜI 1 🟦' : 'NGƯỜI 2 🟥')
            : (w === 0 ? 'BẠN 🟦' : 'ĐỐI THỦ 🟥');
        emoji.textContent = humanWon ? '🏆' : '💀';
        title.textContent = `${who} CHIẾN THẮNG!`;
        reason.textContent = `Tỉ số chung cuộc ${s0} — ${s1}.`;
        if(humanWon){ Sound.win(); confettiBurst(); }
        else Sound.lose();
    }
    document.getElementById('endOverlay').classList.add('show');
}

/* ── WIRING ── */
const startOverlay = document.getElementById('startOverlay');
const rulesOverlay = document.getElementById('rulesOverlay');
const endOverlay   = document.getElementById('endOverlay');

document.getElementById('modeRow').addEventListener('click', e => {
    const opt = e.target.closest('.opt');
    if(!opt) return;
    state.mode = opt.dataset.mode;
    document.querySelectorAll('#modeRow .opt').forEach(o => o.classList.toggle('on', o === opt));
    document.getElementById('diffRow').style.display = state.mode === 'ai' ? 'flex' : 'none';
});

document.getElementById('diffRow').addEventListener('click', e => {
    const opt = e.target.closest('.opt');
    if(!opt) return;
    state.difficulty = opt.dataset.diff;
    document.querySelectorAll('#diffRow .opt').forEach(o => o.classList.toggle('on', o === opt));
});

document.getElementById('startBtn').addEventListener('click', () => {
    startOverlay.classList.remove('show');
    newMatch();
});

document.getElementById('restartBtn').addEventListener('click', () => {
    endOverlay.classList.remove('show');
    startOverlay.classList.add('show');
});
document.getElementById('againBtn').addEventListener('click', () => {
    endOverlay.classList.remove('show');
    newMatch();
});

document.getElementById('rulesBtn').addEventListener('click', () => rulesOverlay.classList.add('show'));
document.getElementById('rulesClose').addEventListener('click', () => rulesOverlay.classList.remove('show'));
document.getElementById('rulesOk').addEventListener('click', () => rulesOverlay.classList.remove('show'));
rulesOverlay.addEventListener('click', e => { if(e.target === rulesOverlay) rulesOverlay.classList.remove('show'); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') rulesOverlay.classList.remove('show'); });

document.getElementById('soundBtn').addEventListener('click', () => { Sound.toggle(); updateSoundUI(); });

updateSoundUI();
```

Finally, remove the bare `newMatch();` call added at the end of Task 8 — the start overlay now drives it.

- [ ] **Step 5: Verify**

Run: `node --test tests/`
Expected: PASS — 38 tests.

Playtest: the start overlay appears first; switching to 👥 2 người hides the difficulty row; ⚡ Bắt đầu deals a match. Play a full game to the last cell and confirm the end overlay reports the correct score, that a win gives 🏆 + confetti and a loss gives 💀, that 5–5 shows 🤝 HÒA, and that the mute button survives a page reload.

- [ ] **Step 6: Commit**

```bash
git add games/dau-truong-sinh-vat.html
git commit -m "$(cat <<'EOF'
feat(sinh-vat): sound, start screen, rules modal and end overlay

Web Audio synth with mute persisted to localStorage, mode/difficulty picker,
Vietnamese rules modal, and a scored end overlay with confetti on a win.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Task 12: Hub integration and full playtest

**Files:**
- Modify: `index.html` (the `games` array)
- Modify: `README.md` (the game list)

**Interfaces:**
- Consumes: the finished `games/dau-truong-sinh-vat.html`.
- Produces: nothing further.

- [ ] **Step 1: Add the hub card**

In `index.html`, append to the `games` array, after the `🏇 Cờ Cá Ngựa` entry:

```js
    {
      title: "🧪 Đấu Trường Sinh Vật",
      description: "Đấu bài 3×3: lật quân đối thủ bằng sức mạnh bốn cạnh!",
      color: "linear-gradient(135deg, #07040f, #22d3ee)",
      path: "games/dau-truong-sinh-vat.html"
    },
```

- [ ] **Step 2: Add the README line**

In `README.md`, append to the `## Danh sách game` list:

```markdown
- `dau-truong-sinh-vat.html` - Đấu bài 3×3 kiểu Triple Triad với 30 sinh vật đột biến.
```

- [ ] **Step 3: Run the full suite**

Run: `node --test tests/`
Expected: PASS — 38 tests, 0 failures.

- [ ] **Step 4: Full playtest checklist**

Open `index.html`, click through to the new game, and confirm each of these:

- Hub card appears with the neon gradient and opens the right file.
- Start overlay: both modes selectable, difficulty row hides for hot-seat.
- vs AI on **Khó** feels meaningfully harder than **Dễ**.
- Hot-seat: the status card names NGƯỜI 1 / NGƯỜI 2 and both hands are clickable on their own turns.
- Every card's four edge numbers are legible against its emoji, `A` shows for 10.
- Hover preview outlines exactly the cards that then flip — no more, no less.
- A SAME capture flips a card whose number is *higher* than yours (this is the rule most likely to be wrong).
- A combo shows `COMBO ×2` and flips in visibly separate waves.
- Score always totals 10; the last placement ends the match immediately.
- Nothing is clickable while a cascade animates.
- Layout does not shift when the status text changes.
- Under 900px wide the layout stacks and stays usable.

- [ ] **Step 5: Commit**

```bash
git add index.html README.md
git commit -m "$(cat <<'EOF'
feat(sinh-vat): add Đấu Trường Sinh Vật to the hub and README

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LyBVvvtev5ikt8AGo7tfX
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:** §3.1 setup → Tasks 6, 8. §3.2 turn loop → Task 9. §3.3 card values → Tasks 1, 8. §3.4 resolution order → Tasks 2–5. §3.5 scoring → Task 6. §4 roster/rarity/recipe → Tasks 1, 6. §5.1 `Rules` → Tasks 2–6. §5.2 `AI` → Task 7. §5.3 render layer → Task 8. §5.4 state → Task 8. §6.1 palette → Task 8. §6.2 card → Task 8. §6.3 layout → Task 8. §6.4 interaction → Task 9. §6.5 animation → Task 10. §6.6 sound → Task 11. §7 verification → Task 1 harness, per-task gates, Task 12 checklist. §8 hub → Task 12.

**Deviation:** spec §7.1's in-page `__selfTest()` is replaced by the Node suite — recorded under Global Constraints above.

**Name consistency:** `Rules.resolve/score/legalCells/winner`, `Deal.hands/shuffle`, `AI.pick`, `neighborsOf`, `OPPOSITE`, `cardFace`, `edgeLabel`, `renderBoard`, `renderHands`, `renderStatus`, `markOpenSlots`, `previewAt`, `clearPreview`, `selectCard`, `commitMove`, `applyWaves`, `endTurn`, `aiTurn`, `isHumanTurn`, `playWaves`, `callout`, `shakeBoard`, `confettiBurst`, `finishMatch`, `newMatch`, `Sound.place/flip/same/win/lose/toggle/muted`, `updateSoundUI` — each defined once and referenced under the same name throughout.
