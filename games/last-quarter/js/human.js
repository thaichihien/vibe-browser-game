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
/* Pacing. The keycaps are an instrument you have to read mid-jump, so the hand
 * driving them has to move at a human speed, not a simulation speed.
 *
 * This cabinet has one stick and one button and a person has one hand: at most
 * ONE cap is down at any instant, ever. `press()` below is the only way a key
 * moves, and it is what enforces that — not convention, not care at the call
 * sites. */
const DECISION = 0.24;   // seconds between re-evaluations
const PRESS_GAP = 0.30;  // quiet time after a release before the hand can move again
const HOLD = [0.18, 0.30];       // how long a press is held, min..max

const rand = () => Math.random();
/* Two uniforms averaged — cheap bell curve, so most guesses are near-right and
 * the occasional one is wildly off. */
const spread = () => (rand() + rand() - 1);

/* `sense` comes from whichever cabinet game is running: it reports what a
 * person could see on that screen right now. Everything else in this module is
 * *who they are* rather than *what they can see*, which is why it is shared —
 * the same person walks up to every machine. */
export function makeHuman(profile, sense) {
  return {
    profile,
    sense,
    t: 0,
    decT: 0,
    queue: [],
    held: { left: false, right: false, jump: false },
    telegraph: { left: false, right: false, jump: false },
    dueIn: { left: null, right: null, jump: null },   // seconds until the press lands
    lag: profile.reactionMs / 1000,
    intent: 'walk',
    busyUntil: -9,          // the hand is mid-press until this time
    lastPress: -9,
    wanderUntil: 0,
    wanderDir: 0,
    stunUntil: 0,
    /* rising edges this frame, per channel — the judge needs to know the
     * moment a press lands on any of the three, not just the button */
    justPressed: { left: false, right: false, jump: false },
  };
}

export function humanReset(h) {
  h.queue.length = 0;
  h.held.left = h.held.right = h.held.jump = false;
  h.telegraph.left = h.telegraph.right = h.telegraph.jump = false;
  h.dueIn.left = h.dueIn.right = h.dueIn.jump = null;
  h.stunUntil = h.t + 0.55 + rand() * 0.45;
  h.wanderUntil = 0;
  h.busyUntil = -9;
  h.lastPress = -9;
}

export function updateHuman(h, world, dt) {
  h.t += dt;
  h.justPressed.left = h.justPressed.right = h.justPressed.jump = false;

  /* Apply anything whose reaction delay has elapsed. */
  for (let i = h.queue.length - 1; i >= 0; i--) {
    const cmd = h.queue[i];
    if (cmd.at > h.t) continue;
    if (cmd.down && !h.held[cmd.key]) h.justPressed[cmd.key] = true;
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

/* The whole one-key-at-a-time rule lives here.
 *
 * A press is refused outright while the hand is still busy with the previous
 * one, so two caps can never be down together and the panel never has to be
 * read as a chord. Every decision — mash, wander, turn, jump — goes through
 * this, which is why the guarantee holds without any caller having to think
 * about it. */
function press(h, key) {
  if (h.t < h.busyUntil) return false;
  const at = h.t + lag(h);
  const hold = HOLD[0] + rand() * (HOLD[1] - HOLD[0]);
  h.queue.push({ at, key, down: true });
  h.queue.push({ at: at + hold, key, down: false });
  h.busyUntil = h.t + hold + PRESS_GAP;
  h.lastPress = h.t;
  return true;
}

/* Startled: drop everything and let go. */
function release(h) {
  h.queue.length = 0;
  const at = h.t + lag(h) * 0.6;
  for (const key of ['left', 'right', 'jump']) h.queue.push({ at, key, down: false });
  h.busyUntil = at;
}

function decide(h, world) {
  const p = world.player;
  const pr = h.profile;

  if (p.dead) {
    h.intent = 'watch';
    release(h);
    h.stunUntil = h.t + 0.5;
    return;
  }
  if (h.t < h.stunUntil) { h.intent = 'recover'; return; }
  if (h.t < h.busyUntil) return;

  const view = h.sense(world);

  /* How hard they lean on the action button depends on the machine, not on who
   * they are. Nobody taps fire on a shooter — they hammer it, the same way
   * nobody hammers jump on a platformer. Without this the shooter is unfair by
   * construction: the ship has to shoot far more often than they ask for it, so
   * every extra shot reads as the machine acting on its own. */
  const mash = pr.mashPerSec * (world.judge.mashScale ?? 1);
  if (rand() < mash * DECISION && press(h, 'jump')) {
    h.intent = 'mash';
    return;
  }

  if (h.t > h.wanderUntil && rand() < pr.wanderPerSec * DECISION) {
    h.wanderUntil = h.t + 0.5 + rand() * 0.7;
    h.wanderDir = rand() < 0.55 ? 0 : -1;
    h.intent = h.wanderDir === 0 ? 'hesitate' : 'backpedal';
  }
  if (h.t < h.wanderUntil) {
    if (h.wanderDir === -1) press(h, 'left');
    return;
  }

  if (view.threatDist < 92) {
    if (rand() < pr.panicChance) {
      h.wanderUntil = h.t + 0.5 + rand() * 0.5;
      h.wanderDir = -1;
      h.intent = 'panic';
      return;
    }
    if (view.canAct && press(h, 'jump')) { h.intent = 'deal with it'; return; }
  }

  if (view.dangerDist < Infinity) {
    const aim = lag(h) * view.approachSpeed + 16 + spread() * pr.aimErrorPx;
    if (view.dangerDist <= aim && press(h, 'jump')) { h.intent = 'clear it'; return; }
  }

  /* Otherwise: keep it moving.
   *
   * Deliberately NOT conditioned on whether the character actually needs a
   * nudge. A person at a cabinet taps to make it go — they are not watching its
   * velocity and waiting for it to ask. Gating this on the cabinet's `needMove`
   * made them fall silent the moment you were keeping pace yourself, which left
   * nothing on the keycaps to obey or defy and quietly emptied the game out.
   * `press()` paces it; the steady drumbeat *is* the instruction. */
  if (view.wantDir !== 0 && press(h, view.wantDir === -1 ? 'left' : 'right')) {
    h.intent = view.wantDir === 1 ? 'go' : 'back off';
  }
}
