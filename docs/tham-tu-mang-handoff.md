# Thám Tử Mạng — handoff

**Written:** 2026-09-10 · **Last updated:** 2026-09-10, after the chapter 1 visual rebuild
**For:** a fresh Claude session picking this up on another machine.

You are inheriting a **half-built game**: the engine and Chapter 1 are done and tested,
Chapters 2–6 do not exist. Read this file, then the spec, then start.

**§8 is now mostly done.** Two of its three items — the image pass and the offline gate —
were closed on a machine with a browser and a network. §8.3, difficulty calibration, still
needs a human playing. Read §8 for what changed before touching chapter 1's look.

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
| `docs/superpowers/specs/2026-09-10-tham-tu-mang-design.md` | The design. 33 anomalies, 6 chapters, all copy. **Authoritative.** |
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
sites/ch1-lumiere/  page.js (markup + behaviour()) · site.css
```

**The 20 anomalies built** (of 34 designed):

| Family | Built |
|---|---|
| TEXT | `T01` cursed sentence · `T02` rewrites on re-read · `T03` number stops being a number · `T04` the site knows a true fact about you · `T05` hover reveals a line that contradicts the page · `T07` an opening time that cannot exist |
| STYLE | `S01` one word wrong font · `S05` caption ≠ photo · `S06` a line walking off the page · `S07` stray emoji |
| MOTION | `M01` drifts toward cursor · `M03` breathing |
| ELEMENT | `E01` button in the margin · `E04` impossible footer line · `E05` wrong cursor |
| REACTIVE | `R05` newsletter says you subscribed years ago · `R06` a link searches for something you never typed |
| IMAGE | `I01` one photo is decades older than its neighbours · `I03` two names, one face · `I04` photo blurs each time you look |

**`S04` was withdrawn** after the second playtest — see §9.13. The registry holds 20, not 19,
and `STAGE1_IDS` in the test file is the list of record.

**Two anomalies are now `deferred`** (`R05`, `R06`), so a run can contain two that do not
exist on the page until the player interacts. Both are REACTIVE and the director caps a family
at two, so two is the ceiling. Worth watching at playtest: a run holding both demands that the
player submit the newsletter form *and* click the right link before they can win.

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
3. **The lasso has a maximum size** (`MAX_W`/`MAX_H` in `hittest.js`). Without it one giant
   loop takes every anomaly at once. A too-large stroke is voided *before* hit-testing, so it
   leaks nothing and costs nothing. It used to be shown as a dashed budget rectangle; the user
   had that removed along with every other guide (§9.15) — the cap is now signalled by the
   stroke turning red. **The cap itself is the decision; drawing a box around it was not.**
4. **Giving up is not rankable.** If it were, "look at the answers" would be the optimal
   opening move.
5. **Photos are hotlinked, not bundled.** The user chose this over procedural SVG after being
   shown both. It is `CLAUDE.md`'s fourth network exception.
6. **No timer, no hints, no difficulty settings.** Chapter order is the difficulty curve.

## 7. Invariants — breaking these breaks the game silently

- **No module may touch the DOM at import time.** The import test enforces it repo-wide.
- **Every image URL must be pinned** — a `lock=`, an `/id/`, or a portrait index. `img.js`
  throws on an unpinned request, deliberately. An unpinned URL returns a different photo per
  load, which silently breaks `S05` (a caption written against a *known* photograph) and the
  whole IMAGE family. Pinning is necessary but not sufficient: a pinned URL nobody has
  **looked at** is just as broken — see §8.1 for how that played out.
- **Every `<img>` needs its `onerror` fallback.** Use `imgHtml()`; never hand-write an `<img>`.
- **A hit target must be something the player can actually see.** `targets()` filters on
  `Element.checkVisibility()`, not just a non-zero rect — a closed `<details>` lays its
  contents out and reports real boxes for them (§9.8). Anything that offers hidden elements to
  the lasso lets a player score what they never saw.
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

### 8.1 Reroll the image `lock` values — ✅ DONE, and the source changed

**Every photograph in the game had been chosen blind.** Looked at on a real screen, they were
worse than "some will be absurd": *squalane* was a bronze pig statue, *cream texture* was a
woman in a red dress on a street, the *lab* shot was already black and white — which alone
would have made `I01` (one photo drained of colour) unwinnable — and of the four portraits,
one was a **newsstand**, so `I03` (two names, one face) had nothing to collapse. On top of
that, loremflickr burns an attribution strip and a licence badge into every frame, so the
whole page read as scraped stock rather than a brand's own site.

**Chapter 1 no longer uses loremflickr.** Scenes and objects come from `picsum.photos/id/<id>`
(curated, unwatermarked, and the id names one specific photograph); the four testimonial faces
come from `randomuser.me`, which is what a real testimonial block uses. `flickr()` stays in
`img.js` for chapters 2–6. Every image was viewed at its final crop, and **each caption was
then written against the photograph** — see the rule added to spec §3.4, which is the part
that matters more than the ids.

For the record, the pairs that were replaced:

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

**Chapters 2–6 must not replicate the old pattern.** Pick the photograph first, look at it,
then write the caption. Chapter 2 is a food blog and will be the most sensitive to it.

### 8.2 Verify the offline fallback — ✅ DONE, passes

Ran with `picsum.photos` and `randomuser.me` both aborted at the network layer, scrolling the
whole page so the `loading="lazy"` images actually request and fail. **All 11 images fall back**
to the tinted SVG placeholder at their correct display sizes, and the page still reads as a
website whose photographs have not arrived — not as a broken one. Spec §3.4's gate is met.

One trap if you re-run this: without scrolling, only the two above-the-fold images have been
requested, so a stationary check reports 2 of 11 and looks like a failure. It is not.

### 8.3 Calibrate difficulty — still open, needs a human

Chapter 1 has been played, which is where bugs 1–7 in §9 came from, but it has **not** been
played since it doubled in size, gained six anomaly types, and was visually rebuilt (§11). Three of the four open questions were answered by the second playtest and are now fixed
rather than open — `M03` was invisible (§9.11), `T05` was not understood at all (§9 and spec
§6 T05), and `S06` read as a bug (§9.12). What is still genuinely open:

- Are 6–8 anomalies findable across the longer page without frustration?
- Does `E05` (wrong cursor) register on anything other than the buy button?
- A run can now hold **two** deferred anomalies (`R05` and `R06`), neither of which exists on
  the page until the player interacts. Does that feel like exploration, or like a run you
  cannot finish?

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

Six more from the second playtest, all of them calibration or correctness rather than
crashes — and again, none catchable by a green test suite:

8. **A collapsed `<details>` handed out phantom hit targets.** Chrome lays out the contents of
   a closed `<details>` and gives them real non-zero rects at the position they *would* occupy
   if it were open. Chapter 1's FAQ answers are `paragraph` slots, so an anomaly landing there
   reported a 26×18 box sitting in what looks like blank page. This broke the game in both
   directions at once: circling apparently empty space **silently scored an anomaly the player
   had never seen**, and the aim ring outlined nothing while they drew. `targets()` in
   `site.js` now checks `Element.checkVisibility()` before offering anything. The anomaly is
   not lost — opening the accordion is ordinary read-mode exploration, and `targets()` is
   recomputed at the start of every stroke. **Lesson: a rect is not proof that anything is on
   screen.**
9. **Three of `S01`'s four fonts were silently doing nothing.** `Consolas` and `Candara` are
   not installed on macOS at all, so the "wrong font" rendered in the paragraph's own font;
   `Impact` is installed but has **no precomposed Vietnamese glyphs**, so it substituted
   mid-word and read as a rendering fault rather than a wrong word. The pool is now five
   stacks measured on a real machine — present, and drawing every stacked diacritic
   themselves. **Lesson: naming a font is not the same as having it, and having it is not the
   same as it covering Vietnamese. Measure per glyph.**
10. **`I03` punished the player for being right.** After the face swap the two portraits are
    pixel-identical, so nothing can tell the player which one is "the" anomaly — but only the
    swapped one was marked. Circling the pair you correctly spotted was a coin flip, and the
    results screen then agreed you had been wrong. Both halves are now marked; `run.found`
    keys on the anomaly id, so either scores once and the other returns `ĐÃ GHI RỒI`.
    **Lesson: if two things are indistinguishable by construction, both must be the answer.**
11. **`M03` was invisible.** 1.2% over 4s measured out at ~2px on a button — the open question
    in §8.3, now answered: not subtle, absent. It breathes at ~4.5% over 3.2s with a hold at
    the top of the inhale, measured at 8.2px of swing. **Lesson: sub-perceptual is not subtle,
    and an anomaly nobody can see does not make a run hard, it makes it unwinnable.**
12. **`S06` read as a CSS bug, not an anomaly.** A block shifted once into the margin and then
    sitting still is *exactly* what a broken stylesheet looks like. It now walks: further out
    and further tilted every time the player scrolls away and back, capped so it can never
    leave the screen. **Lesson: what separates "broken" from "wrong" is intent, and intent
    shows as change over time.**
13. **`S04` was withdrawn entirely.** A shadow falling the other way does not read as a
    symptom, it reads as a card styled slightly differently — which every real site has. It
    failed the premise's test in reverse: the answer to "…or is that just how the site is?"
    was always yes. Deleted from the registry rather than merely excluded, so the director
    cannot place it in later chapters either. **Lesson: an anomaly that is indistinguishable
    from ordinary design variation is not a hard anomaly, it is a heart tax.**

14. **The lasso drew a chord from the cursor to the anchor, and auto-closed any arc.** Two
    faults in one gesture. `draw()` called `closePath()` before `stroke()`, so a hard straight
    line swept across the page following the cursor for the whole stroke — the player read it
    as part of their own drawing when it was the renderer guessing at an unfinished shape. And
    on release, an arc that never came back was silently completed into a polygon and **scored**,
    so a gesture the player abandoned halfway could cost them a heart. The stroke is now traced
    open (the claimed area is shown by filling, which closes the path without painting a line
    across it), and an unclosed loop is a third void verdict, `NOT_CLOSED`, rejected before
    hit-testing like the other two. Tolerance is relative — `max(28px, 25% of the stroke box
    diagonal)`. `VÒNG CHƯA KHÉP` now means what it says; the too-short stroke took the honest
    `NÉT QUÁ NGẮN`. **Lesson: do not render a shape the player has not finished making, and do
    not score one either.**
15. **The drawing guides were clutter.** The fix for 14 shipped a dashed ring at the anchor for
    the closing tolerance, on top of the existing dashed budget rectangle. Two guide shapes plus
    the stroke turned every capture into a diagram laid over the page — and the player is
    supposed to be looking at the website. Both are gone. The overlay now draws **only the
    player's stroke**, and it carries both rules in its colour: grey while open, green once it
    would close, red past the cap, over a light halo so it reads on cream and on black alike.
    **Lesson: "communicate the rule by drawing" did not have to mean drawing more things.**

16. **The newsletter form swallowed a valid email and said nothing.** A form that takes an
    address and does not answer is an anomaly nobody placed — and it quietly wrecked `R05`,
    because with a silent clean branch *any* confirmation was the anomaly, so the player never
    had to read the date the anomaly is actually made of. Page modules now export
    `behaviour(shadow)` — how the honest site answers ordinary interaction — which `main.js`
    calls after mounting and before applying anomalies. Both branches now thank you, clear the
    field, and share the `.news-ok` class, so **only the words differ**. `R05` therefore must
    not set inline styles: its first version kept a `font-size:13px` fallback that overrode the
    site's 13.5px class, making the anomalous line half a pixel smaller than the honest one —
    identifiable by eye without reading it, which is the one thing it must not be. Chapters 2
    and 3 need this hook for the comment form and the cart. **Lesson: an anomaly that only
    shows up as "something happened" is not an anomaly; the clean branch has to happen too.**

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

## 11. The chapter 1 visual rebuild — and the four CSS rules it left behind

The user's verdict on the first build was that it looked ugly and did not read as a modern
site. That is not a cosmetic complaint. **Every anomaly in spec §6 is built to survive the
question *"…or is that just how the site is?"*** — and on a page that already looks
provisional, that question never gets asked, because anything could be a mistake. A site that
does not pass as a site takes the whole mechanic down with it.

What was actually wrong, in order of damage:

1. **No content container.** Every section ran the full window width, so at 1440px the
   comparison table stretched 1400px for three short columns and body text ran to 1400px lines.
2. **Images upscaled.** Sources were requested at 520–640px and stretched with
   `width:100%`, so a 640px storefront shot rendered 1400px wide and soft.
3. **The photographs themselves** — see §8.1.
4. Flat 1990s styling: no radius, no cards, no elevation, no spacing scale, a 15px serif body.

The rebuild is `sites/ch1-lumiere/site.css` (rewritten) and `page.js` (new photography,
section eyebrows, card grids). **Slot inventory is byte-identical** — same counts, same
`data-slot` values, same `figure > img + figcaption` nesting — so the director, the
registry↔chapter↔markup cross-check and all 444 tests were unaffected throughout.

**Four CSS rules exist for the anomalies, not for looks.** They are commented at the top of
`site.css` too; breaking any of them breaks an anomaly *silently*, with tests still green:

- **The baseline `box-shadow` sits on the `<img>` itself, and falls down-right.** `S04`
  overrides it inline with an up-left shadow. Put the baseline on a wrapper instead and the
  two shadows coexist, so nothing reads as "lit from the wrong side".
- **No `overflow: hidden` on anything wrapping a `data-slot`.** `S06` translates a line out
  into the margin and `E01` parks an absolutely-positioned button there; a clipping ancestor
  deletes both.
- **No `transform` in `:hover` for `cta` / `avatar`.** `M01` and `M03` drive those elements'
  transforms. Hover on colour and shadow instead.
- **Every photo stays inside a `<figure>` with its `<figcaption>`.** `I01`, `I03`, `I04` and
  `S04` all reach the image via `ctx.slot.closest('figure')`.

One layout trap worth knowing: `imgHtml()` writes `width`/`height` attributes on every
`<img>`, and the browser applies them as presentational hints — `height: 840px` on the hero.
That **overrides `aspect-ratio`**, so the hero rendered at its full 840px until `img { height:
auto }` was added. The attributes must stay (they reserve space before the image arrives, and
size the fallback SVG), so the `height: auto` is load-bearing.

Verified in a browser, not just by tests: six seeds render with no console errors, no
zero-size or off-page anomaly, and no horizontal overflow at 1440 / 1024 / 820 / 500px; a
lasso around an anomaly scores it and keeps all three hearts; a lasso over empty margin costs
one and toasts `KHÔNG CÓ GÌ Ở ĐÂY`.

## 12. Current state

Branch **`feat/tham-tu-mang`**, off `main`. Not pushed, no PR opened. The work is committed in
readable steps: spec+plan, engine+chapter 1, hub registration, this handoff, then a fix commit
per round of playtesting. Commit bodies carry the reasoning — read
`git log feat/tham-tu-mang` before changing anything load-bearing, since several commits explain
why something that looks wrong is deliberate.

Ask the user before pushing or opening a PR.
