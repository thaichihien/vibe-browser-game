# Thám Tử Mạng — Design

**Date:** 2026-09-10
**Files:** `games/tham-tu-mang/` (folder game — `index.html`, `style.css`, `js/**`, `sites/**`)
**Genre:** Observation / anomaly-hunting puzzle. No combat, no timer.
**Language:** **Vietnamese UI and Vietnamese site content**, joining `jungle-game`,
`co-ca-ngua`, `monster-battle` and `chrono-drifter`. The slug stays English.
**Hub category:** new — `Puzzle`, glyph `▨` (monochrome, per the `CATEGORY_ICONS` rule).

---

## 1. Premise

You are a moderator at a small outfit that audits websites nobody else will look at.
A ticket arrives, you open the site, and you look at it. That is the whole job.

Most of what is on the page is ordinary — a face cream that costs 340.000₫, a food blog
with nine comments, a school posting its holiday schedule. Somewhere in it, between five
and eight things are **wrong**. Not broken. Wrong.

You circle what is wrong and file it. You have three hearts, and a circle is a claim: if what
you circled is ordinary — or if you circled nothing at all — it costs one. Looking is free and
unlimited; claiming is not. That is why circling is behind its own mode.

The horror is load-bearing, not decorative: the game only works if the player genuinely
cannot tell, at a glance, whether a thing is a design decision or a symptom. Every anomaly
in §6 is built to survive the question *"…is that just how the site is?"* for a few seconds.

---

## 2. The core loop

```
chọn chương  →  trang web tải  →  CHẾ ĐỘ ĐỌC
                                  cuộn · bấm · gõ · bôi đen · thử nghiệm
                                  (không bao giờ mất máu)
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        bấm nút → CHẾ ĐỘ KHOANH                tương tác (form, giỏ hàng)
                    │                                       │
            kéo một vòng tròn                    dị thường phản ứng hiện ra
                    │                                       │
        ┌───────────┴───────────┐                           │
        ▼                       ▼                           ▼
   trúng dị thường        trúng nội dung sạch      ──► vẫn phải khoanh
                          HOẶC không trúng gì
        │                       │
   +1 bằng chứng             −1 ♥
        │
   đủ 5–8 → HOÀN THÀNH                          0 ♥ → THẤT BẠI
```

Win: every anomaly in the run captured. Loss: hearts reach zero. No timer, ever.

---

## 3. Architecture

### 3.1 The load-bearing decision — clean sites, runtime mutation

**The websites are authored clean. Anomalies are applied at run start by a director.**

The alternative — hand-authoring a cursed variant of each page — was rejected: it caps
replay value at one, and it makes the 34-scenario library impossible to reuse across
chapters. With runtime mutation, one honest site plus a shared library of 34 anomalies
gives a different case every play, and an anomaly written once reads differently on six
different sites.

Two markup hooks carry the whole contract:

- **`data-slot="<type>"`** — an attachment point. An anomaly declares which slot types it
  can live on; the director only ever mutates a slot.
- **`data-catch`** — ordinary content that is a *reasonable thing to be suspicious of*.
  This is what makes a wrong capture cost a heart. Headlines, buttons, prices, avatars,
  paragraphs and nav items all carry it. Structural wrappers and whitespace do not.

An element can carry both.

**A slot must never WRAP a navigation link.** `T01`, `T02`, `T03`, `T06`, `S01` and `S05` all
assign to their slot's `textContent`, so a slot placed on a `<h3>` around a card's
`<a data-goto>` destroys that link and makes the item unreachable — `T06` did exactly this to
three cards of the chapter 3 grid, rotting their titles and taking the links with them. The slot
goes **on** the link instead: rewriting the link's own text leaves the element, its `href` and
its `data-goto` intact. There is a test for it across every chapter.

For the same reason a slot should not wrap another slot. Chapter 3's seller card was briefly a
`tile` slot wrapping an `avatar` slot, so a text-rewriting anomaly on the tile would have
deleted the element another anomaly was attached to.

### 3.2 Site isolation — shadow root

The fake site renders into an **open shadow root** on `#viewport`. Site CSS is a real
`.css` file linked *inside* the shadow root (`<link rel="stylesheet">` works there), so each
site's stylesheet can use plain `h1 { }` selectors without ever touching the detective HUD,
and without a build step or hand-prefixed rules.

Site markup lives in an ES module (`sites/ch1-lumiere/page.js`) exporting an HTML template
string, because slots have to be injectable and because the repo has no precedent for
`fetch`ing local files — every existing folder game inlines its content. Keeping markup in
a module also lets `tests/` import a site and assert its slot inventory.

**A page module may also export `behaviour(shadow)`** — how the honest site answers ordinary
interaction. `main.js` calls it after mounting and *before* applying anomalies, matching the
architecture above: clean site first, mutations on top. Site markup may not contain `<script>`
(there is a test), so this hook is the only place that behaviour can live.

It is not decoration. A newsletter form that takes an email and does nothing is an anomaly
**nobody placed** — and worse, it destroys `R05`: if the clean branch is silent, then any
confirmation at all is the anomaly, and the player never has to read it. When both branches
answer, and answer in the same words, same pill, same type size, the only thing separating them
is what the sentence says. That is where the anomaly was always supposed to live. Chapters 2
and 3 need the same hook for their comment form and cart.

Hit testing never uses `elementFromPoint` (which does not pierce shadow boundaries).
It queries `shadow.querySelectorAll('[data-anom]')` and `[data-catch]` and tests their
bounding rects against the lasso polygon. The shadow boundary therefore costs nothing.

### 3.3 The director

At run start, seeded from `Date.now()` (or a URL `?seed=` for reproducible testing):

1. Roll the anomaly count from the chapter's range (§5 — Ch1 rolls 5–6, Ch6 rolls 7–8).
2. Filter the 34-entry registry to anomalies whose `slots` the chapter can satisfy and
   whose `id` is not in the chapter's `exclude` list.
3. Pick, enforcing three constraints:
   - **at least 3 of the 6 families** represented,
   - **at most 2 from any one family**,
   - **at most 1 anomaly per slot element** (no stacking).
4. For multi-page chapters, **cover every non-optional page first**, then fill to the rolled
   count. A page may declare `optional: true` and give up its guarantee.

   The order matters. Covering pages as a fix-up *after* selection means every uncovered page
   ADDS an anomaly beyond the roll, so a five-page chapter advertising 6–8 could hand out nine.
   The briefing tells the player how many things are on the site, and that number is what was
   placed — so placement has to stay inside the range the chapter declares. Covering first,
   then topping up, keeps the rolled count and the placed count the same thing.

   **`optional: true` exists because chapter 3 has fourteen pages.** Six to eight anomalies
   cannot cover fourteen, and should not: a marketplace where every listing has something wrong
   with it is not a marketplace any more. Optional pages still receive anomalies through the
   ordinary fill — they simply are not guaranteed one. The rule keeps its point where it
   matters: the pages a player cannot avoid are never completely clean.

**Anomalies are applied only after the site stylesheet has loaded.** The stylesheet is a
`<link>` inside the shadow root and loads asynchronously, so an anomaly that asks
`getComputedStyle` at apply time sees the bare tag defaults rather than the page's real layout.
`E01` asks whether its slot sits inside a flex container so it does not drop its stray button on
top of the nav links; before the wait it was told "block" and dropped it there anyway, which
reads as a broken page rather than a button someone forgot. `styleReady()` in `site.js` waits,
with a timeout so a dead stylesheet cannot hang a chapter.
5. Call `apply(ctx)` per anomaly, which mutates the DOM and marks what it produced with
   `data-anom="<id>"`.

**Anomaly assignment is fixed for the whole run.** Navigating away from a page and back shows
the same anomalies in the same places — backtracking must be safe, or the player can never
verify a suspicion.

**How multi-page is implemented: every page is mounted at once, and navigation shows one of
them.** Not re-rendered on demand. Re-rendering would lose three things, all load-bearing:

1. **Assignment could not stay fixed.** Re-rendering means re-running `apply()`, and an anomaly
   that draws its word or its position from `rng` would land somewhere else the second time.
2. **Reactive traces would evaporate.** `R01`'s comment and `R06`'s changed label exist only in
   the DOM. Navigating away would erase evidence the player had already earned.
3. **`reconcile()` could not run.** It drops anomalies that failed to attach and runs once at
   start; with a single page mounted it would drop every anomaly belonging to the others and
   silently shrink the evidence count.

Hidden pages cost nothing: `targets()` skips anything `checkVisibility()` reports as hidden, so
they offer no hit targets, and their `IntersectionObserver`s do not fire until shown. Slot
lookup is **per page** — `paragraph[2]` means the third paragraph of *that* page.

`sealNavigation()` still refuses to let the browser navigate, but a link marked `data-goto`
is routed through the page swap instead of merely being blocked. A blog whose post titles do
not open the post is not a blog.

The seeded PRNG is `mulberry32`; every random draw in a run goes through it, so a seed
reproduces a case exactly.

### 3.4 Imagery — hotlinked photographs

The sites use **real photographs, hotlinked from a free image CDN.** Emoji product shots read
as a toy; the whole premise depends on these pages looking like pages. This is a deliberate
departure from the house rule at `CLAUDE.md:56` (*"emoji for all art… no network requests"*)
and becomes its fourth documented exception — see §10.

Three sources, all pinned so the same URL always returns the same photograph:

| Use | Pattern |
|---|---|
| Scenes and objects | `https://picsum.photos/id/<id>/<w>/<h>` |
| Faces, for `avatar` slots | `https://randomuser.me/api/portraits/women|men/<n>.jpg` |
| Keyword search, chapters 2–6 only | `https://loremflickr.com/<w>/<h>/<keyword>?lock=<n>` |

**Revised after the chapter 1 playtest (2026-09-10).** The design originally led with
loremflickr for topical shots. Seen on a real screen, it is the wrong default twice over:

- It **burns an attribution strip and a licence badge into every frame**. Eleven of those on
  one page reads as scraped stock, which is the opposite of the premise — the site has to
  pass as a brand's own.
- Its **keywords do not reliably return the subject asked for**. Chapter 1's four
  `portrait,*` shots came back as one usable portrait, a newsstand, a figure photographed
  from thirty metres, and a black-and-white silhouette holding a camera. That silently
  killed `I03`, which needs two names to share one recognisable face, and one already-grey
  photograph would have made `I01` unwinnable.

picsum is curated, unwatermarked, and `/id/` names a specific photograph; randomuser gives
clean face-forward headshots, which is what a testimonial block actually uses. loremflickr
stays in `img.js` for later chapters that want keyword search, but a caption must never be
written against a loremflickr URL nobody has looked at.

**Pinning is not optional.** `S05 anh-khong-khop-chu-thich` writes a caption that contradicts
the photograph, and the new IMAGE family compares one photo against another. A random image
per load makes both unauthorable.

**Every `<img>` must degrade.** `magic-shooter.html` sets the precedent — a CDN game in this
repo ships a tested CDN-failure fallback. Each image carries an `onerror` that swaps in a
procedural SVG placeholder (layered gradients, `feTurbulence` grain, vignette) tinted to the
site's palette. A player who is offline, behind a filtering network, or hitting a dead CDN
gets a muted, stylised site — not a page of broken-image icons. **The fallback path is a
playtest gate in its own right:** load every chapter once with the network throttled to
offline and confirm each site still reads as a site.

Emoji do not disappear — they stay where a real site would use an icon (feature bullets, nav
glyphs, status dots), which is also what keeps `S07 emoji-lac-loai` legible.

**Faces:** portraits are used only at small sizes and for `avatar` slots, and no anomaly ever
captions a real person as dead, cursed or missing. `T05`'s tooltip and `T08`'s byline attach
to names and text, not to a face. This is a content rule, not a technical one, and it exists
because these are photographs of real people who did not consent to a horror game.

**Captions are written against the photograph, never the other way round.** This is the rule
the blind-URL problem above was violating. A clean caption that already contradicts its photo
poisons `S05`, whose entire job is to be the one caption that does not match: if four of the
five disagree anyway, the anomaly is invisible. Look at the image, then write the caption.
Chapter 1's images were re-picked on this basis and verified on screen; chapters 2–6 have not
been, and every new `photo` slot needs the same pass.

### 3.5 Flavour pools

An anomaly is generic; its *text* is chapter-specific. Each chapter exports pools keyed by
anomaly id, so `T01 loi-nguyen-chen-giua` on the skincare site splices a line about mirrors,
and on the school site splices a line about children arriving early. Pools are what make one
library serve six genres without reading as copy-paste.

```js
// shape
{ id: "T01", family: "TEXT", slots: ["paragraph"], weight: 3,
  apply(ctx) { /* ctx = { root, slot, rng, flavour, mark, observe } */ } }
```

`ctx.mark(el)` sets `data-anom` and registers the element with the run. Anomalies never
**mutate** run state — they cannot award a capture, cost a heart, or end a chapter.

`ctx.observe` is a **read-only** view of the run — `{ hearts, found, total }` plus a subscribe
hook — added for `T04 trang-web-biet-ve-ban`, whose Ch6 variant has the site quote the game's
own state back at the player. It is the only channel between the run and an anomaly, it goes
one way, and it exists so that one anomaly can be uncanny without any anomaly being able to
cheat.

**Anomaly modules may touch the DOM only inside `apply()`.** Never at module top level: the
`registry.js` that imports all 34 of them is itself DOM-free and is imported directly by
`tests/`, so a stray top-level `document` reference in any one anomaly file breaks the whole
suite. This is the same contract `monster-battle`'s engine region keeps, and the bare import in
the test file is what proves it.

---

## 4. Two modes, and what a circle claims

### 4.1 The mode toggle

The page has two modes, switched by a single HUD button (`CHẾ ĐỘ KHOANH`, off by default):

- **CHẾ ĐỘ ĐỌC** — the ordinary web. Scroll, click links, submit forms, type, and *drag-select
  text*. Nothing here can cost a heart, ever. All experimentation lives in this mode.
- **CHẾ ĐỘ KHOANH** — the overlay arms. The cursor becomes a crosshair, the page takes a faint
  vignette so the mode is never ambiguous, and pointer-drag draws instead of selecting.

This separation is not just ergonomics — it is what makes `S03 chu-chon-duoc-nhieu-hon`
possible at all. That anomaly is found by drag-selecting a headline and seeing hidden words
appear under the selection. If dragging always meant "lasso", the player could never select
text and `S03` would be undiscoverable. One overloaded gesture cannot serve both verbs.

Scrolling still works in capture mode (wheel / two-finger / scrollbar); the overlay uses
`touch-action: none` and pointer capture so a stroke never scrolls the page.

### 4.2 Drawing, and the size cap

In capture mode: pointer-down anchors the stroke, drag draws a freehand path on a `<canvas>`
overlay above the shadow host, pointer-up closes it into a polygon.

**The overlay draws exactly one thing: the player's own stroke.** No budget rectangle, no
closing-tolerance ring, no guide furniture of any kind. Both rules below are still communicated
by the drawing rather than by punishment — that part was never in question — but through the
**colour of the line itself**. An earlier build drew a dashed box for the size cap and a dashed
ring for the closing tolerance, and the result was that every capture turned into a diagram
laid over the page. The player is supposed to be looking at the website.

**The stroke is an open path, and the closing line is never painted.** An early build called
`closePath()` before stroking, which draws a straight chord from the cursor back to the anchor —
a hard line cutting across the page that follows the cursor the whole way round. A playtester
read it as part of their own drawing, and it is not: it is the renderer guessing at a shape that
has not been made yet. Once the loop *would* close, the enclosed region is shown by **filling**
it faintly — `fill()` closes the path implicitly, so the area being claimed is visible without a
line drawn across the stroke.

**A loop must come back to where it started.** Finish near the anchor and the gesture is a
claim; stop short and the stroke is voided. The tolerance is **relative** — `max(28px, 25% of
the stroke box's diagonal)` — because the same 40px gap is a rounding error on a 300px loop and
a gaping hole on a 50px one.

So the line carries all of it: **grey** while the loop is still open, **green** the moment it
would close, **red** once it is past the budget. It is drawn over a light halo so it reads on
both a cream landing page and Ch6's black dashboard.

Closure is judged **only on release**. A loop in progress is open almost the whole way round,
so applying the rule live would blank the aim outline for all but the last few pixels of every
stroke — hiding the one thing the preview exists to show.

**A circle has a maximum extent** — a bounding box of roughly 300×200px, clamped further on
small viewports. This is the rule that guarantees **one anomaly per circle**: the player cannot
sweep one enormous loop around the whole page and take everything at once. The limit is
communicated by the drawing itself rather than discovered by being punished — the stroke turns
red the moment it crosses the cap, while the player is still holding the button down.

### 4.3 Resolution — exactly one target

On release, collect every `[data-anom]` and `[data-catch]` element whose bounding-rect centre
lies inside the polygon (ray-casting point-in-polygon). Centre-in-polygon rather than full
containment: circling a long headline should not require enclosing every pixel of it.

Then **score exactly one** — the element whose centre is nearest the polygon's centroid. Even
if a tight loop happens to catch two neighbours, the claim resolves against the one the player
most plainly meant.

| Nearest enclosed element | Result |
|---|---|
| a `[data-anom]` | ✔ `BẰNG CHỨNG ĐÃ GHI` — counter ticks, heart kept |
| a `[data-catch]` | ✘ `KHÔNG CÓ GÌ Ở ĐÂY` — **−1 ♥** |
| nothing enclosed at all | ✘ `KHÔNG CÓ GÌ Ở ĐÂY` — **−1 ♥** |

A circle is a claim, and an empty circle is a wrong claim. There is no free probing: the
player cannot sweep the page with cheap loops to map where the anomalies are not.

**Three gestures are voided before they ever become claims,** and none costs a heart:

- a stroke under ~12px across — that is a twitch or a stray click, not a circle. Feedback:
  `NÉT QUÁ NGẮN`.
- a stroke that exceeded the size cap — the line turned red while they were drawing it.
  Feedback: `VÙNG KHOANH QUÁ RỘNG`.
- a loop that never came back to its anchor (§4.2) — the player did not finish the gesture,
  and closing it for them would score a claim they never committed to. Feedback:
  `VÒNG CHƯA KHÉP`, which is now used for its literal meaning.

These are input handling, not scoring mercy: all three are rejected *before* hit-testing, so
none reveals anything about the page. They cannot be used to probe — and neither can the live
aim outline, which names *what* is under the loop but never whether it is an anomaly.

Captured anomalies keep a persistent evidence ring and a case number, so the player can see
what they have already claimed.

---

## 5. Chapters

Six sites, chosen so the same anomaly family reads differently in each. Sequential unlock:
clearing chapter N unlocks N+1. Each clear stores a rank.

| # | Site | Pages | Anomalies | Register | Threat |
|---|---|---|---|---|---|
| 1 | **LUMIÈRE** — kem dưỡng ẩm | 1 | 5–6 | landing page bán hàng | Cult |
| 2 | **Bếp Nhà Mây** — blog nấu ăn | 5 | 6–8 | blog cá nhân | Người đã mất |
| 3 | **SănĐồCũ.vn** — chợ đồ cũ | 3 | 6–7 | thương mại điện tử | Monster |
| 4 | **Hồ Vắng** — khu du lịch sinh thái | 1 | 7–9 | trang đặt phòng | Alien |
| 5 | **Tiểu học Hoa Ban** — trang thông báo | 1 | 6–8 | trang cơ quan | Cult |
| 6 | **MegaLink** — trạng thái hệ thống | 1 | 7–8 | dashboard kỹ thuật | Thứ trong đường truyền |

**Rank** per chapter, stored in `localStorage`:

