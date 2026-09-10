# Thám Tử Mạng — handoff

**Written:** 2026-09-10 · **Last updated:** 2026-09-10, after the first playtests
**For:** a fresh Claude session picking this up on another machine.

You are inheriting a **half-built game**: the engine and Chapter 1 are done and tested,
Chapters 2–6 do not exist. Read this file, then the spec, then start.

**If you can drive a browser, read §8 first.** Three things could not be verified from the
machine this was built on, because that sandbox had no network and no browser. They are the
highest-value work available and they gate everything else.

---

## 1. What the game is

An observation/horror puzzle in Vietnamese. You open a fake but ordinary-looking website, and
between five and eight things on it are **wrong** — not broken, wrong. A cursed sentence
spliced into product copy. A number that counts down past zero and then stops being a number.
Two testimonials with different names and the same face. You switch to capture mode and draw a
circle around what you find.

Three hearts. Circling ordinary content costs one. **Circling empty space also costs one** —
that was a deliberate user decision, not an oversight; see §6.

While you draw, the element that *would* be scored is outlined in neutral grey. **That outline
never changes colour**, because telling you whether the thing is an anomaly would let a player
sweep the page and read the answer off the ring. Ending a run — win, loss, or the `BỎ CUỘC`
button — reveals every anomaly: green for found, amber dashed for missed, with a clickable
results list naming each one.

Anomalies are **applied at runtime to a clean site**, so the same site plays differently every
run. That is the load-bearing architectural idea and §7 explains what it forbids.

## 2. Read these, in this order

| File | Why |
|---|---|
| `docs/superpowers/specs/2026-09-10-tham-tu-mang-design.md` | The design. 34 anomalies, 6 chapters, all copy. **Authoritative.** |
| `docs/superpowers/plans/2026-09-10-tham-tu-mang-stage1.md` | The Stage 1 build plan, executed. Stages 2–3 described but not written. |
| `CLAUDE.md` | Repo house rules. §56 was amended for this game — see §7. |

The spec's §6 flavour text **is content, not examples**. Do not paraphrase it when building
Chapters 2–6; it was written deliberately and reviewed line by line.

## 3. Running it

**ES modules mean this does not work over `file://`.** It needs a server. There is **no
`python3`** on the original machine — that is why the usual `python3 -m http.server` is absent
from the instructions. `npx serve` works if you have network. Otherwise, zero-install:

```bash
node -e "const http=require('http'),fs=require('fs'),p=require('path');const T={'.html':'text/html','.js':'text/javascript','.css':'text/css'};http.createServer((q,s)=>{let f=p.join(process.cwd(),decodeURIComponent(q.url.split('?')[0]));try{if(fs.statSync(f).isDirectory())f=p.join(f,'index.html');s.writeHead(200,{'Content-Type':T[p.extname(f)]||'application/octet-stream'});s.end(fs.readFileSync(f));}catch(e){s.writeHead(404);s.end('404');}}).listen(8000,()=>console.log('http://localhost:8000/'))"
```

Then `http://localhost:8000/games/tham-tu-mang/`. Append `?seed=4242` to replay an exact case —
the director is fully seeded, so a seed reproduces a run precisely. Invaluable for bug reports.

**Tests:**

```bash
node --test 'tests/*.test.mjs'          # bash — the glob is required, bare dir fails
node --test "tests/*.test.mjs"          # PowerShell
node --test tests/tham-tu-mang.test.mjs # just this game
```

Node 22 built-ins only. Current state: **96 tests for this game, 441 repo-wide, all passing.**

## 4. What exists

`games/tham-tu-mang/` — 29 files, ~2,100 lines.

```
index.html          shell: HUD, viewport host, overlays. No game logic.
style.css           HUD/menu/overlay only — never the fake sites
js/
  main.js           boot(), screen routing, the apply loop, results panel
  state.js          run state; observerFor() is the read-only view anomalies get
  storage.js        localStorage: thamTuMang.progress, thamTuMang.muted
  audio.js          Web Audio synth, no files
  engine/
    rng.js          mulberry32 + range/pick/shuffle    ← DOM-free, tested
    hittest.js      polygon math, multi-point targets  ← DOM-free, tested
    img.js          pinned CDN urls + SVG fallback     ← DOM-free, tested
    registry.js     the 19 anomalies                   ← DOM-free, tested
    director.js     seeded pick + slot assignment      ← DOM-free, tested
    run.js          hearts, capture, giveUp, reconcile ← DOM-free, tested
    site.js         shadow root, slot lookup, targets(), sealNavigation()
                    targets() returns one hit point PER LINE OF TEXT, plus rects
  anomalies/        text · style · motion · element · reactive · image
  ui/               menu · hud · mode · lasso · toast · overlay
  chapters/         index.js · ch1-lumiere.js
sites/ch1-lumiere/  page.js (markup) · site.css
```

