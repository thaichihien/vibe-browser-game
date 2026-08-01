/* The director owns the two numbers the game is actually about — and never
 * shows them.
 *
 *   FUN  how entertained the person at the cabinet is.
 *   SUS  how convinced they are that the machine is broken.
 *
 * Both are inferred by the player from the face, the comment feed, the keycaps
 * and how badly the picture is holding together. The only literal gauge on
 * screen is the three hearts, because arcade games have always had those.
 */
import { METER } from './config.js';

const lerp = (a, b, t) => a + (b - a) * t;

/* ── what they say ────────────────────────────────────────────────────────
 * Boredom lines complain about the game; suspicion lines complain about the
 * cabinet. Keeping those two voices separate is what makes the feed readable
 * as an instrument rather than decoration.
 */
const LINES = {
  start: ['ok, one game.', 'right. how hard can it be', 'here we go', 'last quarter, make it count'],
  coin: ['nice', 'ooh', 'get em all', 'shiny'],
  stomp: ['got it', 'take that', 'haha', 'squish'],
  nearmiss: ['WHOA', 'that was close', 'my heart', 'nearly!'],
  checkpoint: ['okay okay, checkpoint', 'progress!', "we're getting somewhere"],
  spring: ['woooo', 'bouncy', 'whee'],
  death1: ['oof', 'ha! ok, my bad', 'yeah that was me', 'one more go'],
  death2: ['come on', 'ugh, again?', 'that was NOT my fault'],
  death3: ['this is rigged', "I'm not enjoying this", 'seriously?'],
  bored1: ['hm.', 'is that all it does?', 'kinda slow innit'],
  bored2: ['this is a bit boring', 'wonder if the other machine is free', 'meh'],
  bored3: ['nah. done.', 'not worth another quarter', "I'm out"],
  sus1: ['huh, weird', 'did that just...', 'lag?'],
  sus2: ['I did NOT press that', "that's not what I did", 'is the stick loose?'],
  sus3: ["this machine's broken", 'nothing I press does anything', "I'm getting the attendant"],
  ghost: ['I never pressed jump.', 'it jumped on its own??', 'okay that was not me'],
  ignored: ['JUMP! I said JUMP', 'press... come ON', 'the button is stuck'],
  goal: ['YES!', 'got there!', 'told you I could', "that wasn't so bad"],
};

const pick = arr => arr[(Math.random() * arr.length) | 0];

export function makeDirector(level) {
  return {
    profile: level.player,
    fun: METER.funStart,
    sus: 0,
    hearts: METER.hearts,
    deaths: 0,
    ended: null,               // 'bored' | 'broken' | 'nohearts' | 'win'

    t: 0,
    sinceThrill: 0,
    lastMaxX: 0,
    mismatchT: 0,
    mismatchKind: null,        // 'wrongway' | 'frozen' | 'ghostmove'
    clash: { left: false, right: false, jump: 0 },

    /* jump call-and-response. Either side may press first, so both are held
     * pending until the other side's window lapses — a verdict cannot be
     * reached at the moment of the press, only once the window closes. */
    yourJumpT: -99,
    theirJumpT: -99,
    windowGrounded: false,
    judge: { windowLeft: 0, windowTotal: METER.jumpAcceptLate, verdict: null, verdictT: 0 },
    hits: 0, misses: 0,

    /* report card */
    funSum: 0, funSamples: 0, peakSus: 0, coins: 0,

    feed: [],                  // drained by the HUD each frame
    lastSaid: -9,
    lastKey: '',
    boredTier: 0,
    susTier: 0,
  };
}

export function say(d, key, { mood = 'neutral', urgent = false } = {}) {
  const gap = urgent ? 0.7 : 2.1;
  if (d.t - d.lastSaid < gap) return;
  if (key === d.lastKey && d.t - d.lastSaid < 6) return;
  const pool = LINES[key];
  if (!pool) return;
  d.lastSaid = d.t;
  d.lastKey = key;
  d.feed.push({ text: pick(pool), mood });
}

/* Attention is the whole balance: an entertained human stops watching the
 * buttons, so keeping FUN high is literally what buys room to disobey. */
export function attentionOf(d) {
  const f = Math.max(0, Math.min(1, d.fun / METER.funMax));
  return lerp(METER.attentionAtZeroFun, METER.attentionAtFullFun, f) * d.profile.attention;
}

