/* The person at the cabinet.
 *
 * They cannot move the character — you do that. All they produce is a stream of
 * button presses that you are supposed to look like you are obeying.
 *
 * Two things make them beatable and readable:
 *  1. every decision is queued behind their reaction time, so the intent exists
 *     before the hand moves — that queue *is* the telegraph you see on screen;
 *  2. they mash when they panic, and a stray press of theirs is a jump you are
 *     allowed to take for free.
 */
import { TILE, ROWS, PHYS } from './config.js';
import { isSolid, isOneWay, isHazard } from './physics.js';

/* Pacing. The keycaps are an instrument you have to read mid-jump, so the hand
 * driving them has to move at a human speed, not a simulation speed. Every
 * constant here exists to stop the caps strobing: they re-think a few times a
 * second rather than ten, a direction sticks once chosen, and a press is held
 * long enough to see. */
const DECISION = 0.24;   // seconds between re-evaluations
const DIR_HOLD = 0.42;   // a direction, once chosen, stays put this long
const JUMP_GAP = 0.55;   // minimum spacing between any two jump presses
const JUMP_HOLD = [0.20, 0.34];  // how long a press is held, min..max
const LOOKAHEAD = 210;   // how far down the screen they read

const rand = () => Math.random();
/* Two uniforms averaged — cheap bell curve, so most guesses are near-right and
 * the occasional one is wildly off. */
const spread = () => (rand() + rand() - 1);

export function makeHuman(profile) {
  return {
    profile,
    t: 0,
    decT: 0,
    queue: [],
    held: { left: false, right: false, jump: false },
    telegraph: { left: false, right: false, jump: false },
    dueIn: { left: null, right: null, jump: null },   // seconds until the press lands
    lag: profile.reactionMs / 1000,
    intent: 'walk',
    lastJump: -9,
    wanderUntil: 0,
    wanderDir: 0,
    dirLockUntil: 0,
    stunUntil: 0,
    justPressedJump: false,
  };
}

export function humanReset(h) {
  h.queue.length = 0;
  h.held.left = h.held.right = h.held.jump = false;
  h.telegraph.left = h.telegraph.right = h.telegraph.jump = false;
  h.dueIn.left = h.dueIn.right = h.dueIn.jump = null;
  h.stunUntil = h.t + 0.55 + rand() * 0.45;
  h.wanderUntil = 0;
  h.dirLockUntil = 0;
  h.lastJump = -9;
}

export function updateHuman(h, world, dt) {
  h.t += dt;
  h.justPressedJump = false;

  /* Apply anything whose reaction delay has elapsed. */
  for (let i = h.queue.length - 1; i >= 0; i--) {
    const cmd = h.queue[i];
    if (cmd.at > h.t) continue;
    if (cmd.down && cmd.key === 'jump' && !h.held.jump) h.justPressedJump = true;
    h.held[cmd.key] = cmd.down;
    h.queue.splice(i, 1);
  }

  /* What their hand is about to do, and how long until it does it. The keycaps
   * render `dueIn` as a filling bar, so an incoming press is something you can
   * see coming and prepare for rather than react to. */
  h.telegraph.left = h.telegraph.right = h.telegraph.jump = false;
  h.dueIn.left = h.dueIn.right = h.dueIn.jump = null;
  for (const cmd of h.queue) {
    if (!cmd.down) continue;
    h.telegraph[cmd.key] = true;
    const left = Math.max(0, cmd.at - h.t);
    if (h.dueIn[cmd.key] === null || left < h.dueIn[cmd.key]) h.dueIn[cmd.key] = left;
  }
  h.lag = lag(h);

  h.decT -= dt;
  if (h.decT <= 0) {
    h.decT = DECISION;
    decide(h, world);
  }
}

const lag = h => h.profile.reactionMs / 1000;

/* Queue a hold change, but only if it actually changes where the key is
 * headed. Re-issuing an identical intent every tick would otherwise push it
 * past the reaction window forever and the key would never move. */
function set(h, key, down) {
  let latest = null;
  for (const c of h.queue) if (c.key === key && (!latest || c.at > latest.at)) latest = c;
  const headedFor = latest ? latest.down : h.held[key];
  if (headedFor === down) return;
  h.queue.push({ at: h.t + lag(h), key, down });
}

function release(h) {
  h.queue.length = 0;
  const at = h.t + lag(h) * 0.6;
  for (const key of ['left', 'right', 'jump']) h.queue.push({ at, key, down: false });
}

function tap(h, key, dur) {
  const at = h.t + lag(h);
  h.queue.push({ at, key, down: true });
  h.queue.push({ at: at + dur, key, down: false });
}