- **S** — cleared with 3 ♥
- **A** — cleared with 2 ♥
- **B** — cleared with 1 ♥
- **—** — not yet cleared

The chapter select is styled as a case archive: cleared chapters show rank, best seed and
capture count; locked chapters show only a redacted title.

### 5.1 Chapter 1 — LUMIÈRE

Single page. A French-styled Vietnamese skincare landing page: hero with product shot, three
benefit cards, an ingredient list, two testimonials, an FAQ accordion, a newsletter box,
footer. Palette cream and rose, everything tasteful. The copy is real marketing copy —
*"Dưỡng ẩm 72 giờ. Chiết xuất hoa cúc La Mã. Không cồn, không hương liệu."*

Slots: `nav`, `hero-title`, `paragraph` ×4, `price`, `cta`, `photo` ×4 (hero sản phẩm +
3 thành phần), `avatar` ×2 (2 lời chứng thực), `feature-icon` ×3, `faq`, `footer`, `newsletter`.

Imagery: `loremflickr.com/…/skincare?lock=…` for the hero and ingredients, portraits for the
two testimonials.

The tutorial chapter: it opens with a briefing overlay teaching the two modes — read freely,
press the button to claim, an empty circle costs a heart just as a wrong one does — and its
first run is forced to include `S07 emoji-lac-loai` — the most legible anomaly in the
library — so the player learns the verb on something unmistakable.

### 5.2 Chapter 2 — Bếp Nhà Mây · BUILT

**Five pages, not two.** `index` (post list, sidebar, a *"Tưởng nhớ Mây (1994–2021)"* widget),
`post` (the full recipe — author byline, nine comments, a comment form), and one page for each
of the other three post cards.

The original sketch had one article and three cards that went nowhere. On screen that is not a
shortcut, it is a **broken site**: a post card that does nothing when clicked is an anomaly
nobody placed, and the worst kind — the player circles it, loses a heart, and the results
screen tells them they were wrong. The three extra posts are short, which is what short posts
on a real blog look like, and each is a full anomaly surface like any other page.

**The recipe is a *gỏi bắp cải tím*, not *canh chua cá lóc*.** Photo first, copy second — the
rule §3.4 records after chapter 1 had to learn it the hard way. The photograph that reads best
as a home-cooked Vietnamese dish is a clay bowl of purple cabbage, red onion, chillies and
coriander. There is no fish in it, so writing "canh chua cá lóc" underneath would have been the
exact mismatch `S05` exists to create — and a clean caption that already contradicts its photo
makes `S05` invisible.

Slots as built, per page — the director indexes them per page, so they are declared that way:

| | `index` | `post` | `post-cho` | `post-toi` | `post-banh` |
|---|---|---|---|---|---|
| `post-title` | 4 | 1 | 1 | 1 | 1 |
| `date` | 4 | 1 | 1 | 1 | 1 |
| `photo` | 4 | 1 | 1 | 1 | 1 |
| `paragraph` | 2 | 4 | 2 | 2 | 2 |
| `byline` | — | 1 | — | — | — |
| `avatar` | — | 3 | — | — | — |
| `comment` | — | 9 | 3 | 2 | **—** |
| `comment-form` | — | 1 | 1 | 1 | 1 |
| `footer` | 1 | 1 | 1 | 1 | 1 |

**Every post takes comments, including the one that has none.** The same handful of regulars
turn up under several posts, which is what a small blog looks like — but each comment is
written fresh, because the identical sentence appearing under two posts reads as a duplication
bug, and a player who spots it will circle it and lose a heart for noticing something real.
There is a test for that.

`post-banh` has **no comments at all** and still has a form. A post nobody has replied to yet is
the most ordinary thing on a small blog, and the empty state has to look ordinary too. The
"chưa có bình luận nào" line hides itself with CSS `:has(.cmt)` rather than JavaScript, so it
gets out of the way whether the first comment arrives from the site's own `behaviour()` or from
`R01` — no two places have to remember to remove it.

Four comment forms means `R01` can land on any of them, so the trick has to be tried on the
right post. Experimenting is free, so that is four free experiments, not four risks.

Every page can host at least three of the six families, which the director needs in order to
satisfy "≥3 families" *and* "every page carries at least one" on the same run.

**The sidebar is split.** The memorial carries no slot and never may: `T08` measures a byline
against its *"1994 – 2021"*, so a director that could rewrite that line would be moving the
ruler. It is also the chapter's most expensive trap — the most emotionally loaded thing on the
page, and never the answer, which is how the player learns that *sad* does not mean *wrong*.

The **archive** beside it is a real surface: its four month rows are `date` slots. Before that
the whole sidebar was ten `data-catch` elements and no slots — a region that could only ever
punish. Because the sidebar is identical on all five pages, a wrong month on **one** page is
found either by reading it or by comparing pages, which is the cross-reference horror this
chapter is built around.

`T07` therefore learned a third timestamp shape, `month` (*"Tháng 3, 2026"*), alongside `time`
and `date`. A pool key with no matching shape in the markup means `T07` attaches to nothing and
is dropped by `reconcile()` — silently, after the evidence counter has already been advertised
— so there is a test tying every declared pool key to a shape that actually appears.

One trap worth recording: the archive's post-count `<span>` was styled by tag, and `T07` wraps
its corrupted text in a `<span>` too — so the anomalous row rendered a shade lighter than its
neighbours and could be spotted **without being read**. The count is selected by class now.
This is the same failure as `R05`'s inline `font-size`: a text anomaly must never be
identifiable by looking rather than reading.
`footer` is declared once **per page** rather than once per chapter, because both pages have one.

Imagery: `picsum.photos/id/…` (see §3.4 — loremflickr is not used).

Home of `R01 binh-luan-khong-ten`. The memorial widget is authored clean and always present —
it is what makes `T08 chu-ky-nguoi-da-chet` land, and on runs where that anomaly is not drawn
it is simply a sad detail. That asymmetry is intentional: the site must be able to be sad
without being wrong. It appears on **both** pages and carries no `data-slot`, so the director
can never rewrite the very line the anomaly is measured against.

**The memorial has no photograph.** §3.4 forbids captioning a real person as dead, and a
portrait beside "1994 – 2021" would do exactly that. Text only.

`T08` and `R01` both need a markup hook: a name sits in `[data-who]` and its timestamp in
`[data-when]`, so `T08` can mark **the name** — the thing the player actually noticed — rather
than blanking a whole comment.

### 5.3 Chapter 3 — SănĐồCũ.vn · BUILT

Three pages: `listing` (grid of 12 second-hand items), `product` (one item, seller card,
description, Q&A), `cart` (line items, shipping form, total).

Slots as built, per page:

| | `listing` | `product` | `cart` |
|---|---|---|---|
| `nav` | 1 | 1 | 1 |
| `product-title` | 12 | 1 | — |
| `price` | 12 | 1 | 1 |
| `photo` | 12 | 1 | — |
| `paragraph` | 1 | 2 | 1 |
| `date` | — | 1 | — |
| `tile` | — | 1 | — |
| `avatar` | — | 3 | — |
| `comment` | — | 4 | — |
| `cta` | — | 1 | 1 |
| `cart-line` | — | — | 1 |
| `shipping-form` | — | — | 1 |
| `footer` | 1 | 1 | 1 |

Two renames from the sketch, both to avoid **dead slot types**. `qa` became `comment`, because
no anomaly in §6 accepts `qa` while `T08` already accepts `comment` — and a Q&A thread is a
better home for a signature than the sketch realised. `seller` became `tile`, which `M01`,
`M03`, `S07`, `T03` and `T04` all accept. A declared slot type that no anomaly can use is a
region of the page that can only ever cost the player a heart.

The product page carries **three** avatars (the seller plus two of the four askers) rather than
one, so `I03` — which needs two faces on a page — has a home here.

Imagery: twelve pinned `picsum` shots of twelve unrelated objects — a camera, a typewriter, a
wall clock, a child's tricycle, a chair, a speaker, a book, a desk lamp, an enamel mug, coloured
pencils, hand tools, picture frames. Second-hand listings photographed by twelve different
people is exactly the visual incoherence a real marketplace has, and it is the best camouflage
in the game: on a page where every photograph already clashes, one more that clashes does not
stand out. There is a test that no two goods share a photograph.

Home of `R02 gio-hang-tu-them`. The listing grid's sheer volume of prices and titles makes
this the chapter where `T03 dem-nguoc-trong-van-ban` and `T06 chinh-ta-sai-tang-dan` are
hardest to spot — twelve cards of noise.

**The cart is real state that survives navigation.** Pressing "bỏ vào giỏ" on the product page
adds a line to the cart page and updates the badge on all three navs. Without that, `R02` has
nothing to hide behind: if the cart never changes, then *any* change is the anomaly and the
player never has to read what the extra line is or who is selling it.

**A closed-account notice on the cart page is clean content and always present** — the same job
chapter 2's memorial does. It says Hạnh's account closed in 02/2024, which is the only thing
that makes `T08` mean anything when a Q&A question turns up signed "Hạnh · vừa xong". On runs
without `T08` it is just a dull line of marketplace housekeeping.

### 5.4 Chapter 4 — Khu du lịch sinh thái Hồ Vắng · BUILT

Single long page. An eco-resort on a lake at the end of a provincial road outside Đà Lạt:
full-bleed hero, a conditions strip, four reasons to come, two room types, a six-photo
gallery, a booking widget, five house rules, a map block with coordinates, three reviews,
footer.

**Its design language is deliberately nothing like chapter 1's, and that is a rule of the
game rather than a matter of taste.** The premise is that each case file opens a *different*
website, built by different people. Two chapters sharing one visual language read as "the
same page again with new words", and behind that comes the suspicion that all six were
invented by one hand — a suspicion which is true, and which kills the question every anomaly
lives on: *"…or is the site just like that?"* So the two sites are opposites on every axis
that reads at a glance:

| | Ch1 · LUMIÈRE | Ch4 · HỒ VẮNG |
|---|---|---|
| palette | cream, rose accent | white paper + forest-dark bands, ochre accent |
| headings | serif | light sans, very large |
| surfaces | 18px rounded cards, soft shadows | square corners, no shadows, 1px hairlines only |
| hero | split image / copy | full-bleed 92vh photograph, transparent nav over it |
| rhythm | even grids | numbered sections 01–07, room photos bleeding off the page edge |
| gallery | even 3×2 | offset mosaic, 4+2 / 2+2+2 / 6 |

That comparison was drawn from how boutique-hotel and lodge sites actually look now:
full-bleed cinematic heroes, magazine and broken-grid sections, dark-with-accent palettes,
whitespace instead of visible card chrome, and rich offset galleries.

**The hero photograph sits under its own separate scrim layer, not behind a cropped
background.** `I01` can rotate that photograph 35–176°; if the darkening came from a filter
on the image itself, the white headline would drop onto bright water and stop being legible
the moment the anomaly fired. A layer that does not rotate keeps the page readable while the
photograph goes visibly wrong — which is the whole point of `I01` landing there.

Slots as built — 52 of them on one page, which is why the roll is 7–9 rather than chapter 1's
6–8 over 36:

| slot | n | where |
|---|---|---|
| `nav` | 1 | transparent header over the hero |
| `hero-title` | 1 | |
| `paragraph` | 7 | hero lead + one per numbered section |
| `tile` | 4 | the "hôm nay bên hồ" conditions strip |
| `feature-icon` | 4 | the four reasons |
| `photo` | 4 | hero, two rooms, the pass road |
| `gallery-caption` | 6 | the mosaic |
| `price` | 2 | two room types |
| `date` | 3 | price list, gallery update, rules issue date |
| `hours` | 3 | reception, restaurant, boat dock |
| `notice` | 5 | the house rules — `T06` decays down the list |
| `booking-form` | 1 | |
| `map` | 1 | the only `map` slot in the game |
| `avatar` | 3 | three reviewers |
| `comment` | 3 | three review bodies, each with `[data-who]` / `[data-when]` |
| `cta` | 3 | book, see all photos, call reception |
| `footer` | 1 | |

`review` from the original sketch was **renamed to `comment`**, for the same reason `qa` was in
chapter 3: no anomaly in §6 accepts `review`, so declaring it would have created a region of
the page that could only ever cost the player a heart. As `comment` it is a home for `T08`.

**The lost-property notice is clean content and always present** — the same job chapter 2's
memorial and chapter 3's closed-account line do. It says a guest checked in on 14/08/2023 and
has not checked out, which is the only thing that makes `T08` mean anything when a review turns
up signed with that name "vừa xong". It carries no `data-slot` and never may. Note what it does
*not* say: nobody is described as dead or harmed (§3.4). A guest who never completed checkout is
lost-property housekeeping — and it is more unsettling for staying inside that register.

Home of four anomalies that had no site to live on before:

- **`R04 xac-nhan-thua-khach`** — the booking widget, which spec §6 always reserved for it.
- **`T09 toa-do-troi`** — the map block. Chapter 4 is the only chapter with a `map` slot.
- **`M06 anh-sang-di-qua-anh`** — seven photographs, more than any other chapter.
- **`E03 muc-menu-thu-mot-mot`** — chapters 1 and 3 have navs too and now carry pools for it.

`I02 anh-doi-khi-quay-lai` was built alongside them and is eligible in all four chapters.

The honest page pre-loads ordinary explanations for everything the Alien register will later
abuse: the resort really has no phone signal, the sky really is dark because there are no
street lights within 3 km, and a reviewer has already written that satellites pass over at
this time of year. An anomaly here never has to shout. It only has to stand next to a
reasonable explanation and refuse to fit inside it.

Imagery: ten pinned `picsum` photographs and three `randomuser` portraits. Captions were
written against the photographs after looking at them, per §3.4.

### 5.5 Chapter 5 — Trường Tiểu học Hoa Ban

Single page, deliberately ugly in the way real Vietnamese school sites are: a marquee header,
a red-bordered notice table, a *"Thông báo mới nhất"* list of eight dated items, a principal's
message, a photo strip from a khai giảng ceremony, a visitor counter, and a footer with a hit
counter and a `Best viewed in 1024×768` line.

Slots: `notice` ×8, `date` ×8, `paragraph` ×2, `photo` ×4 (ảnh lễ khai giảng),
`gallery-caption` ×4, `avatar` (ảnh hiệu trưởng), `cta` (*"Xem tất cả thông báo"*), `nav`,
`counter`, `footer`, `marquee`.

Imagery: `loremflickr.com/…/school,classroom?lock=…`, deliberately low-resolution and slightly
over-compressed, the way a school site's photographs always are. Per §3.4, no photograph here
is ever captioned as a missing or harmed child.

The hardest chapter tonally, and it has one rule: **nothing happens to a child on screen.**
The horror is entirely in what the administration writes down and how calmly it writes it —
dates that do not exist, attendance arithmetic that does not close, a notice addressed to the
parents of students who are not listed. Institutional voice doing all the work.

### 5.6 Chapter 6 — MegaLink — Trạng thái hệ thống

Single page: a status dashboard. Eight service tiles (`Hoạt động bình thường`, green), a
90-day uptime bar per service, an incident history list, a live latency number that updates
every two seconds, a subscribe box.

Slots: `nav` (có ô tìm kiếm), `tile` ×8, `uptime-bar` ×8, `incident` ×5, `latency`,
`paragraph` ×2, `subscribe`, `footer`.

Imagery: **none.** A status dashboard has no photographs, so `photo` and `avatar` are absent
and the whole IMAGE family is ineligible here — the finale is pure text, colour and motion.
That is a deliberate tonal choice as much as a realistic one: after five chapters of looking
at pictures, the last site has nothing to look at.

The finale, and the only chapter where the page is *already* moving on its own — the latency
number ticks, tiles pulse on refresh. Genuine motion as camouflage for the MOTION family,
which is why it rolls 7–8. Home of `R05 huy-dang-ky-khong-huy`.

---

## 6. The anomaly library — 35 designed, 29 built

Six families. `slots` lists what the anomaly can attach to; the director only offers it to a
chapter that has one. The flavour lines below are the authored pools, not placeholders.

The brief asked for 30. The library grew to 34 when the sites gained real photographs (§3.4),
which made a sixth family possible — those four were the only additions. The chapter 1
playtest then traded one for one: `S04` was **withdrawn** and `R06` was **added**, so the
library stayed at **34** — STYLE dropped to 6, REACTIVE rose to 6.

Chapter 4 moved it twice more. `T04` had already been **withdrawn** at the player's request,
taking TEXT to 7; building chapter 4 added `T09 toa-do-troi` (TEXT back to 8) and
`M06 anh-sang-di-qua-anh` (MOTION to 6), so **35 are designed and 29 are built**. Both new
ones exist because chapter 4 is the first site with a surface for them: it is the only chapter
with a `map` slot, and it carries more photographs than any other.

### TEXT — 8 (T04 withdrawn, T09 added)

**T01 · `loi-nguyen-chen-giua`** — slots: `paragraph`, `notice`
One sentence inside an ordinary paragraph is replaced with a liturgical or cursed line, in
the same font, the same size, the same rhythm. Reads as normal copy until parsed.
- Ch1: *"Thoa đều lên da mặt mỗi tối, tránh vùng mắt. Đừng thoa lên gương. Gương sẽ thoa lại."*
- Ch4: *"Hồ sâu 4 mét ở khu vực trung tâm. Chúng tôi đã ngừng đo vào năm 2019."*
- Ch5: *"Kính mong quý phụ huynh đưa đón đúng giờ. Nếu con quý vị đã ở trong sân trước 6 giờ sáng, đó không phải con quý vị."*

**T02 · `chu-thay-doi-khi-doc-lai`** — slots: `paragraph`, `post-title`, `notice`
An `IntersectionObserver` swaps the text when the element leaves and re-enters the viewport.
The second version is worse, and there is no third.

**Authoring rule — the rewrite must change the *shape* of the block, not a character in it.**
Different length, different line count, or different punctuation, so that peripheral vision
registers *"that paragraph is not the one I scrolled past"* without the player having
memorised it. A one-digit or one-word edit fails this test: it demands the player recite the
page from memory, which is not observation, it is luck. Every pool entry below is visibly
longer than what it replaces, and every one changes voice — institutional to personal, or
plural to singular — because a change in **who is speaking** is what the eye catches when it
cannot catch a digit.

- Ch5: *"Toàn trường có 412 học sinh, 24 giáo viên và 8 phòng học."*
  → *"Toàn trường có 412 học sinh. Chúng tôi không biết em thứ 413 vào bằng lối nào. Chúng tôi đã đếm lại bốn lần."*
- Ch2: *"Mẹ tôi dạy tôi công thức này từ hồi tôi còn bé."*
  → *"Mẹ tôi chưa bao giờ nấu món này. Tôi không biết tôi học nó ở đâu. Tôi đã nấu nó ba lần trong tuần này."*
- Ch1: *"Sản phẩm phù hợp với mọi loại da."*
  → *"Sản phẩm phù hợp với mọi loại da. Kể cả da không còn ở trên người."*
- Ch4: *"Hồ Vắng đón khách quanh năm."*
  → *"Hồ Vắng đón khách quanh năm. Chưa có mùa nào tất cả khách đều về."*

**T03 · `dem-nguoc-trong-van-ban`** — slots: `paragraph`, `price`, `tile`
A number embedded in body copy decrements roughly every nine seconds. Nothing on the page ever
acknowledges it. The horror is not that it reaches zero — it is that the number **stops being
the kind of thing that can be counted**, while the sentence around it stays perfectly polite.

Five phases, each held for a few ticks. The sentence never changes; only the number does:

| Phase | Values | What it reads as |
|---|---|---|
| 1 · đếm ngược thật | 12 → 11 → 10 → 9 | an ordinary urgency widget |
| 2 · phân số | 8,5 → 8,25 → 8,125 → 8,0625 | it is halving, not counting — nothing is leaving, something is being *divided* |
| 3 · âm | 0 → −1 → −4 → −11 → −47 | fewer than none, and accelerating |
| 4 · ký hiệu khoa học | −1,7e3 → −4,4e9 → **6,02e23** | a number no shopping page has ever needed |
| 5 · không còn là số | `∅` → `NaN` → `∞` → `∅` | it gives up on being a quantity at all |

Phase 4's landing value is deliberate: **6,02e23** is Avogadro's number. *"Còn 6,02e23 người
đang xem món này"* does not read as a bug — it reads as *everything, all at once, is looking at
this*. A player who recognises it gets the worst moment in the chapter; a player who does not
still sees a number that has no business being there.

- Ch3: *"Còn **12** người đang xem món này"*
- Ch4: *"Còn **8** phòng trống cho cuối tuần này."*
- Ch6: *"**412** người dùng đang kết nối tới cụm máy chủ Hà Nội."*

Formatting follows Vietnamese convention throughout — comma as the decimal separator — because
the moment it renders `8.5` instead of `8,5` it stops looking like a Vietnamese site's own
widget and starts looking like a bug in the game.

**T04 · `trang-web-biet-ve-ban`** — ~~slots: `paragraph`, `tile`, `footer`~~
**WITHDRAWN at the player's request (2026-09-12).** It read things the browser genuinely knows
— timezone, viewport, core count, language — and said them back. Removed from the registry
along with the `FACTS` table that only it used, and from all three chapters' flavour pools. The
design below is kept, including the fourth-wall Ch6 variant, in case it is ever restored.
**TEXT is 7.**
*(was `goi-ten-nguoi-choi`, a clock reading — replaced: the hour is the least interesting
thing a browser knows about you, and a line that only says "it is 23:00" is a parlour trick
the player dismisses in a second.)*

The site states, flatly and in customer-service register, something about the player it has no
business knowing — and every one of these is **true**, obtained from the browser with no
network and no storage. The line is not a threat. It is a page being helpful.

The anomaly draws **two** observations from the pool at spawn. Each appears only once its
condition is met, so the paragraph the player first read was innocent — then it grows a
sentence. Once it appears it stays, so it can be circled.

| Observation | Source | Line |
|---|---|---|
| múi giờ | `Intl…resolvedOptions().timeZone` | *"Chúng tôi rất vui được phục vụ khách hàng ở khu vực Asia/Ho_Chi_Minh."* |
| cỡ màn hình | `innerWidth × innerHeight` | *"Trang này hiển thị đẹp nhất ở 1512×982. Đúng bằng màn hình của bạn."* |
| rời tab | `visibilitychange` đếm | *"Bạn đã rời khỏi trang này 3 lần. Chúng tôi vẫn đợi."* |
| bất động | không có `mousemove` 45s | *"Bạn vẫn ở đó chứ? Bạn đã không cử động trong 47 giây."* |
| cuộn qua | `IntersectionObserver` đếm | *"Bạn đã cuộn qua đoạn này hai lần mà không đọc."* |
| hệ điều hành | `navigator.platform` | *"Bản dành cho máy của bạn đang được chuẩn bị. Chúng tôi biết bạn cần nó."* |
| số nhân | `hardwareConcurrency` | *"Máy của bạn có 8 lõi. Chúng tôi chỉ cần một."* |

**And the one that breaks the fourth wall — reserved for Ch6, at most one per playthrough:**
the site reads the *game's* state and refers to it.

- *"Bạn còn 2 trái tim."*
- after a wrong capture: *"Bạn vừa khoanh nhầm. Không sao. Chúng tôi cũng không chắc."*
- at 5 of 7 captured: *"Bạn đã tìm được 5. Bạn có chắc chỉ có 7 không?"*

This is the single strongest line in the library and it is rationed accordingly: a fake website
acknowledging the detective game around it only works once, and only in the finale, where the
premise has already collapsed. Used earlier it would teach the player that the sites are aware,
which is exactly the suspicion the first five chapters are built to withhold.

**Constraint:** every line must be something the browser genuinely knows. Nothing invented,
nothing about the player's identity, location beyond a timezone string, or anything the page
would have to phone home for. A bluff is guessable; a true statement is not.

**T05 · `van-ban-an-trong-tooltip`** — slots: `avatar`, `gallery-caption`, `product-title`, `photo`
The visible caption says one thing; a line hiding behind it — surfaced only by hovering — says
another, and the other one is the truth. The page never corrects what it wrote. It just adds
something, for you.

**The site draws this tooltip itself; it is not a `title=` attribute.** The native tooltip
waits nearly a second, renders in the system font, and looks like part of the *browser* — and
a playtester reported simply not understanding what the anomaly was. Anything that reads as
browser chrome cannot read as a symptom of the page. It now appears after 180ms, under the
cursor, in the site's own typeface. The static tell (a faint dotted underline) stays: without
it the anomaly is findable only by hovering every element on the page, and since a win needs
*all* anomalies, an undiscoverable one does not make a run hard — it makes it unwinnable.
- Ch1: visible *"Khách hàng hài lòng"* / tooltip *"cô ấy chưa rời phòng thử kể từ tháng 3"*
- Ch4: visible *"Bình minh trên hồ"* / tooltip *"chụp lúc 2 giờ sáng"*

**T06 · `chinh-ta-sai-tang-dan`** — slots: `notice` (list), `product-title` (grid) · BUILT
Diacritics decay down a list. The first item is perfect Vietnamese; each subsequent item loses
more `dấu` until the last is bare consonants — the site forgetting how to write.
- Ch5: *"Thông báo nghỉ lễ"* → *"Thong bao nghi le"* → *"thng bo ngh l"* → *"t b n l"*

**T07 · `ngay-thang-khong-ton-tai`** — slots: `date`, `incident`, `hours` · BUILT
A date or a time stated flatly that cannot exist, or should not: `31/02/2019`, `00/00/0000`, a
post dated tomorrow, an incident resolved before it began.
- Ch2: *"Đăng ngày 31/02/2019"*
- Ch6: *"Sự cố #4471 — bắt đầu 03:12, đã khắc phục lúc 03:04."*
- Ch1: a shop's opening hours — *"09:00 – 24:60"*, *"08:00 – 09:-30"*, *"08^2:00 – 20:00"*

Its flavour pool is **keyed by the shape of the stamp** — `{ time: [...], date: [...] }` —
and the two are never mixed. A clock reading dropped into a date field does not read as a date
that cannot exist; it reads as corrupt data, and corrupt data is something players skip past.

The `hours` slot is the best surface it has: three shops listed side by side in one identical
`HH:MM – HH:MM` template, so the eye reads all three as a block and nobody checks the digits.
**Only the closing time is ever corrupted.** A line wrong at both ends reads as junk data; a
line that starts correct and then goes wrong reads as a shop that really does close then.

**T08 · `chu-ky-nguoi-da-chet`** — slots: `byline`, `comment`, `notice` · BUILT
A byline or signature belonging to someone the same page says is gone. Pure cross-reference
horror — it requires the chapter to have authored the memorial line as ordinary content.
- Ch2: byline *"Mây · 3 ngày trước"* against the sidebar's *"Tưởng nhớ Mây (1994–2021)"*
- Ch5: a notice signed by a principal the *"Lịch sử nhà trường"* block lists as former.

**T09 · `toa-do-troi`** — slots: `map` · Ch4 · BUILT
The coordinate pair printed beside the map does not stay where it is. Its first state is
exactly what the markup says, so the first read gives the player nothing to doubt. Every time
they scroll away and come back it has moved a little further — seconds of arc, then minutes,
then a hemisphere — and the last step stops at a latitude that does not exist on Earth
(`91°04′22″B`) or at something that has stopped being a coordinate at all (`—°—′—″`).

**It moves only while nobody is looking.** A number that ticks in front of the player reads as
a widget, as something the site is *doing on purpose*. A number that is merely different when
you come back cannot be read as a feature at all, and it forces them to rely on what they
remember reading — which is the thing this entire game asks for.

It is the only anomaly that walks through **several** states rather than changing once: `T02`
swaps and is done, while this leaves a trail the player can confirm by scrolling around a few
more times. The final step is a **stop**. If it drifted forever the player could never know
they had seen enough of it.

### STYLE — 6 (S04 withdrawn)

**S01 · `mot-chu-khac-font`** — slots: `paragraph`, `hero-title`, `notice`
One word inside a sentence renders in a different generic family (`cursive` / `fantasy` /
`monospace`) with altered letter-spacing. No webfonts — the fallback stacks do it. Usually
the word is an ordinary one; that is the point. *"Chúng tôi rất **mong** được phục vụ."*

**S02 · `mau-rut-dan-khi-cuon`** — slots: any section-level slot
A section desaturates as it scrolls into view (`filter: saturate()` driven by scroll position)
and does not recover on the way back. The page loses colour behind you.

**S03 · `chu-chon-duoc-nhieu-hon`** — slots: `hero-title`, `post-title`, `notice`
Selecting the text reveals more text than is rendered — an absolutely-positioned layer at
`opacity: 0` that `::selection` makes visible. Drag-selecting a headline shows words
underneath it. Found only by players who select text while they read, which is possible only
because CHẾ ĐỘ ĐỌC leaves dragging to the browser (§4.1).

**S04 · `bong-do-sai-huong`** — ~~slots: `tile`, `avatar`, `cta`, `product-title`~~
**WITHDRAWN after the chapter 1 playtest (2026-09-10).** Every shadow on the page falls one
way; one card's `box-shadow` falls the other. On screen it does not read as a symptom — it
reads as a card styled slightly differently, which every real site has. It fails §1's test in
reverse: the answer to *"…is that just how the site is?"* was always **yes**, so the anomaly
was only ever a heart tax on players who noticed it and doubted themselves. Deleted from the
registry rather than excluded per chapter, so the director cannot place it anywhere. If it is
ever restored it needs a second tell, not a darker shadow. **The library is 33.**