export function updateDirector(d, world, human, you, dt) {
  if (d.ended) return;
  d.t += dt;
  d.funSum += d.fun;
  d.funSamples++;
  d.peakSus = Math.max(d.peakSus, d.sus);
  d.coins = world.coins;

  const p = world.player;
  const alive = !p.dead;

  /* ── boredom ── */
  const movingWell = alive && Math.abs(p.vx) > 90;
  d.sinceThrill += dt * (movingWell ? 0.5 : 1);
  /* boredScale is the second per-level dial. Suspicion pressure alone makes a
   * level tense; boredom pressure makes it demand showmanship. The finale turns
   * both up, so it cannot be beaten by playing quietly and in sync. */
  const boredom = lerp(METER.boredomBase, METER.boredomPeak,
                       Math.min(1, d.sinceThrill / METER.boredomRamp))
                * (d.profile.boredScale || 1);
  d.fun -= boredom * dt;
  if (alive && p.idleT > METER.idleAfter) d.fun -= METER.idleDrain * dt;

  const gained = world.maxX - d.lastMaxX;
  if (gained > 0) { d.fun += gained * METER.progressGain; d.lastMaxX = world.maxX; }

  /* ── divergence ── */
  const hDir = (human.held.right ? 1 : 0) - (human.held.left ? 1 : 0);
  const yDir = (you.right ? 1 : 0) - (you.left ? 1 : 0);
  const covered = world.cover > 0 || !alive;

  /* Waiting at the lip of a gap nothing can jump is forgiven — the human can
   * see the same screen and knows a platform has to arrive. Boredom still
   * charges for the wait, which is the honest cost of stalling. */
  let weight = 0, kind = null;
  if (!covered && !p.atLedge) {
    if (hDir !== 0 && yDir === -hDir) { weight = METER.wWrongDir; kind = 'wrongway'; }
    else if (hDir !== 0 && yDir === 0) { weight = METER.wFrozen; kind = 'frozen'; }
    else if (hDir === 0 && yDir !== 0) { weight = METER.wGhostMove; kind = 'ghostmove'; }
    /* Ignoring a deliberate pull to the left reads louder than ignoring the
     * right they were holding anyway. */
    if (hDir === -1) weight *= METER.wLeftBias;
  }

  const attention = attentionOf(d);
  if (weight > 0) {
    d.mismatchT += dt;
    if (d.mismatchT > METER.graceTime) d.sus += METER.susDirRate * weight * attention * dt;
  } else {
    d.mismatchT = 0;
    d.sus -= METER.susDecay * dt;
  }
  d.mismatchKind = d.mismatchT > METER.graceTime ? kind : null;

  judgeJump(d, world, human, attention, covered, dt);

  /* ── clamp, tier talk, endings ── */
  d.fun = Math.max(0, Math.min(METER.funMax, d.fun));
  d.sus = Math.max(0, Math.min(METER.susMax, d.sus));
  d.clash.left = d.mismatchKind !== null && (yDir === -1 || hDir === -1);
  d.clash.right = d.mismatchKind !== null && (yDir === 1 || hDir === 1);
  if (d.clash.jump > 0) d.clash.jump = Math.max(0, d.clash.jump - dt);

  const bt = d.fun < 16 ? 3 : d.fun < 34 ? 2 : d.fun < 54 ? 1 : 0;
  if (bt > d.boredTier) { say(d, 'bored' + bt, { mood: 'bored' }); }
  d.boredTier = bt;

  const st = d.sus > 78 ? 3 : d.sus > 54 ? 2 : d.sus > 30 ? 1 : 0;
  if (st > d.susTier) { say(d, 'sus' + st, { mood: 'sus' }); }
  d.susTier = st;

  if (d.fun <= 0) d.ended = 'bored';
  else if (d.sus >= METER.susMax) d.ended = 'broken';
}

/* ── the jump hit window ──────────────────────────────────────────────────
 * Their press and your jump each open a pending claim on the other. A claim is
 * only resolved when its window lapses, because whoever moved first cannot know
 * yet whether the other side is about to match them.
 *
 * The jump that gets judged is `world.justJumped` — the visible one — not the
 * keypress. A press buffered in mid-air that never leaves the ground is not
 * something the person at the cabinet can see, so it is not a lie.
 */