**The 19 anomalies built** (of 34 designed):

| Family | Built |
|---|---|
| TEXT | `T01` cursed sentence · `T02` rewrites on re-read · `T03` number stops being a number · `T04` the site knows a true fact about you · `T05` tooltip contradicts the caption |
| STYLE | `S01` one word wrong font · `S04` shadow falls the wrong way · `S05` caption ≠ photo · `S06` line escapes into the margin · `S07` stray emoji |
| MOTION | `M01` drifts toward cursor · `M03` breathing |
| ELEMENT | `E01` button in the margin · `E04` impossible footer line · `E05` wrong cursor |
| REACTIVE | `R05` newsletter says you subscribed years ago |
| IMAGE | `I01` one photo drained of colour · `I03` two names, one face · `I04` photo blurs each time you look |

**Chapter 1 is bigger than the spec's sketch.** After the first playtest it grew to ~36 slot
elements across ten sections (hero, six feature bullets, how-to steps, four ingredient photos,
a comparison table, four testimonials, FAQ, three store locations, newsletter, footer) and its
roll went from 5–6 to **6–8**. Five anomalies simply vanished in a page that size. If you need
to retune difficulty, `CH1.min`/`CH1.max` is the lever.

**Not built:** the other 15 anomalies (spec §6), Chapters 2–6, chapter unlocking, multi-page
navigation. Ch1 is permanently unlocked and is the only entry in `js/chapters/index.js`.

## 5. What the tests actually guarantee

Worth knowing so you don't assume more coverage than exists.

- **Everything DOM-free is well covered.** The director gets 11 assertions × 500 seeds each:
  count in range, no two anomalies on one element, ≥3 families, ≤2 per family, forced/excluded
  respected, every page dirty, every slot real. Heart rules, polygon math and URL pinning are
  all directly tested.
- **`tests/tham-tu-mang.test.mjs` imports every module in the game** and fails if any of them
  touches the DOM at import time. This is why `main.js` exports `boot()` instead of running on
  import. Keep it that way.
- **A cross-check ties three things together**: registry slot declarations → chapter slot
  inventory → the actual `data-slot` attributes in the markup. If you add a chapter, add this
  assertion for it — it catches "the director placed an anomaly on `paragraph[3]` of a page
  that only has three paragraphs", which silently drops an anomaly.
- **Nothing renders in the test suite.** No jsdom, no headless browser. Every `apply()` body,
  all of `ui/`, and all layout are unverified by tests. That is the gap your browser fills.

## 6. Decisions the user made — do not "fix" these

These look like bugs. They are not. They were each raised, questioned, and reaffirmed.

1. **An empty circle costs a heart**, exactly like circling ordinary content. I argued for
   making it free (bad aim ≠ bad judgement); the user chose the harsher rule after the mode
   toggle made every circle deliberate. Two outcomes, not three.
2. **Circling is behind a mode button.** Not ergonomics — it is what leaves drag-select
   available to the player. Without it `S03` (selecting a headline reveals hidden text, spec
   §6) is undiscoverable. Do not make dragging draw by default.
3. **The lasso has a maximum size** (`MAX_W`/`MAX_H` in `hittest.js`), shown as a dashed budget
   ring while drawing. Without it one giant loop takes every anomaly at once. A too-large
   stroke is voided *before* hit-testing, so it leaks nothing and costs nothing.
4. **Giving up is not rankable.** If it were, "look at the answers" would be the optimal
   opening move.
5. **Photos are hotlinked, not bundled.** The user chose this over procedural SVG after being
   shown both. It is `CLAUDE.md`'s fourth network exception.
6. **No timer, no hints, no difficulty settings.** Chapter order is the difficulty curve.

## 7. Invariants — breaking these breaks the game silently

- **No module may touch the DOM at import time.** The import test enforces it repo-wide.
- **Every image URL must be pinned** — a `lock=` or an `/id/`. `img.js` throws on an unpinned
  request, deliberately. An unpinned URL returns a different photo per load, which silently
  breaks `S05` (a caption written against a *known* photograph) and the whole IMAGE family.
