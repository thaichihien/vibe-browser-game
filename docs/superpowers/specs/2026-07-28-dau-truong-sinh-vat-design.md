# Đấu Trường Sinh Vật — Design

**Date:** 2026-07-28
**File:** `games/dau-truong-sinh-vat.html`
**Genre:** Triple Triad–style card battler, modelled on *Laboratz* (Adictiz, discontinued)

## 1. Goal

A single-file browser card game whose gameplay matches **Laboratz**: two players lay cards
on a 3×3 grid; each card carries four edge numbers; placing a card next to a weaker facing
edge flips that card to your colour. Whoever owns more cards when the grid fills wins.

Roster: **30 creature cards** using animal/monster emoji.

Visual language shares the repo's house DNA (dark frame, emoji pieces, glow, Web Audio
synth) but reads as its own game: **neon lab / bio-tech**, distinct from `jungle-game.html`
(green woodland) and `co-ca-ngua.html` (sunny turf).

UI language: **Vietnamese**, consistent with the other two board games and the README.

### Reference — what Laboratz actually was

Sources: [Laboratz Wiki](https://laboratz.fandom.com/wiki/Laboratz_Wiki),
[Techulator walkthrough](https://www.techulator.com/resources/10226-how-play-laboratz-game-facebook-review-walkthrough),
[Gamezebo review](https://www.gamezebo.com/reviews/laboratz-review/).

A Facebook/mobile battle-card game about genetically mutated rats. Battles happen on a
3×3 grid, each player holds a deck of five cards, players alternate laying single cards,
and a card played adjacent to a lower numerical value captures the existing card. Widely
described as a Triple Triad clone. The meta layer (collect/train hundreds of rats,
adventure mode, PvP duels, items) is **explicitly out of scope for v1**.

## 2. Scope

### In scope (v1)

- Single match, start to finish, with a rematch button.
- Mode toggle at start: **vs AI** (three difficulties) or **hot-seat 2 players**.
- 30-card roster, both hands dealt face-up.
- Basic + SAME + PLUS + COMBO capture rules.
- Neon-lab presentation, flip/combo animations, Web Audio synth, Vietnamese rules modal.
- Hub integration: entry in `index.html` and in the README game list.

### Out of scope (v1)

- Card collection, persistence of unlocked cards, deck editor, campaign ladder,
  card-stealing on victory, items / "dirty tricks", online play, ELEMENTAL rule.
- Only the sound-mute preference is persisted (localStorage). No other saved state.

## 3. Game rules

### 3.1 Setup

- Board: 3×3, nine cells, indexed `0..8` (`row = idx / 3 | 0`, `col = idx % 3`).
- Two sides: `0` = **BẠN** (cyan), `1` = **ĐỐI THỦ** (magenta).
- Each side is dealt **5 cards**, drawn without replacement from the shared 30-card roster
  under an identical rarity recipe (see §4.2). **Both hands are face-up** (Triple Triad's
  "Open" rule) — this keeps the match tactical and makes AI lookahead legitimate rather
  than cheating.
- First player chosen at random, shown as a coin-flip animation.

### 3.2 Turn loop

Players alternate, one card placed per turn, until all nine cells are filled. The first
player places 5 cards, the second places 4 and keeps 1 in hand.

### 3.3 Card values

Each card has four edge values `N`, `E`, `S`, `W`, each in `1..10`. **10 renders as `A`.**

Edge pairing between a placed card `C` and an occupied neighbour:

| Neighbour | C's edge | Neighbour's edge |
|---|---|---|
| above | `N` | `S` |
| right | `E` | `W` |
| below | `S` | `N` |
| left  | `W` | `E` |

The board does not wrap: cells on an edge simply have fewer neighbours.

### 3.4 Resolution order

This is the heart of the game and must be implemented in exactly this order.

Given card `C` placed at cell `X` by player `P`:

1. **SAME.** Collect every occupied neighbour whose facing edge is **equal** to C's facing
   edge. If that set has **≥2 members** and **≥1 is enemy-owned**, flip every enemy-owned
   member of the set. (Neighbours already owned by `P` count toward reaching 2 but are not
   flipped.)
2. **PLUS.** For every occupied neighbour compute `sum = C.edge + neighbour.facingEdge`.
   Group neighbours by that sum. For every group with **≥2 members** and **≥1 enemy-owned
   member**, flip every enemy-owned member of the group.
3. **BASIC.** For every occupied enemy neighbour **not already flipped in steps 1–2**,
   flip it if `C.edge > neighbour.facingEdge`. Strictly greater — equal never flips here.
4. **COMBO.** Every card flipped in steps 1 or 2 — **not** those flipped in step 3 — then
   attacks its own neighbours using the BASIC comparison only. Anything it flips joins the
   next wave and attacks in turn. Breadth-first until a wave flips nothing.

SAME and PLUS are checked independently; both may fire on one placement.

### 3.5 Scoring

`score(P) = cards on board owned by P + cards remaining in P's hand`

The two scores always total 10. Higher score wins; **5–5 is a draw**.

## 4. The 30 cards

### 4.1 Rarity tiers

| Rarity | Vietnamese | Count | Edge sum | Rim colour |
|---|---|---|---|---|
| Common | Thường | 14 | 10–16 | slate |
| Uncommon | Hiếm | 10 | 17–22 | green |
| Rare | Siêu Cấp | 6 | 25–30 | amber |

Rim colour encodes **rarity**. Card **fill tint** encodes **ownership**. The two channels
never collide, so a flipped card still reads as its rarity.

### 4.2 Hand recipe

Each hand is **2 Common + 2 Uncommon + 1 Rare**, drawn without replacement from the shared
roster, the same recipe for both sides. Hands stay random and varied but never lopsided.

### 4.3 Roster

Values are `N/E/S/W`.

**Thường (Common) — 14**

| Emoji | Name | N | E | S | W | Sum |
|---|---|---|---|---|---|---|
| 🐀 | Chuột Thí Nghiệm | 3 | 2 | 4 | 1 | 10 |
| 🐁 | Chuột Nhắt | 1 | 4 | 2 | 3 | 10 |
| 🦗 | Dế Đột Biến | 2 | 5 | 1 | 3 | 11 |
| 🐛 | Sâu Nhớt | 5 | 1 | 3 | 2 | 11 |
| 🕷️ | Nhện Ống Nghiệm | 4 | 3 | 2 | 3 | 12 |
| 🐸 | Ếch Axit | 2 | 6 | 1 | 3 | 12 |
| 🦎 | Thằn Lằn Tái Sinh | 6 | 2 | 3 | 2 | 13 |
| 🐍 | Rắn Neon | 3 | 5 | 4 | 1 | 13 |
| 🦂 | Bọ Cạp Phóng Xạ | 5 | 2 | 6 | 1 | 14 |
| 🐙 | Bạch Tuộc Biến Gen | 2 | 7 | 3 | 2 | 14 |
| 🦇 | Dơi Siêu Âm | 7 | 3 | 2 | 3 | 15 |
| 🐜 | Kiến Chúa Nhỏ | 4 | 4 | 3 | 4 | 15 |
| 🪲 | Bọ Giáp Sắt | 3 | 3 | 7 | 3 | 16 |
| 🐢 | Rùa Vỏ Thép | 2 | 4 | 4 | 6 | 16 |

**Hiếm (Uncommon) — 10**

| Emoji | Name | N | E | S | W | Sum |
|---|---|---|---|---|---|---|
| 🦅 | Đại Bàng Sinh Học | 8 | 4 | 2 | 3 | 17 |
| 🐺 | Sói Đột Biến | 5 | 6 | 4 | 2 | 17 |
| 🦈 | Cá Mập Bể Nuôi | 3 | 8 | 5 | 2 | 18 |
| 🦉 | Cú Quét Tia | 7 | 3 | 5 | 3 | 18 |
| 🐊 | Cá Sấu Nhân Bản | 4 | 5 | 8 | 2 | 19 |
| 🦏 | Tê Giác Bọc Giáp | 2 | 4 | 6 | 7 | 19 |
| 🐗 | Lợn Lòi Cuồng Nộ | 6 | 7 | 3 | 4 | 20 |
| 🦍 | Khỉ Đột Cường Hóa | 5 | 5 | 6 | 5 | 21 |
| 🐻 | Gấu Phóng Xạ | 9 | 4 | 6 | 2 | 21 |
| 🦖 | Khủng Long Thu Nhỏ | 6 | 8 | 5 | 3 | 22 |

**Siêu Cấp (Rare) — 6**

| Emoji | Name | N | E | S | W | Sum |
|---|---|---|---|---|---|---|
| 🐉 | Rồng Ống Nghiệm | 9 | 7 | 6 | 3 | 25 |
| 👾 | Sinh Vật Lạ | 7 | 9 | 4 | 5 | 25 |
| 🦑 | Mực Khổng Lồ | 5 | 6 | 9 | 6 | 26 |
| 👹 | Quỷ Đột Biến | 8 | 5 | 7 | 7 | 27 |
| 🐲 | Long Vương Gen | 10 | 6 | 8 | 4 | 28 |
| 🦠 | Siêu Vi Nguyên Tổ | 7 | 10 | 6 | 7 | 30 |

## 5. Architecture

Single self-contained HTML file — no build step, no external requests — matching the rest
of the repo. Inside it, three clearly separated layers.

### 5.1 `Rules` — pure engine (no DOM)

```
Rules.resolve(board, cellIdx, card, owner) -> {
  waves: [ [cellIdx, ...], [cellIdx, ...], ... ],   // ordered flip waves
  same:  bool,                                       // SAME fired
  plus:  bool,                                       // PLUS fired
  comboDepth: int                                    // waves.length - 1
}
```

- `board` is a 9-element array of `null | {cardId, owner}`.
- `waves[0]` holds everything flipped by SAME, PLUS and BASIC on the placement itself.
  It is an **animation grouping only** — `resolve` tracks internally which of those flips
  came from SAME/PLUS and seeds the cascade from just those, per §3.4 step 4. Callers never
  need the distinction.
- `waves[1..]` are the COMBO cascade, one array per BFS level.
- The function **mutates nothing** — the caller applies the flips.

Also `Rules.score(board, hands) -> [s0, s1]` and `Rules.legalCells(board) -> [idx,...]`.

Keeping this pure buys three things: the renderer can replay waves with staggered timing,
the AI can search without touching the DOM, and `__selfTest()` can assert on it directly.

### 5.2 `AI` — move selection

Calls `Rules.resolve` only. Signature `AI.pick(board, myHand, theirHand, me, difficulty)
-> {cardId, cellIdx}`.

| Difficulty | Vietnamese | Behaviour |
|---|---|---|
| Easy | Dễ | Random legal move; 20% of the time takes the greedy-best move instead. |
| Normal | Thường | Greedy: maximise cards flipped this turn. Tie-break toward spending the lower-sum card, then toward cells whose exposed edges are strongest. |
| Hard | Khó | 1-ply minimax: for each candidate move, assume the opponent's best Normal reply; choose the move maximising `myScoreAfter − theirBestReplyGain`. |

Hands are open, so lookahead uses only information the human also sees.

Search size is trivial (≤5 cards × ≤9 cells = 45 moves; Hard is ≤45 × 45 ≈ 2,025
resolutions), so it runs synchronously with a short artificial delay for readability.

### 5.3 Render / interaction layer

Owns the DOM, the animation queue, sound, and all Vietnamese copy. Consumes `Rules` and
`AI`; neither knows it exists.

### 5.4 State

```js
{
  board: Array(9),            // null | {cardId, owner}
  hands: [ [cardId...], [cardId...] ],
  turn: 0 | 1,
  mode: 'ai' | 'hotseat',
  difficulty: 'easy' | 'normal' | 'hard',
  selectedCard: cardId | null,
  busy: bool,                 // animation in flight — blocks input
  gameOver: bool
}
```

`busy` gates every input handler, the same guard pattern `co-ca-ngua.html` uses.

## 6. Presentation

### 6.1 Palette

| Token | Value | Use |
|---|---|---|
| void | `#07040f` | page background |
| panel | `rgba(14,10,30,.72)` | glass panels |
| cyan | `#22d3ee` | player 0 (BẠN) |
| magenta | `#f472d0` | player 1 (ĐỐI THỦ) |
| slate | `#7c8798` | Common rim |
| green | `#34d399` | Uncommon rim |
| amber | `#fbbf24` | Rare rim |

Backdrop: deep radial glows, a scanline overlay, a vignette, and slowly drifting
flask-bubble particles.

### 6.2 Card

Big emoji centred, four numbers arranged in an N/E/S/W diamond, rarity rim, holographic
sheen sweep on hover. Ownership shown by fill tint.

### 6.3 Layout

Header (title, 🔊 sound, 📖 luật chơi, 🔄 chơi lại) above a three-column main: your hand |
board | opponent hand, with a status/score card. **Status and score cards have fixed
heights** so changing text never shifts the layout — the lesson commits `15794f4` and
`80040bf` landed on for `co-ca-ngua.html`. Collapses to a single column under 900px.

### 6.4 Interaction

1. Click a card in your hand → it lifts and glows; legal cells light up.
2. Hovering a legal cell **ghost-outlines exactly which enemy cards would flip**, computed
   by calling `Rules.resolve` on a scratch copy. This teaches SAME/PLUS/COMBO by showing
   them before they happen.
3. Click the cell to commit. Clicking the selected card again deselects.

### 6.5 Animation

- Placement: card scales down into the cell with a soft impact ring.
- Flip: 3D `rotateY` with a colour morph mid-rotation.
- Waves play staggered ~180ms apart, pitch rising with each wave.
- `SAME!` / `PLUS!` / `COMBO ×N` callout bursts; board shake on a chain of 3+.
- Game end: score tally, winner overlay, confetti.

### 6.6 Sound

Web Audio synth module shaped like `co-ca-ngua.html`'s `Sound` IIFE — oscillator + noise
helpers, master gain, mute persisted to `localStorage` under `dauTruongSinhVat.muted`.
Cues: place, flip (pitch rises per wave), same/plus chord stab, combo riser, win arpeggio,
lose descent.

## 7. Verification

The repo is a static site with no test framework, and the machine has no Python — so
`python3 -m http.server` from the README is not an option here. Open the file directly, or
serve with `npx serve` if a server is wanted.

### 7.1 `__selfTest()`

Exposed on `window`, runs `Rules.resolve` against hand-built boards and logs pass/fail:

1. BASIC flip — higher edge flips one enemy.
2. No flip on equal edges under BASIC alone.
3. No flip against a card you already own.
4. SAME fires on two equal facing edges and flips both.
5. SAME counts a friendly neighbour toward the ≥2 threshold but does not flip it.
6. PLUS fires on two equal edge-sums.
7. COMBO cascades three levels deep, returned as three separate waves.
8. Cards flipped by BASIC do **not** seed a combo.
9. Board edges do not wrap — a card in column 0 has no left neighbour.
10. `Rules.score` totals 10 at every point in a match.

### 7.2 Manual playtest

Per the standing verification policy: static checks plus a user playtest at the milestone.
No subagent browser automation.

## 8. Hub integration

Append to the `games` array in `index.html`:

```js
{
  title: "🧪 Đấu Trường Sinh Vật",
  description: "Đấu bài 3×3: lật quân đối thủ bằng sức mạnh bốn cạnh!",
  color: "linear-gradient(135deg, #07040f, #22d3ee)",
  path: "games/dau-truong-sinh-vat.html"
}
```

And a line in the README game list.

## 9. Risks

- **Resolution order is the whole game.** Getting SAME/PLUS/COMBO subtly wrong yields a
  game that looks fine and plays wrong. Mitigated by the pure engine plus `__selfTest`
  cases 4–8.
- **Combo animations vs. input.** A long cascade must not let the next turn start early;
  the `busy` flag gates all input until the final wave settles.
- **Balance.** 30 hand-authored cards with a fixed rarity recipe should be reasonable, but
  only playtesting will confirm the Rare tier isn't overwhelming. Stats live in one table
  and are cheap to retune.