**S05 · `anh-khong-khop-chu-thich`** — slots: `gallery-caption`, `avatar`, `photo`
Image and caption disagree — and the caption is not merely *wrong*, it is **strange**. A caption
naming the wrong object reads as a careless seller or a sloppy editor, and carelessness explains
it away; a caption that does not belong to this world cannot be explained away at all. *"Ảnh:
kho hàng ở tầng dưới. Toà nhà không có tầng dưới."*

**Content constraint (§3.4).** `S05` can land on an `avatar` slot, beside a photograph of a real
person. No caption may describe the person in the picture as dead, missing or harmed. The
strangeness attaches to the *circumstances of the photograph* — the hour it was taken, the room
it was taken in, what was found inside — never to the face.
- Ch4: a photograph of an empty car park captioned *"Nhà hàng nổi giữa hồ"*
- Ch3: a photograph of a chair captioned *"Máy ảnh Canon AE-1, còn hộp"*

Because the caption is authored and the photo is pinned by `lock`, the mismatch is written
against a known image — the reason §3.4 forbids unpinned URLs.

**S06 · `chu-vien-dinh-ngoai-le`** — slots: `paragraph`, `notice`, `footer`
A line sits slightly outside its container, translated into the margin with
`overflow: visible`, as if it tried to leave the page and got most of the way.

**S07 · `emoji-lac-loai`** — slots: `feature-icon`, `tile`, `nav`

The vocabulary is fixed across every chapter: 🩸 🕳️ 👁️ 🦷 👽 🌚 🧿 🃏 🪬 — blood, a hole, an eye,
a tooth, and then the things that watch or ward. Each one is a complete sentence next to ✨🌿💧.

**It replaces the text of one CHILD when the slot has children.** Assigning to the slot's own
`textContent` works for a single `feature-icon`, but on a `nav` it deleted all five links and
left one emoji — on 14% of chapter 1 seeds. That does not read as "one icon is wrong", it reads
as a broken page, and a broken page gets skipped rather than circled.
The site's emoji vocabulary breaks. Among ✨🌿💧🧴 one bullet is 🩸 or 🕳️ or 👁️ or 🦷 — same
size, same alignment, styled identically. The most legible anomaly in the library, which is
why Ch1's first run forces it.

### MOTION — 6

**M01 · `phan-tu-theo-con-tro`** — slots: `avatar`, `tile`, `cta`
An element drifts a few pixels toward the cursor, lagging heavily, capped at about 6px of
travel. Never fast enough for the player to be sure they saw it.

**M02 · `carousel-chay-nguoc`** — slots: `gallery-caption` (gallery), `tile` (tile row) · not built
*(Chapter 4's gallery is a still mosaic, not a carousel. Building this would mean authoring a
rotating deck on the honest site first, purely so one anomaly could run it backwards.)*
A rotating element advances forward N times, then once goes *backwards* to a slide that was
never in the deck, then resumes as if nothing happened. Roughly a 20s cycle.

**M03 · `nhip-tho`** — slots: `tile`, `avatar`, `cta`, `map`
A block scales between 1.000 and 1.012 on a 4s ease-in-out. Sub-perceptual until stared at.
Breathing.

**M04 · `bong-tre-nhip`** — slots: `cta`, `tile` · not built
The element animates on one period, its shadow on a slightly longer one, so the shadow arrives
late — the thing casting it is not quite the thing you can see.

**M06 · `anh-sang-di-qua-anh`** — slots: `photo`, `gallery-caption` · Ch4 · BUILT
A small point of light crosses the inside of a photograph, taking 20–35 seconds to do it, and
then does it again. A **still photograph** cannot have anything moving in it. That is the whole
anomaly, and it is why this survives *"…or is the site just like that?"* better than anything
else in MOTION: a block that scales is explicable as a UI flourish, a light tracking across a
picture of a lake is not.

**Both the light and the photograph are marked.** What the player sees is the light, so a circle
drawn around the light has to score — but a small circle around it does not enclose the
photograph's own centre, so marking only the photograph would take a heart off a player who
circled exactly the right thing. `run.found` keys on the anomaly id, not the element, so either
one scores once and the other then answers ĐÃ GHI RỒI (the `I03` pattern).

Its flight path is built **the first time the photograph enters the viewport**, not at
`apply()`. In a multi-page chapter every page is mounted at once and the ones not on screen are
`display: none`, so measuring at apply time returns a 0×0 box and the light never moves.

**M05 · `cuon-nguoc-mot-chut`** — slots: any section-level slot
Once per run, scrolling down past this element makes the page scroll back up about 40px on its
own, once. Because a one-shot event cannot be circled after the fact, it leaves a permanent
tell: a ghost duplicate of the element, offset upward at 8% opacity — a scroll scar. The scar
is the capturable element.

### ELEMENT — 5

**E01 · `nut-o-le`** — slots: `paragraph`, `footer`, `nav` (it positions relative to them)
A button parked out in the page margin, outside any layout, unstyled by the site's button
rules: *"GỌI LẠI"*, *"ĐỪNG BẤM"*, *"XÁC NHẬN LẦN NỮA"*. Clicking opens a dialog written in the
wrong voice. Clicking never scores — it still has to be circled.

**E02 · `o-nhap-khong-nen-co`** — slots: `comment-form`, `booking-form`, `shipping-form`,
`subscribe`, `newsletter` · BUILT

It does not style itself. It **clones a field already in that form** and changes only the
words, which guarantees it matches its neighbours exactly and lets it work on any chapter
without knowing anything about that site's CSS. The clone is never `required` and carries no
`name`, because experimenting must never be able to block the player from submitting.
A form field that has no business in this form, styled exactly like its neighbours:
*"Nhóm máu"*, *"Tên người sẽ nhận đồ của bạn"*, *"Đêm qua bạn mơ thấy gì?"*,
*"Số người sẽ về cùng bạn"*.

**E03 · `muc-menu-thu-mot-mot`** — slots: `nav` · Ch1, Ch3, Ch4 · BUILT
An extra nav item: `TRANG CHỦ · SẢN PHẨM · VỀ CHÚNG TÔI · `**`TẦNG HẦM`**. Clicking shows a 404
written in the first person — *"Tôi không tìm thấy trang đó. Tôi đã tìm rất lâu."* Ch4 offers
`KHU VỰC 4`, `BẢN ĐỒ SAO`, `LỐI XUỐNG ĐÁY HỒ`.

Like `E02`, **it clones a link already in that nav** and changes only the words, so it matches
its neighbours exactly and works on any chapter without knowing that site's CSS. If it were a
shade off, the player would find it by looking rather than by reading — and the words are the
whole anomaly. The clone drops `data-goto`: in a multi-page chapter a copied link that kept it
would route the player to a real page, and the item that does not exist would turn out to go
somewhere that does.

**E04 · `chan-trang-thua`** — slots: `footer`
The footer contains a line no footer contains: a coordinate pair, a licence number that is a
scripture reference, *"Bản quyền © 1834–2026"*, *"Số người đang xem: 1 (bạn) và 4"*.

**E05 · `con-tro-doi-hinh`** — slots: `paragraph`, `avatar`, `cta`, `map`
A region where the cursor becomes wrong. **Only three: `help`, `wait`, `not-allowed`.**
`crosshair` and `progress` were dropped — `crosshair` collides with capture mode's own cursor,
and `progress` is close enough to `wait` to be the same anomaly twice. The three that remain
each say something: this needs explaining, this is busy with something, you may not.

### REACTIVE — 6

All five are **two-stage**: the site is honest until the player experiments, the experiment
makes the anomaly *appear*, and it must then be circled to count. Experimenting is always
free — no interaction can ever cost a heart.

**R01 · `binh-luan-khong-ten`** — slots: `comment-form` · Ch2 · BUILT
Submit the comment form with the name field empty. The comment posts — but not under
`Ẩn danh`, and not with your text. It appears as *"Mây · vừa xong"* and its body replies to
something the player has not said: *"Không sao đâu. Chị vẫn ở đây mà."*

The clean site must post an ordinary comment in every other case, or the anomaly degenerates
into "something appeared" and the player never reads the name. Sign the comment and it goes up
under your name; leave the name blank on a run without `R01` and it goes up as `Ẩn danh`. When
an anomaly answers an interaction it sets `form.dataset.handled`, and the site's own
`behaviour()` stands down — otherwise both post and the page reads as buggy rather than wrong.

**R02 · `gio-hang-tu-them`** — slots: `cart-line` · Ch3 · BUILT
Add anything to the cart. The cart shows your item and one more you did not add — same seller,
and the shipping address prefilled is the one from the seller's card.

**The first anomaly that spans two pages**: the trigger is a button on the product page, the
evidence is a line on the cart. Anomalies get `ctx.shadow` alongside `ctx.root` for this, and
the rule is that the *trigger* may be anywhere while the *evidence* stays inside `ctx.root` —
marking something on another page would count it against a page it is not on.

**The extra item must not look like a bundled freebie.** Its first version added "hộp đựng máy
ảnh" and "dây đeo máy ảnh" — plausible accessories of the very item being viewed, at 0₫, from the
same seller — so it read as something thrown in with the purchase, and a free gift is not wrong.
What goes in the cart now is not merchandise at all: nobody sells it, nobody sent it, and the
seller line says so. *"Thứ bạn để quên ở đây lần trước · Người gửi: không rõ · bạn đã nhận món
này rồi."*

**It recounts the cart badge and re-adds the subtotal after inserting its line.** Skip that and
the cart holds three items while the label says two: the player reads a site that cannot count,
which is a *bug*, and bugs get ignored. The anomaly is far stronger when every number agrees —
nothing is broken, there is simply something in your cart you never chose. Its own items are
priced 0₫ so the total stays honest.

