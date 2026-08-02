/* World building, tile collision and the character controller.
 *
 * DOM-free on purpose: everything here is fed a `dt` and an input record and
 * reports back through `emit`, so the same simulation can be stepped from a
 * headless run or a debug scrub without a canvas attached.
 */
import { TILE, ROWS, VIEW_W, PHYS, METER } from '../config.js';
import { normalizeMap } from '../levels.js';

const SOLID = '#><';
const HAZARD = '^~';

export const isSolid = ch => SOLID.includes(ch);
export const isOneWay = ch => ch === '=';
export const isHazard = ch => HAZARD.includes(ch);
export const conveyorDir = ch => (ch === '>' ? 1 : ch === '<' ? -1 : 0);

const PLAT_W = TILE * 2;
const PLAT_H = 14;

export function buildWorld(level) {
  const grid = normalizeMap(level.map).map(r => r.split(''));
  const cols = grid[0].length;
  const world = {
    level, theme: level.theme, grid, cols, rows: ROWS,
    w: cols * TILE, h: ROWS * TILE,
    entities: [], coinsTotal: 0, coins: 0,
    spawn: { x: TILE * 2, y: TILE * 9 },
    checkpoint: null,
    camX: 0, camY: 0, time: 0, progress: 0, progress01: 0,
    canTurn: { left: true, right: true },
    pickupIcon: '🪙', finished: false,
    cover: 0,          // seconds of "the machine moved me, not the joystick"
    shake: 0,
  };

  const clear = (x, y) => { grid[y][x] = '.'; };

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = grid[y][x];
      const px = x * TILE, py = y * TILE;
      switch (ch) {
        case 'P':
          world.spawn = { x: px + 6, y: py + TILE - PHYS.bodyH };
          clear(x, y);
          break;
        case 'o':
          world.entities.push({ type: 'coin', x: px + 6, y: py + 6, w: 20, h: 20, taken: false, bob: Math.random() * 6 });
          world.coinsTotal++;
          clear(x, y);
          break;
        case 'E':
          world.entities.push({
            type: 'enemy', x: px + 3, y: py + TILE - 26, w: 26, h: 26,
            dir: -1, speed: 42, dead: 0, emoji: level.theme.enemy,
          });
          clear(x, y);
          break;
        case 'S':
          /* Flush with the floor, so walking into one launches you — a spring
           * is a piece of level design handing you a free cover window, not an
           * optional extra you have to land on precisely. */
          world.entities.push({ type: 'spring', x: px + 2, y: py + TILE - 16, w: 28, h: 18, t: 0 });
          clear(x, y);
          break;
        case 'C':
          world.entities.push({ type: 'checkpoint', x: px + 4, y: py, w: 24, h: TILE, done: false });
          clear(x, y);
          break;
        case 'F':
          world.entities.push({ type: 'flag', x: px + 4, y: py, w: 24, h: TILE });
          clear(x, y);
          break;
        case '-': {
          /* Travel range comes from the hole in the floor *below* the marker —
           * the marker's own row is open air almost everywhere — extended one
           * tile onto each ledge so the platform can actually be boarded. */
          const gy = Math.min(ROWS - 1, y + 1);
          const supports = cx => isSolid(grid[gy][cx]) || isOneWay(grid[gy][cx]);
          let a = x, b = x;
          while (a > 0 && !supports(a - 1)) a--;
          while (b < cols - 1 && !supports(b + 1)) b++;
          const min = Math.max(0, a * TILE - TILE);
          const max = Math.min(world.w - PLAT_W, (b + 1) * TILE + TILE - PLAT_W);
          /* Top flush with the walking surface, so it can be stepped onto
           * rather than precisely jumped onto. */
          world.entities.push({
            type: 'mplat', x: min, y: py + TILE, w: PLAT_W, h: PLAT_H,
            min, max: Math.max(min, max), dir: 1, speed: 62, dx: 0,
          });
          clear(x, y);
          break;
        }
        default: break;
      }
    }
  }

  world.player = makePlayer(world.spawn);
  world.camX = clampCam(world, world.player.x);
  return world;
}

function makePlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y, vx: 0, vy: 0,
    w: PHYS.bodyW, h: PHYS.bodyH,
    onGround: false, facing: 1,
    coyote: 0, buffer: 0, jumpHeld: false,
    dead: false, deadT: 0, invuln: 0,
    squash: 0, ridePlat: null,
    nearMissT: 0,
  };
}

