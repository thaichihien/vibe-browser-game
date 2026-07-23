# Cờ Thú 3D (Jungle Game) — Design

**Date:** 2026-07-23
**File:** `games/co-thu.html` (single self-contained HTML file)
**Mode:** Local two-player hot-seat only. No bot, no network.
**Language:** Vietnamese UI throughout.
**Engine:** Three.js r128 via cloudflare CDN `<script>` tag (same pattern as `magic-shooter.html`), with a fallback error screen if the CDN fails.

## Goals

A good-looking 3D version of classic Cờ thú (Dou Shou Qi) with low-poly animal models, smooth animations, and polished effects — playable with mouse or touch, hosted as part of the static GitHub Pages collection.

## 1. Rules (Classic)

- Board: 9 rows × 7 columns. Red side (bottom) vs Blue side (top). Red moves first.
- 8 pieces per side, ranked: **Voi (8) > Sư tử (7) > Hổ (6) > Báo (5) > Chó sói (4) > Chó (3) > Mèo (2) > Chuột (1)**.
- Standard starting layout (mirrored per side):
  - Row 0 (back): Sư tử at col 0, Hổ at col 6; den at col 3, traps at (0,2), (0,4), (1,3).
  - Row 1: Chó at col 1, Mèo at col 5.
  - Row 2: Chuột col 0, Báo col 2, Chó sói col 4, Voi col 6.
- Movement: one square orthogonally per turn.
- Capture: a piece captures enemy pieces of equal or lower rank. Exception: **Chuột captures Voi; Voi cannot capture Chuột**.
- **Rivers**: two 2×3 water areas (rows 3–5, cols 1–2 and cols 4–5). Only Chuột may enter water.
  - A Chuột in water cannot be captured by land pieces and cannot capture any piece on land (including Voi). Chuột vs Chuột capture is allowed when both are in water or both on land.
  - Rule used here: any capture across the water/land boundary is forbidden, in both directions. Once the Chuột is back on land it behaves normally.
- **Jumps**: Sư tử and Hổ may jump over a river in a straight line (horizontally or vertically), landing on the first land square across. The jump is blocked if any Chuột (either side) occupies any water square in the jump path. The landing square capture follows normal rank rules.
- **Traps**: each den is surrounded by 3 trap squares. An enemy piece standing on your trap has effective rank 0 and can be captured by any of your pieces. Your own traps do not affect your own pieces.
- **Den**: a piece may never enter its own den.
- **Win conditions**: move any piece into the enemy den; capture all enemy pieces; or the opponent has no legal move on their turn.

## 2. Game Flow & UX

- **Start screen**: game title, Play button ("Chơi"), Rules button ("Luật chơi") opening a scrollable modal explaining rules in Vietnamese with icons.
- **In-game HUD** (HTML overlay): turn banner ("Lượt: Đỏ / Xanh") with team color, remaining-piece counters per side, buttons: Luật chơi, Chơi lại (with confirm), Đầu hàng (with confirm).
- **Selection loop**: tap/click own piece → highlight ring + bounce; legal move squares show green markers, capture squares show red markers. Click a legal square to move; click elsewhere to deselect. Clicking another own piece switches selection. Input ignored during animations.
- **Game over**: overlay showing winning side, reason (entered den / captured all / no moves / surrender), particle celebration, buttons Chơi lại / Về menu.
- Mouse and touch both supported (raycast picking). Responsive full-screen canvas; UI is DOM overlay.

## 3. 3D World

- **Board**: jungle-themed — green grass tiles with slight height noise, two river areas with animated rippling water (vertex animation on a plane), trap squares as brown pits with spikes, dens as rock alcoves with a team flag. Stone border and scattered low-poly scenery (trees, bushes, rocks) around the board.
- **Pieces**: 8 distinct low-poly animals assembled from Three.js primitives (box/sphere/cylinder/cone) — each silhouette recognizable (Voi trunk, Hổ stripes, Chuột small with long tail, etc.). Round base disc in team color (red / blue) with a glowing rank number on the base.
- **Lighting**: warm directional sun with shadows, soft ambient, subtle sunset gradient sky background.
- **Camera**: ~45° side view of the board; drag / swipe to orbit around the board, wheel / pinch to zoom; polar angle clamped so the camera never goes below the table.

## 4. Animation & Effects

- **Move**: piece hops in an arc to the target square (ease in/out, slight squash on landing). Sư tử/Hổ river jumps use a higher, longer arc.
- **Capture**: victim pops up, shrinks, and dissolves into dust particles; attacker does a small stomp with light camera shake.
- **Chuột swimming**: body half-submerged, ripple rings around it.
- **Idle**: gentle breathing scale on all pieces; selected piece bounces.
- **Trapped**: gray ring/lock indicator above a piece standing in an enemy trap.
- **Victory**: colored particle fireworks; winning pieces do a happy hop loop.

## 5. Architecture (single file, est. 2500–3500 lines)

Modules as sections within one `<script>`:

- `Rules` — pure game logic (board state, legal move generation, capture/trap/jump/win logic). No Three.js dependency.
- `Board3D` — builds board meshes, water, scenery.
- `Pieces3D` — builds the 8 animal models, per-team tinting.
- `FX` — particle systems, tween helper, camera shake.
- `CameraRig` — orbit/zoom camera with clamping (hand-written, ~100 lines).
- `InputPicker` — raycast picking for pieces and squares, mouse + touch.
- `UI` — DOM overlay: menus, HUD, modals, game-over screen.
- `Game` — state machine: `menu → playing → animating → gameover`; connects Rules to 3D and UI.

Error handling: if Three.js fails to load, show a Vietnamese error screen with reload prompt (same as magic-shooter). WebGL context creation wrapped in try/catch with fallback message.

Testing/verification: `Rules` logic is deterministic and isolated; verification per repo policy is static checks plus user manual playtest at milestones (no automated browser tests).

Integration: add game card to root `index.html` hub and an entry in `README.md` (`co-thu.html` — description in Vietnamese).

## Out of Scope

- AI opponent, online play, move history/undo, sound (can be added later if requested), saving game state.