function judgeJump(d, world, human, attention, covered, dt) {
  const p = world.player;
  const J = d.judge;
  if (J.verdictT > 0) J.verdictT = Math.max(0, J.verdictT - dt);

  if (covered) {                       // the machine is visibly moving them
    d.yourJumpT = d.theirJumpT = -99;
    J.windowLeft = 0;
    return;
  }

  const hit = () => {
    d.yourJumpT = d.theirJumpT = -99;
    d.hits++;
    d.sus = Math.max(0, d.sus - METER.susJumpHit);
    J.verdict = 'hit';
    J.verdictT = 0.5;
    J.windowLeft = 0;
  };
  const miss = (kind) => {
    d.misses++;
    d.sus += (kind === 'ghost' ? METER.susGhostJump : METER.susIgnoredJump) * attention;
    d.clash.jump = 0.45;
    J.verdict = 'miss';
    J.verdictT = 0.5;
    say(d, kind, { mood: kind === 'ghost' ? 'sus' : 'angry', urgent: true });
  };

  if (world.justJumped) {
    if (d.theirJumpT > -90) hit();     // inside their window — obedience
    else d.yourJumpT = d.t;            // pending: they may still be about to press
  }

  if (human.justPressedJump) {
    if (d.yourJumpT > -90) hit();      // you anticipated it — still obedience
    else { d.theirJumpT = d.t; d.windowGrounded = p.onGround; }
  }

  if (d.theirJumpT > -90 && p.onGround) d.windowGrounded = true;

  if (d.yourJumpT > -90 && d.t - d.yourJumpT > METER.jumpAcceptEarly) {
    d.yourJumpT = -99;
    miss('ghost');
  }
  if (d.theirJumpT > -90 && d.t - d.theirJumpT > METER.jumpAcceptLate) {
    const grounded = d.windowGrounded;
    d.theirJumpT = -99;
    /* Never charged for a jump that was physically impossible — if the feet
     * never touched the floor while the window was open, there was nothing the
     * machine could have done. */
    if (grounded) miss('ignored');
  }

  J.windowLeft = d.theirJumpT > -90
    ? Math.max(0, METER.jumpAcceptLate - (d.t - d.theirJumpT))
    : 0;
}

/* Events routed in from the simulation. */
export function directorEvent(d, name) {
  const thrill = () => { d.sinceThrill = 0; };
  switch (name) {
    case 'coin':
      d.fun += METER.coinGain; thrill(); say(d, 'coin', { mood: 'happy' }); break;
    case 'stomp':
      d.fun += METER.stompGain; thrill(); say(d, 'stomp', { mood: 'happy' }); break;
    case 'nearmiss':
      d.fun += METER.nearMissGain; thrill(); say(d, 'nearmiss', { mood: 'happy', urgent: true }); break;
    case 'checkpoint':
      d.fun += METER.checkpointGain; thrill(); say(d, 'checkpoint', { mood: 'happy' }); break;
    case 'spring':
      thrill(); say(d, 'spring', { mood: 'happy' }); break;
    case 'death': {
      d.deaths++;
      d.hearts--;
      /* The first death of a level is a thrill. The rest are a chore. */
      d.fun += d.deaths === 1 ? METER.deathFirst : METER.deathAfter;
      thrill();
      say(d, 'death' + Math.min(3, d.deaths), { mood: d.deaths === 1 ? 'happy' : 'angry', urgent: true });
      if (d.hearts <= 0 && !d.ended) d.ended = 'nohearts';
      break;
    }
    case 'goal':
      d.fun = Math.min(METER.funMax, d.fun + 12);
      say(d, 'goal', { mood: 'happy', urgent: true });
      if (!d.ended) d.ended = 'win';
      break;
    default: break;
  }
  d.fun = Math.max(0, Math.min(METER.funMax, d.fun));
}

export function reportFor(d, world) {
  const avgFun = d.funSamples ? d.funSum / d.funSamples : 0;
  const calls = d.hits + d.misses;
  let stars = 1;
  if (d.peakSus < 62) stars++;
  if (avgFun >= 55) stars++;
  if (d.ended !== 'win') stars = 0;
  return {
    stars,
    avgFun: Math.round(avgFun),
    peakSus: Math.round(d.peakSus),
    coins: world.coins,
    coinsTotal: world.coinsTotal,
    deaths: d.deaths,
    hearts: Math.max(0, d.hearts),
    hits: d.hits,
    calls,
    sync: calls ? Math.round(100 * d.hits / calls) : 100,
    time: d.t,
  };
}