**R03 · `tim-kiem-tra-ve-chinh-minh`** — slots: `nav` (search box) · Ch3, Ch6
Search anything. Among plausible results sits one whose title is the player's exact query
prefixed with *"chúng tôi đã tìm thấy"*, or one titled with the current clock time.

**R04 · `xac-nhan-thua-khach`** — slots: `booking-form` · Ch4 · BUILT
Fill in the dates, leave the guest count at **2**, and press KIỂM TRA PHÒNG TRỐNG. The site
answers the way any booking page answers — *"Còn phòng cho khoảng ngày này. Lễ tân sẽ gọi lại
trong 30 phút để xác nhận đặt phòng cho **bảy** khách."*

You typed two. It confirmed seven. It does not ask again, does not flag an error, does not
apologise. The pool carries the whole **+1 to +5** range: a small overshoot reads like an
addition slip, a large one reads like the site is counting people you did not book for.

**It hangs off the submit, not off typing.** This is the REACTIVE family, and the family's rule
is that the site is honest until the player tries something real. Watching a number change as
you type into a field is a widget doing its job; booking for two people and being confirmed for
seven is something that has *happened to you*.

There is also a ruler four lines above it: the summary line still reads *"2 khách · 3 đêm"*. The
player never has to remember what they typed — two numbers contradict each other inside the same
box.

**It does not compose its own sentence.** It lets the clean branch write the page's own wording
and then replaces one number inside a `[data-guest-count]` span. Building the sentence itself
would drift a word away from the real one, and the player would spot the anomaly by looking
rather than by reading — exactly the mistake `R05` made once with `font-size`.

For the same reason it does **not** set `form.dataset.handled`: the clean branch has to run on
every submit so the answer stays current when the guest count changes. Both defer with
`setTimeout(0)`, and the clean listener is registered first, so its callback is queued first and
`R04` always overwrites a sentence that was just written.

*(An earlier version keyed off exceeding the six-guest cap and split the summary into
"12 khách (9 người)". It was replaced: the cap is an invitation to fiddle with a number field,
where any change reads as widget behaviour, while the confirmation of a booking you actually
made is a claim the site is making to you.)*

**One defect this exposed in the clean branch.** It used to stand down when it found any
`[data-anom]` inside the booking box — but `E02` also lands on `booking-form`, and its extra
field carries `data-anom`. On a run with `E02` and no `R04` the form went silent: the player
pressed the button and nothing at all happened, which is an anomaly nobody placed, and the
worst kind. It now stands down on `form.dataset.handled`, the flag `R01` already documented.
Chapter 1's newsletter uses the same `[data-anom]` probe and has the same latent hole.

**R05 · `huy-dang-ky-khong-huy`** — slots: `subscribe`, `newsletter` · Ch1, Ch6
Submit a real email address. The confirmation says you have been subscribed since a date years
before today, and the unsubscribe link's text is *"KHÔNG THỂ"*.

The field is `required` and `type="email"`, so native constraint validation runs *before* the
submit event: an empty or malformed address cannot fire the anomaly. That is deliberate — the
anomaly has to sit behind a real interaction, not a stray click on the button. The rejection
messages are set through `setCustomValidity` in Vietnamese, because the browser's own bubble
follows the *browser's* UI language rather than the page's `lang`, and "Please fill out this
field." popping up mid-page is the one piece of English in the chapter.

**A valid address always gets an answer** (§3.2): the clean site thanks you and clears the
field; `R05` thanks you, clears the field, and tells you that you subscribed in 2011. Both use
the same `.news-ok` class, so they are indistinguishable by eye — `R05` must not set inline
styles, or the anomaly renders half a pixel smaller than the honest line and can be spotted
without being read. A chapter offering `newsletter` or `subscribe` styles `.news-ok` itself.

**R06 · `lien-ket-di-tim-thu-ban-khong-go`** — slots: `nav`, `cta` · Ch1
Click an ordinary nav item or an ordinary button, and the browser opens a new tab searching for
something the player never typed. The page offers no explanation; when they come back, the
thing they clicked no longer says what it used to.

Two-stage like the rest of the family: the experiment is free, and the **trace it leaves** is
what must be circled. Without the label change there would be nothing on the page to claim —
opening a tab and leaving no mark is an anomaly that does not exist. It opens in a **new tab**
so the run in progress survives, and `sealNavigation()` already stops the click from
navigating this one.

### IMAGE — 4

Only possible because the photographs are real and their URLs are parameterised. Each of these
would need a second hand-made asset if the art were static files, and none of them are possible
with emoji at all.

**I01 · `anh-mat-mau`** — slots: `photo` · BUILT
One photograph in a set arrives without colour — served `?grayscale`, not filtered in CSS, so it
survives inspection — then aged with sepia and hard contrast until it reads as a photograph from
another decade, **and rotated**: 35°, 69° or 176°.

Greyscale alone was still explicable as a design choice, and so was the ageing. A landscape lying
on its side, or very nearly upside down, is not.

**It rotates the picture inside the frame, not the frame.** The first version transformed the
whole `<img>`, so the page showed a rectangle sitting at an angle with the background showing
through at four corners — which reads as *the page is broken*, not *the photograph is wrong*, and
a broken page gets skipped rather than circled. The image box now keeps its exact position and
size and nothing in the layout moves a pixel; only the world inside the frame is at an angle.

The mechanism needs no extra element and no `overflow: hidden` anywhere: scale the image up by
the factor `k` its angle needs to cover the box, then `clip-path` a quadrilateral computed **in
the image's own un-rotated coordinates**. `clip-path` is applied before the transform, so
clipping the pre-image of the frame under the rotation (rotate by −θ, shrink by 1/k) lands, after
the transform, exactly on the original rectangle.

**The angle bends to the frame's aspect ratio.** `k` is cheap for a square box and brutal for a
long one — a 3:1 panorama at 69° needs a 3.16× enlargement, i.e. a small blurred fragment that
reads as a broken image. So an unaffordable angle is walked toward whichever of 0° or 180° is
nearer until it comes under a **1.8× ceiling**; a horizon tilted 16° is still unmistakably wrong.
If that walk would flatten the tilt to nothing, it snaps to 180° instead, which costs exactly
`k = 1` at any aspect ratio. Source images are requested large enough to survive the ceiling.

`clip-path` hides the pixels but does **not** shrink the scroll area: the browser still counts the
transformed box, so a 1.8× enlargement made the whole page scrollable sideways with nothing
visible out there to explain it — a page that scrolls horizontally on its own reads as broken, and
that scrollbar is a tell nobody placed. The anomaly therefore sets `overflow: clip` on its own
`<figure>`, from inside `apply()` rather than in the site stylesheet: the "no `overflow: hidden` on
a slot's ancestors" rule still matters for `S06` and `E01`, but neither ever attaches to an image
caption, and one slot element only ever carries one anomaly.

Geometry is measured with `offsetWidth`/`offsetHeight`, never `getBoundingClientRect` — the rect
reports the *transformed* box, so a second measurement would measure the transform this code just
applied. A `ResizeObserver` repaints on window resize and, just as importantly, covers the case
where the box was 0×0 at `apply()` time: in a multi-page chapter every page is mounted at once and
the ones not on screen are `display: none`.
- Ch4: six gallery photographs of a lake across a year, and one of them is grey, brown, and lying
  on its side.

**I02 · `anh-doi-khi-quay-lai`** — slots: `photo` · all four built chapters · BUILT
The image's `src` swaps to a different pinned photograph when it leaves and re-enters the
viewport — `T02` for pictures. The photograph you scrolled past is not the one you scroll back
to, and its caption never changes.

Swapping **behind the player's back** is the point: a picture that visibly cross-fades reads as
a slideshow, i.e. a feature. One that is merely different when you return cannot be explained by
any feature at all. The replacement is preloaded, because the blank beat while a new `src`
fetches would announce the swap instead of letting the player catch it by remembering.

**I03 · `cung-mot-nguoi`** — slots: `avatar` (chapter must have ≥2)
Two testimonials, two reviewers, two commenters — different names, different ages, different
stories, and the identical photograph. The cheapest possible tell that the site's people are
not people, and the one players report as the most unsettling in the family.
- Ch1: *"Ngọc Anh, 28"* and *"Thu Hà, 41"* wearing the same face.

**I04 · `anh-mo-dan`** — slots: `photo`
The photograph's `?blur` climbs by one step each time it enters the viewport — `1`, `2`, `4` —
and never resets. Looking at it is what does it.

### 6.1 Coverage check

**29 built anomalies across six families, 35 designed.** The four built chapters below are
counted from the code — the registry matched against each chapter's declared slots, and
re-checked by the test suite — so those columns are measurements, not estimates. Ch5 and Ch6
are still projections against their sketched inventories.

| Family (built) | Ch1 | Ch2 | Ch3 | Ch4 | Ch5* | Ch6* |
|---|---|---|---|---|---|---|
| TEXT (8) | 5 | 6 | 7 | 8 | 8 | 5 |
| STYLE (4) | 4 | 3 | 4 | 4 | 4 | 3 |
| MOTION (3) | 3 | 3 | 3 | 3 | 3 | 2 |
| ELEMENT (5) | 5 | 4 | 5 | 5 | 4 | 5 |
| REACTIVE (5) | 2 | 1 | 2 | 2 | 0 | 2 |
| IMAGE (4) | 4 | 4 | 4 | 4 | 4 | 0 |
| **eligible** | **23** | **21** | **25** | **26** | 23* | 17* |
| roll | 6–8 | 6–8 | 6–7 | 7–9 | 6–8* | 7–8* |
| families available | 6 | 6 | 6 | 6 | 5 | 5 |

Ch4's TEXT reaches all eight — it is the only chapter carrying every timestamp shape, a
`comment`, a `notice` list and the game's only `map`. Ch2 stays lowest because a personal blog
has no `nav`, and its REACTIVE is 1 by design (only `R01`).