/* One jump press, spaced so the cap never strobes. Returns false if it was too
 * soon after the last one — every caller routes through here, mashing included,
 * so JUMP_GAP is the single ceiling on how fast that button can flicker. */
function pressJump(h) {
  if (h.t - h.lastJump < JUMP_GAP) return false;
  h.lastJump = h.t;
  tap(h, 'jump', JUMP_HOLD[0] + rand() * (JUMP_HOLD[1] - JUMP_HOLD[0]));
  return true;
}

const dirHeadedFor = h => {
  const at = key => {
    let latest = null;
    for (const c of h.queue) if (c.key === key && (!latest || c.at > latest.at)) latest = c;
    return latest ? latest.down : h.held[key];
  };
  return (at('right') ? 1 : 0) - (at('left') ? 1 : 0);
};

/* Change of direction, but not more often than DIR_HOLD. Without the lock the
 * joystick reads as noise rather than as an instruction. */
function setDir(h, dir) {
  if (dirHeadedFor(h) === dir) return;
  if (h.t < h.dirLockUntil) return;
  h.dirLockUntil = h.t + DIR_HOLD;
  set(h, 'left', dir === -1);
  set(h, 'right', dir === 1);
}

function decide(h, world) {
  const p = world.player;
  const pr = h.profile;

  /* A death knocks them out of the loop for a beat. */
  if (p.dead) {
    h.intent = 'watch';
    release(h);
    h.stunUntil = h.t + 0.5;
    return;
  }
  if (h.t < h.stunUntil) { h.intent = 'recover'; return; }

  const view = scan(world, p);

  /* Random mashing and letting go — the whole reason they need you. */
  if (rand() < pr.mashPerSec * DECISION && pressJump(h)) h.intent = 'mash';

  if (h.t > h.wanderUntil && rand() < pr.wanderPerSec * DECISION) {
    h.wanderUntil = h.t + 0.5 + rand() * 0.7;
    h.wanderDir = rand() < 0.55 ? 0 : -1;   // mostly let go, sometimes pull back
    h.intent = h.wanderDir === 0 ? 'hesitate' : 'backpedal';
  }

  /* Enemies: either commit to a stomp or bail out entirely. */
  if (view.enemyDist < 92 && h.t > h.wanderUntil) {
    if (rand() < pr.panicChance) {
      h.wanderUntil = h.t + 0.5 + rand() * 0.5;
      h.wanderDir = -1;
      h.intent = 'panic';
    } else if (p.onGround && pressJump(h)) {
      h.intent = 'stomp';
    }
  }

  /* Gaps and spikes: they aim for a jump start that is only roughly right,
   * then their reaction time makes it later still. */
  const danger = Math.min(view.gapDist, view.hazDist);
  if (danger < Infinity) {
    const aim = lag(h) * PHYS.runSpeed + 16 + spread() * pr.aimErrorPx;
    if (danger <= aim && pressJump(h) && h.intent !== 'panic') h.intent = 'clear it';
  }

  /* Direction. Wandering wins while it lasts, otherwise: forward. */
  if (h.t < h.wanderUntil) {
    setDir(h, h.wanderDir === -1 ? -1 : 0);
  } else {
    setDir(h, 1);
    if (h.intent === 'hesitate' || h.intent === 'backpedal' || h.intent === 'recover') h.intent = 'walk';
  }
}

/* What they can see coming: the first gap, the first spike or lava, and the
 * nearest thing that moves. Distances are measured from the character's nose. */
function scan(world, p) {
  const nose = p.x + p.w;
  const footRow = Math.floor((p.y + p.h + 4) / TILE);
  let gapDist = Infinity, hazDist = Infinity, enemyDist = Infinity;

  for (let d = 0; d <= LOOKAHEAD; d += 8) {
    const cx = Math.floor((nose + d) / TILE);
    if (cx >= world.cols) break;

    if (hazDist === Infinity) {
      for (let cy = footRow - 1; cy <= footRow; cy++) {
        if (cy >= 0 && cy < ROWS && isHazard(world.grid[cy][cx])) { hazDist = d; break; }
      }
    }
    if (gapDist === Infinity) {
      let floor = false;
      for (let cy = footRow; cy <= Math.min(ROWS - 1, footRow + 2); cy++) {
        const ch = world.grid[cy][cx];
        if (isSolid(ch) || isOneWay(ch)) { floor = true; break; }
      }
      if (!floor) gapDist = d;
    }
    if (gapDist !== Infinity && hazDist !== Infinity) break;
  }

  for (const e of world.entities) {
    if (e.type !== 'enemy' || e.dead) continue;
    const d = e.x - nose;
    if (d >= -10 && d < enemyDist && Math.abs(e.y - p.y) < TILE * 2) enemyDist = d;
  }
  return { gapDist, hazDist, enemyDist };
}