const clampCam = (w, px) => Math.max(0, Math.min(w.w - VIEW_W, px + PHYS.bodyW / 2 - VIEW_W / 2));

const tile = (w, cx, cy) =>
  (cx < 0 || cy < 0 || cx >= w.cols || cy >= w.rows) ? '.' : w.grid[cy][cx];

const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* ── the frame ─────────────────────────────────────────────────────────── */
export function stepWorld(world, dt, input, emit) {
  world.time += dt;
  world.justAction = false;   // set below; the director judges the visible jump,
                              // not the keypress, since a buffered press that
                              // never leaves the ground is invisible to the human
  world.justTurn = 0;         // set by a dash below
  const p = world.player;

  if (world.cover > 0) world.cover = Math.max(0, world.cover - dt);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 3);

  stepEntities(world, dt);

  if (p.dead) {
    world.canAct = false;
    world.canTurn.left = world.canTurn.right = false;
    p.deadT -= dt;
    p.vy = Math.min(p.vy + PHYS.gravity * dt, PHYS.maxFall);
    p.y += p.vy * dt;
    if (p.deadT <= 0) respawn(world, emit);
    world.camX += (clampCam(world, p.x) - world.camX) * Math.min(1, dt * 6);
    return;
  }

  if (p.invuln > 0) p.invuln -= dt;

  /* Carried by whatever is under you before your own movement is applied. */
  if (p.ridePlat) {
    p.x += p.ridePlat.dx;
    world.cover = Math.max(world.cover, METER.coverRide);
  }

  /* ── horizontal: a tap is a dash, and between taps you coast ── */
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    p.vx = dir * PHYS.runSpeed * PHYS.turnBoost;
    p.facing = dir;
    world.justTurn = dir;              // a visible, commanded move
  } else {
    const drop = (p.onGround ? PHYS.dashDecay : PHYS.airDecay) * dt;
    p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - Math.sign(p.vx) * drop;
  }

  /* Conveyors push you along whether or not you asked. */
  if (p.onGround) {
    const foot = Math.floor((p.y + p.h + 2) / TILE);
    const cd = conveyorDir(tile(world, Math.floor((p.x + p.w / 2) / TILE), foot));
    if (cd !== 0) {
      p.x += cd * PHYS.conveyor * dt;
      world.cover = Math.max(world.cover, METER.coverRide);
    }
  }

  /* ── jump ── */
  p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - dt);
  p.buffer = input.jumpPressed ? PHYS.buffer : Math.max(0, p.buffer - dt);
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -PHYS.jumpVel;
    /* A jump always leaves at full speed in the direction you are facing.
     *
     * Without this, reach depended on how long ago you last dashed — coast for
     * a second and the same gap silently became uncrossable, which broke the
     * "every gap is within 136px" invariant every level is built on. It also
     * makes the intended move exactly the one the controls imply: tap ◀ or ▶ to
     * aim, tap ⤒ to commit. */
    p.vx = p.facing * PHYS.runSpeed;
    p.onGround = false;
    p.coyote = 0; p.buffer = 0;
    p.ridePlat = null;
    p.squash = -0.35;
    world.justAction = true;
    emit('jump');
  }
  /* No variable jump height any more. It needed the button to be *held*, and
   * with taps the release arrived one frame after take-off — so every jump was
   * silently cut to 42% and every gap became uncrossable. One press, one full
   * jump. */

  /* ── integrate ── */
  p.vy = Math.min(p.vy + PHYS.gravity * dt, PHYS.maxFall);

  moveX(world, p, p.vx * dt);
  const wasGround = p.onGround;
  moveY(world, p, p.vy * dt, emit);
  if (!wasGround && p.onGround) { p.squash = 0.35; emit('land'); }
  world.canAct = p.onGround;
  world.canTurn.left = world.canTurn.right = true;   // you can always dash

  /* Off the bottom of the map is a pit. */
  if (p.y > world.h + 40) return kill(world, emit, 'pit');

  if (hazardHit(world, p)) return kill(world, emit, 'hazard');

  touchEntities(world, emit);
  scanNearMiss(world, dt, emit);

  p.forcedWait = ledgeForced(world, p);

  if (p.x > world.progress) world.progress = p.x;
  world.progress01 = Math.max(0, Math.min(1, p.x / (world.w - 80)));
  p.squash *= Math.max(0, 1 - dt * 7);
  world.camX += (clampCam(world, p.x) - world.camX) * Math.min(1, dt * 7);
}