- **Every `<img>` needs its `onerror` fallback.** Use `imgHtml()`; never hand-write an `<img>`.
- **An anomaly must actually mark something.** `ctx.mark(el)` is what makes it capturable. If
  `apply()` can return without marking, the evidence counter promises a number that can never
  be reached and the run becomes unwinnable. `reconcile()` in `run.js` is the safety net — it
  drops unattached anomalies and corrects the total — but *rely on it only as a net*. Reactive
  anomalies that appear later must set `deferred: true` or reconcile will drop them.
- **Fonts must cover Vietnamese.** Georgia and Times New Roman do **not** contain the
  precomposed glyphs (`ằ ặ ệ ộ ữ`), so the browser swaps fonts mid-word and the different
  metrics read as stray whitespace after the character. Use the `--serif` / `--sans` variables
  in `site.css`; never introduce a stack led by an incomplete face. This applies to anomalies
  too: `S01` must reskin with **named** families, never generic `cursive`/`fantasy`/`monospace`,
  or it renders as a broken page rather than a wrong word and stops meaning anything. There is
  a test for that.
- **`CATEGORY_ICONS` in the root `index.html` must stay monochrome.** `Puzzle: "▨"`. An emoji
  renders in colour and breaks the hub sidebar.
- **A new game is unreachable until registered** in the root `index.html` `games` array.
  Nothing scans `games/`.
- **Commits:** conventional, scoped `tham-tu-mang`, body explains the failure not the change.
  **Never add a `Claude-Session:` trailer** — machine-wide rule in the user's `~/.claude/CLAUDE.md`.
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` stays.

## 8. Do these first — they need a browser

Nothing here was verifiable from the original machine. All three are cheap for you.

### 8.1 Reroll the image `lock` values — highest value

**Every photograph in the game was chosen blind.** The build sandbox had no network, so these
keyword/lock pairs in `sites/ch1-lumiere/page.js` have never been looked at by anyone:

| Where | Call |
|---|---|
| hero product shot | `photo('skincare,cream', 21, …, 520, 380)` |
| how-to wide shot | `photo('hands,cream', 88, …, 640, 240)` |
| ingredient 1 | `photo('chamomile', 34, …, 300, 220)` |
| ingredient 2 | `photo('grapeseed,oil', 55, …, 300, 220)` |
| ingredient 3 | `photo('laboratory,glass', 68, …, 300, 220)` |
| ingredient 4 | `photo('squalane,bottle', 29, …, 300, 220)` |
| testimonial 1 | `photo('portrait,woman', 12, …, 96, 96)` |
| testimonial 2 | `photo('portrait,person', 47, …, 96, 96)` |
| testimonial 3 | `photo('portrait,smile', 73, …, 96, 96)` |
| testimonial 4 | `photo('portrait,man', 91, …, 96, 96)` |
| store front | `photo('shop,interior', 64, …, 640, 240)` |

The four testimonial portraits matter most: `I03` swaps one avatar's photo onto another to make
two names share a face, and that only unsettles if the portraits are plainly *different people*
to begin with.

Load the page, look at them, and change any `lock` number whose photo is absurd or off-subject.
This matters beyond looks: `S05` writes a caption that contradicts the photograph, and that
joke only lands if the photograph is recognisably *something*. Note that the same keyword with
a different `lock` gives a different picture — that is the only knob you need.

**Do this before building Chapters 2–6**, or you will replicate an unvalidated pattern across
five more sites. Chapter 2 is a food blog and will be the most sensitive to it.

### 8.2 Verify the offline fallback

Throttle to offline in devtools and reload. Every `<img>` should become a tinted SVG
placeholder with grain, and the site should still read as a *website* — not a stack of grey
rectangles. If it reads as broken, the fix is in `fallbackSvg()` in `js/engine/img.js`.
This is a stated playtest gate in spec §3.4, never yet run.

### 8.3 Calibrate difficulty

Chapter 1 has been played, which is where bugs 1–7 in §9 came from, but it has **not** been
played since it doubled in size and gained six anomaly types. Open questions: are 6–8 anomalies
findable across the longer page without frustration? Is `M03` (breathing, 1.2% scale)
perceptible at all, or invisible? Is `T05` findable now that its only tell is a faint dotted
underline? Does `E05` (wrong cursor) register on anything other than the buy button?

The lever is **`CH1.min`/`CH1.max`** in `js/chapters/ch1-lumiere.js` — *not* the heart rule,
which the user decided (§6.1). If an individual anomaly is invisible or trivially obvious, tune
that anomaly's `apply()`.

Two known compromises to judge while playing, both flagged rather than hidden:

- **`T05` carries a faint dotted underline.** Without it a tooltip is findable only by hovering
  every element on the page — and since you must find *all* anomalies to win, an undiscoverable
  one doesn't make a run hard, it makes it unwinnable. If the underline reads as too obvious,
  it needs a different tell, not no tell.
- **`I04` blurs with a CSS filter, not the CDN's `blur=` parameter.** `loremflickr` has no such
  parameter, and re-fetching `src` on every viewport entry would drop straight to the offline
  placeholder. Slightly less "survives inspection" than spec §6 intends.

## 9. Bugs already found by playing — do not reintroduce

Seven real bugs, every one found by a human playing, **none catchable by the test suite that
was green at the time**. That ratio is the single most useful thing in this document: the
DOM-free logic is well tested and has never been the problem. Everything that broke lived in
rendering, geometry, or the gap between data and page.

1. **The lasso canvas was 0×0.** `initLasso` sized it at boot, when `#viewport-wrap` is still
   `hidden`, so `clientWidth` was 0 and every stroke was drawn into a zero-pixel buffer. Capture
   was dead on a fresh load. Now sized lazily — chapter start, window resize, and defensively on
   `pointerdown`. **Lesson: anything measuring a hidden element measures zero.**