Building chapter 4 raised the earlier chapters too: `E03`, `I02` and `M06` are eligible
wherever there is a nav or a photograph, so chapters 1–3 each gained two or three new ways to
be wrong without a line of their markup changing. That is the runtime-mutation architecture
(§3.1) paying out exactly as intended — one anomaly written once, six sites richer.

Every chapter clears the director's "≥3 families, ≤2 per family" rule at its maximum roll with
room to spare — the tightest is Ch6, whose five families give a capacity of 10 against a roll
of 8. Ch4 rolls up to 9 against six families, i.e. a capacity of 12; the suite asserts that on
500 seeds.

**Adding photographs resolved the Chapter 5 problem.** Before the IMAGE family, Ch5 had four
families against a maximum roll of 8, filling every family to its cap with zero slack — the
director could paint itself into a corner. Its four ceremony photographs give it a fifth
family and real headroom. That was an unintended benefit of the imagery decision, and it is the
main reason the coverage table is now worth trusting.

Two deliberate absences remain, both of them characterisation rather than oversight:

- **Ch5 has no REACTIVE anomaly.** It is a read-only bulletin board — nothing to submit,
  nothing to interact with, only to read. `R06` technically fits its `nav` and `cta`, so when
  Ch5 is built it must carry `R06` in its `exclude` list to keep that characterisation; the
  table above counts it as 0 on that basis.
- **Ch6 has no IMAGE anomaly** and no `photo` or `avatar` slots at all. A status dashboard has
  no photographs, so the finale is pure text, colour and motion.
- **Ch2 has no `nav` slot,** so `E03` and `S07` never appear there; a personal blog with a
  single-line header is the reason, and its deep `comment` inventory more than covers the loss.

---

## 7. File plan

```
games/tham-tu-mang/
  index.html                 shell: HUD, viewport host, overlays. No game logic.
  style.css                  HUD / menu / overlay styling only — never the sites
  js/
    main.js                  boot, screen routing (menu ↔ chapter ↔ end)
    state.js                 run state: hearts, captured set, current page
    storage.js               localStorage — progress, ranks, mute
    audio.js                 Web Audio synth; mute flag `thamTuMang.muted`
    engine/
      rng.js                 mulberry32 + helpers (pick, shuffle, range)   ← DOM-free
      hittest.js             point-in-polygon, centroid, nearest-target,
                             stroke bounds, budget-ring clamp             ← DOM-free
      registry.js            imports all 29 built anomalies, exports ANOMALIES ← DOM-free
      img.js                 pinned CDN url builders + SVG fallback markup ← DOM-free
      director.js            roll count, filter, pick, assign to pages     ← DOM-free
      run.js                 capture resolution, hearts, win/loss
      site.js                shadow root, page mount/swap, slot indexing
    anomalies/
      text.js                T01–T03, T05–T09   (T04 withdrawn)
      style.js               S01, S05–S07       (S02–S04 not built)
      motion.js              M01, M03, M06      (M02, M04, M05 not built)
      element.js             E01–E05
      reactive.js            R01, R02, R04–R06  (R03 not built)
      image.js               I01–I04
    ui/
      menu.js                case archive / chapter select
      hud.js                 hearts, evidence counter, chapter title
      mode.js                CHẾ ĐỘ ĐỌC ↔ CHẾ ĐỘ KHOANH toggle, vignette, cursor
      lasso.js               pointer capture, canvas stroke, budget ring, polygon close
      overlay.js             briefing, rules, game over, chapter clear
      toast.js               capture feedback
    chapters/
      index.js               manifest: order, unlock rules, count ranges
      ch1-lumiere.js         slots, flavour pools, exclude list
      ch2-bep-nha-may.js
      ch3-san-do-cu.js
      ch4-ho-vang.js
      ch5-hoa-ban.js
      ch6-megalink.js
  sites/
    ch1-lumiere/      page.js                                   site.css
    ch2-bep-nha-may/  pages.js  (5 trang)                       site.css
    ch3-san-do-cu/    pages.js  (14 trang)                      site.css
    ch4-ho-vang/      page.js                                   site.css
    ch5-hoa-ban/      page.js                                   site.css
    ch6-megalink/     page.js                                   site.css

tests/tham-tu-mang.test.mjs   imports the DOM-free engine modules directly
```

Also changed:

- `index.html` — one entry appended to the `games` array; `Puzzle: "▨"` added to
  `CATEGORY_ICONS`.
- `README.md` — one line in the game list.

### 7.1 Hub entry

```js
{
  icon: "🔎",
  title: "Thám tử mạng",
  description: "Soi sáu trang web bình thường và khoanh tròn những thứ không nên ở đó.",
  category: "Puzzle",
  tags: ["Quan sát", "Kinh dị", "Tiếng Việt"],
  added: "2026-09-10",
  color: "linear-gradient(135deg, #0d1117, #4fa88b)",
  path: "games/tham-tu-mang/index.html"
}
```

The final stop `#4fa88b` — a sickly evidence-tape green — is distinct from every existing card.

---

## 8. Testing

The four `engine/` modules marked DOM-free are the testable surface, imported directly by
`tests/tham-tu-mang.test.mjs` the way `tests/chrono-drifter.test.mjs` imports its engine. The
bare import is itself the proof that they stay DOM-free.

- **`hittest.js`** — point-in-polygon against convex, concave and self-intersecting strokes; a
  rect centre exactly on a polygon edge; strokes below the 12px floor and strokes past the
  budget ring both rejected *before* any hit-test runs; and the single-target rule — given a
  polygon enclosing several elements, the one nearest the centroid is chosen, deterministically
  and with ties broken stably.
- **`director.js`** — over 500 seeded rolls per chapter: count within range, never two
  anomalies on one slot element, ≥3 families, ≤2 per family, every page of a multi-page
  chapter gets at least one, and the same seed yields an identical plan.
- **`registry.js`** — exactly 34 entries across six families, unique ids, every `slots` value
  appears in at least one chapter's inventory, every anomaly eligible for at least one chapter.
- **`img.js`** — every generated URL is pinned (a `lock=` or an `/id/`), because an unpinned
  URL silently breaks `S05` and the IMAGE family; `?grayscale` and `?blur=` compose correctly
  onto a pinned base; and every image spec carries fallback SVG markup.
- **Content rules that are actually assertable** — two of §6's authoring rules are mechanical,
  so they are tests rather than hopes:
  - **`T02`'s shape rule** — for every chapter's `T02` pool, the replacement must differ from
    the original by more than 12 characters. This is the one that catches a future
    *"412 → 413"*: a swap the player could only find by having memorised the page passes review
    easily and fails this assertion immediately.
  - **`T03`'s descent** — the generator, fed a starting value, produces the five phases in
    order, formats every decimal with a comma per Vietnamese convention (never `8.5`), and
    lands on `6,02e23` before giving up on being a number.
  - **`T04`'s rationing** — the fourth-wall variant that reads run state is eligible in Ch6 and
    nowhere else, and appears at most once per playthrough. Asserted across every seed, because
    the whole effect dies if it can fire twice or fire early.
- **`chapters/*.js`** — each chapter's declared slot inventory can satisfy its own maximum roll
  under the director's constraints (the §6.1 table, asserted rather than trusted).

`tests/syntax.test.mjs` covers `.html` script bodies; the folder game's modules are covered by
being imported at all.

**Manual playtest gates**, per this project's verification policy — static checks plus a human
playtest at milestones: after Ch1 is playable, and again once all six chapters exist. What a
playtest is looking for is not bugs but calibration — whether an anomaly is invisible, or so
obvious it is free.

---

## 9. Non-goals

- **No timer, no score multiplier, no combo.** The game is looking, not reacting.
- **No difficulty settings.** The chapter order is the difficulty curve.
- **No bundled assets.** Photographs are hotlinked and pinned (§3.4), never committed; Web
  Audio for all sound; emoji retained for icons. The repo gains no binary files.
- **No image the game cannot survive losing.** Every photograph is decoration plus an anomaly
  surface, never the only carrier of a clue — the fallback path must remain playable, not
  merely loadable.
- **No hint button.** The HUD gives a count and nothing else; that was decided deliberately,
  and the chapter ramp is what carries a stuck player, not an assist.
- **No procedural site generation.** Six hand-written sites; only the anomalies are rolled.
- **No child harmed on screen in Ch5.** Stated here so it survives into implementation.

## 10. Known constraints

- **`?unlock=1` opens every chapter.** A debug flag for looking at later chapters without
  clearing the earlier ones. It only unlocks: saved progress is untouched, so removing the flag
  puts everything back. The menu says so on screen while it is on, because a chapter that opened
  for a reason other than being earned would otherwise look like corrupted progress. It reads
  `location` lazily — a top-level reference would break the DOM-free test import.
- **This game needs a server.** ES modules do not load over `file://`. `games/last-quarter/`
  already has this constraint, and GitHub Pages is unaffected. Note that `python3` is not
  installed on this machine — use `npx serve` or any static server.
- **`CATEGORY_ICONS` must stay monochrome.** `Puzzle: "▨"`, not an emoji, or the hub sidebar's
  uniform look breaks.
- **`CLAUDE.md` needs updating as part of this work.** Line 56 says games make no network
  requests and lists three exceptions; this game is the fourth, and the first for images rather
  than audio or a library. Shipping without amending that line leaves the next person reading a
  rule the codebase no longer follows.
- **The game now depends on a third party staying up.** `loremflickr.com` and `picsum.photos`
  are free services with no uptime guarantee, and either could change its URL scheme or vanish.
  The `onerror` fallback is what keeps that from being fatal, which is why §3.4 makes the
  offline pass a playtest gate rather than a nice-to-have. If a service dies permanently, the
  fix is one URL builder in `engine/img.js` — that is the reason the builders are centralised
  there instead of inlined into six sites.
- **Image URLs are unverified.** Written blind from a sandbox with no network; keywords and
  `lock` values need a human pass at first playtest (§3.4).
- **Anomaly text is the game.** Thirty mechanics are worth nothing if the copy is generic. The
  flavour pools in §6 are content, not examples to be paraphrased at implementation time.