function stepEntities(world, dt) {
  for (const e of world.entities) {
    if (e.type === 'mplat') {
      const before = e.x;
      e.x += e.dir * e.speed * dt;
      if (e.x <= e.min) { e.x = e.min; e.dir = 1; }
      if (e.x >= e.max) { e.x = e.max; e.dir = -1; }
      e.dx = e.x - before;
    } else if (e.type === 'enemy' && !e.dead) {
      const next = e.x + e.dir * e.speed * dt;
      const probeX = e.dir > 0 ? next + e.w + 1 : next - 1;
      const cx = Math.floor(probeX / TILE);
      const midY = Math.floor((e.y + e.h / 2) / TILE);
      const footY = Math.floor((e.y + e.h + 4) / TILE);
      const blocked = isSolid(tile(world, cx, midY));
      const floor = isSolid(tile(world, cx, footY)) || isOneWay(tile(world, cx, footY));
      if (blocked || !floor) e.dir *= -1; else e.x = next;
    } else if (e.type === 'enemy' && e.dead) {
      e.dead += dt;
    } else if (e.type === 'coin') {
      e.bob += dt * 4;
    } else if (e.type === 'spring') {
      e.t = Math.max(0, e.t - dt * 3);
    }
  }
}

function moveX(world, p, dx) {
  if (!dx) return;
  p.x += dx;
  const y0 = Math.floor(p.y / TILE);
  const y1 = Math.floor((p.y + p.h - 1) / TILE);
  if (dx > 0) {
    const cx = Math.floor((p.x + p.w) / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      if (isSolid(tile(world, cx, cy))) { p.x = cx * TILE - p.w - 0.01; p.vx = 0; return; }
    }
  } else {
    const cx = Math.floor(p.x / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      if (isSolid(tile(world, cx, cy))) { p.x = (cx + 1) * TILE + 0.01; p.vx = 0; return; }
    }
  }
  if (p.x < 0) { p.x = 0; p.vx = 0; }
  if (p.x > world.w - p.w) { p.x = world.w - p.w; p.vx = 0; }
}

function moveY(world, p, dy, emit) {
  const prevBottom = p.y + p.h;
  p.y += dy;
  p.onGround = false;
  p.ridePlat = null;

  const x0 = Math.floor(p.x / TILE);
  const x1 = Math.floor((p.x + p.w - 1) / TILE);

  if (dy > 0) {
    const cy = Math.floor((p.y + p.h) / TILE);
    for (let cx = x0; cx <= x1; cx++) {
      const ch = tile(world, cx, cy);
      const oneWayOk = isOneWay(ch) && prevBottom <= cy * TILE + 1;
      if (isSolid(ch) || oneWayOk) {
        p.y = cy * TILE - p.h;
        p.vy = 0; p.onGround = true;
        return landOnEntities(world, p, prevBottom, emit);
      }
    }
  } else if (dy < 0) {
    const cy = Math.floor(p.y / TILE);
    for (let cx = x0; cx <= x1; cx++) {
      if (isSolid(tile(world, cx, cy))) { p.y = (cy + 1) * TILE + 0.01; p.vy = 0; return; }
    }
  }
  landOnEntities(world, p, prevBottom, emit);
}

/* Moving platforms are resolved after the tile pass so they can override the
 * result of a landing. Springs are handled by plain overlap in touchEntities. */
function landOnEntities(world, p, prevBottom, emit) {
  if (p.vy < 0) return;
  for (const e of world.entities) {
    if (e.type !== 'mplat') continue;
    if (p.x + p.w < e.x + 3 || p.x > e.x + e.w - 3) continue;
    if (prevBottom > e.y + 8) continue;
    if (p.y + p.h < e.y || p.y + p.h > e.y + e.h + 6) continue;

    p.y = e.y - p.h;
    p.vy = 0;
    p.onGround = true;
    p.ridePlat = e;
    world.cover = Math.max(world.cover, METER.coverRide);
    return;
  }
}

/* True when there is nothing to land on within a jump — i.e. standing still is
 * the only sane move, because a platform has to come to you. The human is
 * watching the same screen, so a pause here does not read as a dead joystick;
 * the director forgives divergence while this holds. Boredom does not. */