2. **Hit points came from the element box, not the text.** A one-line `<p>` spans the column, so
   its centre sat in empty margin: circling the visible sentence missed, circling blank space
   scored. `targets()` now uses `Range.getClientRects()` for **one hit point per rendered line**.
   **Lesson: a block element's centre is usually not where its words are.**
3. **`S01` made the chapter unwinnable.** It carried a fixed word list (`mong`, `luôn`, `nhớ`)
   and returned early when the paragraph contained none — which, in this chapter, was always.
   It marked nothing, so the counter targeted an unreachable number and nothing on screen said
   so. It now takes its word from the element's own text, and `reconcile()` was added as the
   general net. **Lesson: an anomaly whose flavour data must match page text will eventually
   not match. Derive from the page.**
4. **The newsletter form reloaded the document.** A real `type="submit"` button destroyed the
   run and dumped the player at the menu. `sealNavigation()` in `site.js` now
   `preventDefault`s clicks on links and all submits, in the **capture phase** so anomaly
   handlers still receive their events.
5. **Circling an anomaly could score its container.** Anomalies usually nest inside a clean
   target — `S01`'s odd word is a `<span>` in a `<p data-catch>` — so circling the anomaly
   encloses both, and resolving by distance let the paragraph win, because its line centre sits
   mid-line while the odd word sits off to one side. You circled the right thing, lost a heart,
   and the results screen then agreed with you. Enclosed anomalies now outrank enclosed clean
   content. **Lesson: `ctx.mark()` marks a node inside a marked node; the two compete.**
6. **Anomalies always landed on the first element of their slot type.** `claimSlot` generated
   one option per slot *type* with `nth = number already used`, so the first claimant of
   `feature-icon` always got index 0 — with three emoji, the odd one was *always* the first,
   every run. Players learn that rule far faster than they learn to observe. It now enumerates
   every free position. **Lesson: check that randomness actually varies, not merely that it is
   seeded — the director's eleven tests all passed throughout this.**
7. **Vietnamese diacritics rendered with stray whitespace.** Georgia/Times lack precomposed
   glyphs, so the browser substituted a font mid-word. Fixed by the `--serif`/`--sans` stacks
   (§7). **Lesson: a Vietnamese-language game cannot use a default English font stack.**

## 10. Known limitation for Chapter 2

`sealNavigation()` blocks **every** link. Chapters 2 and 3 are multi-page (spec §5.2, §5.3) and
need the fake site's own nav to work while everything else stays sealed. Plan: give internal
links a marker (e.g. `data-goto="post"`) and let `sealNavigation` route those through a page
swap instead of blocking them.

Also for multi-page: the director already assigns anomalies per page and guarantees at least
one per page, and **assignment must stay fixed for the whole run** — navigating away and back
must re-render the same anomalies in the same places, or a player can never verify a suspicion.
`main.js` currently mounts only `chapter.pages[0]`; `PAGES` at the top of `main.js` is the map
to extend.

## 11. Current state

Branch **`feat/tham-tu-mang`**, off `main`. Not pushed, no PR opened. The work is committed in
readable steps: spec+plan, engine+chapter 1, hub registration, this handoff, then a fix commit
per round of playtesting. Commit bodies carry the reasoning — read
`git log feat/tham-tu-mang` before changing anything load-bearing, since several commits explain
why something that looks wrong is deliberate.

Ask the user before pushing or opening a PR.