const JUMP_REACH = 134;
function ledgeForced(world, p) {
  if (!p.onGround) return false;
  const footRow = Math.floor((p.y + p.h + 4) / TILE);
  const nose = p.x + p.w;

  /* Scans all the way down, not a couple of tiles: dropping off a high ledge
   * onto the floor below is a perfectly good move, and only a hole with lava
   * or nothing at the bottom of it actually traps you. */
  const hasFloor = cx => {
    for (let cy = footRow; cy < ROWS; cy++) {
      const ch = tile(world, cx, cy);
      if (isHazard(ch)) return false;
      if (isSolid(ch) || isOneWay(ch)) return true;
    }
    return false;
  };

  let gapAt = -1;
  for (let d = 0; d <= 40; d += 4) {
    const cx = Math.floor((nose + d) / TILE);
    if (cx >= world.cols) return false;
    if (!hasFloor(cx)) { gapAt = d; break; }
  }
  if (gapAt < 0) return false;

  for (let d = gapAt; d <= gapAt + JUMP_REACH; d += 4) {
    const cx = Math.floor((nose + d) / TILE);
    if (cx >= world.cols) break;
    if (hasFloor(cx)) return false;
  }
  return true;
}

/* Deliberately much smaller than the collision body: clipping the corner of a
 * spike at speed should be a near miss, not a death. */
function hazardHit(world, p) {
  const x0 = Math.floor((p.x + 6) / TILE);
  const x1 = Math.floor((p.x + p.w - 7) / TILE);
  const y0 = Math.floor((p.y + 8) / TILE);
  const y1 = Math.floor((p.y + p.h - 3) / TILE);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++)
      if (isHazard(tile(world, cx, cy))) return true;
  return false;
}

function touchEntities(world, emit) {
  const p = world.player;
  for (const e of world.entities) {
    if (e.type === 'coin') {
      if (!e.taken && overlap(p, e)) { e.taken = true; world.coins++; emit('coin', e); }
    } else if (e.type === 'enemy' && !e.dead) {
      if (!overlap(p, e)) continue;
      const stomping = p.vy > 60 && (p.y + p.h) - e.y < 18;
      if (stomping) {
        e.dead = 0.001;
        p.vy = -PHYS.stompBounce;
        p.squash = -0.3;
        emit('stomp', e);
      } else if (p.invuln <= 0) {
        return kill(world, emit, 'enemy');
      }
    } else if (e.type === 'spring') {
      if (p.vy >= -10 && overlap(p, e)) {
        p.y = e.y - p.h;
        p.vy = -PHYS.springVel;
        p.onGround = false;
        p.ridePlat = null;
        p.squash = -0.5;
        e.t = 1;
        world.cover = METER.coverSpring;
        emit('spring');
      }
    } else if (e.type === 'checkpoint') {
      if (!e.done && overlap(p, e)) {
        e.done = true;
        world.checkpoint = { x: e.x - 6, y: e.y + TILE - PHYS.bodyH };
        emit('checkpoint', e);
      }
    } else if (e.type === 'flag') {
      if (!world.finished && overlap(p, e)) { world.finished = true; emit('goal', e); }
    }
  }
}

/* "That was close" — credited once per cooldown so a long wall of spikes does
 * not pay out every frame. */
function scanNearMiss(world, dt, emit) {
  const p = world.player;
  p.nearMissT = Math.max(0, p.nearMissT - dt);
  if (p.nearMissT > 0 || Math.abs(p.vx) < 70) return;

  const box = { x: p.x - METER.nearMissDist, y: p.y - METER.nearMissDist,
                w: p.w + METER.nearMissDist * 2, h: p.h + METER.nearMissDist * 2 };
  const x0 = Math.floor(box.x / TILE), x1 = Math.floor((box.x + box.w) / TILE);
  const y0 = Math.floor(box.y / TILE), y1 = Math.floor((box.y + box.h) / TILE);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!isHazard(tile(world, cx, cy))) continue;
      p.nearMissT = METER.nearMissCooldown;
      emit('nearmiss');
      return;
    }
  }
  for (const e of world.entities) {
    if (e.type !== 'enemy' || e.dead) continue;
    if (!overlap(box, e)) continue;
    p.nearMissT = METER.nearMissCooldown;
    emit('nearmiss');
    return;
  }
}

function kill(world, emit, cause) {
  const p = world.player;
  if (p.dead) return;
  p.dead = true;
  p.deadT = PHYS.respawnDelay;
  p.vy = -320;
  p.vx = 0;
  world.shake = 1;
  emit('death', { cause });
}

function respawn(world, emit) {
  const at = world.checkpoint || world.spawn;
  const p = world.player;
  Object.assign(p, makePlayer(at));
  p.invuln = 1.2;
  world.cover = 0;
  emit('respawn');
}
