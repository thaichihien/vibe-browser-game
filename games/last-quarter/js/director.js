/* The director owns the one number the game is actually about — and never
 * shows it.
 *
 *   PATIENCE  how much longer this person believes the joystick is connected.
 *
 * A press of yours that matched theirs puts it back; a miss takes it away.
 * Nothing else moves it — no timer, no drain, no reward for showing off. At
 * zero they decide the cabinet is broken and fetch the attendant, which is one
 * of the two ways to lose; the other is the character running out of hearts.
 *
 * It is inferred by the player from the face, the comment feed, the keycaps and
 * how badly the picture is holding together. The only literal gauge on screen
 * is the three hearts, because arcade games have always had those.
 */
import { METER } from './config.js';

const lerp = (a, b, t) => a + (b - a) * t;

const CHANNELS = ['left', 'right', 'jump'];

/* ── what they say ────────────────────────────────────────────────────────
 * Two registers. `coin` / `stomp` / `death` and friends are reactions to what
 * is on the screen — they cost nothing and mean nothing, and they are most of
 * what makes this feel like a person. `sus1..3`, `ghost` and `ignored` are the
 * instrument: they are the only lines that track the meter, so a complaint
 * about the cabinet is always real information.
 *
 * These are the defaults, worded for the platformer. Anything naming a specific
 * action — jump, fire, punch — has to be overridden by the cabinet, because a
 * shooter shouting "I never pressed jump" breaks the fiction instantly. Each
 * cabinet supplies its own `lines`; whatever it does not override falls through
 * to here.
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
  sus1: ['huh, weird', 'did that just...', 'lag?'],
  sus2: ['I did NOT press that', "that's not what I did", 'is the stick loose?'],
  sus3: ["this machine's broken", 'nothing I press does anything', "I'm getting the attendant"],
  ghost: ['I never pressed jump.', 'it jumped on its own??', 'okay that was not me'],
  ignored: ['JUMP! I said JUMP', 'press... come ON', 'the button is stuck'],
  escape: ['shoot it!', 'you let that one through', "they're getting past us", 'SHOOT'],
  goal: ['YES!', 'got there!', 'told you I could', "that wasn't so bad"],
};

const pick = arr => arr[(Math.random() * arr.length) | 0];

const channel = () => ({
  yourT: -99, theirT: -99, couldAct: false,
  windowLeft: 0, windowTotal: METER.jumpAcceptLate,
  verdict: null, verdictT: 0,
});

export function makeDirector(level, voice = {}) {
  return {
    profile: level.player,
    lines: voice,              // this machine's wording, over the defaults
    patience: METER.patienceStart,
    hearts: METER.hearts,
    deaths: 0,
    ended: null,               // 'broken' | 'nohearts' | 'win'

    /* Recent divergence pressure, 0..1, decaying. Drives the tearing and static
     * so the picture reacts to the last few seconds while the face reports
     * where the meter itself stands. */
    heat: 0,
    peakHeat: 0,

    t: 0,
    mismatchKind: null,        // set while any channel is showing a miss
    clash: { left: 0, right: 0, jump: 0 },

    /* Call-and-response, one channel per key. Either side may press first, so
     * both are held pending until the other side's window lapses — a verdict
     * cannot be reached at the moment of a press, only once the window closes.
     * Cabinets that hold a direction rather than tapping it leave the left and
     * right channels inert. */
    chan: { left: channel(), right: channel(), jump: channel() },
    hits: 0, misses: 0,

    /* report card */
    patienceSum: 0, patienceSamples: 0, lowPatience: METER.patienceStart, coins: 0,

    feed: [],                  // drained by the HUD each frame
    lastSaid: -9,
    lastKey: '',
    doubtTier: 0,
  };
}

export function say(d, key, { mood = 'neutral', urgent = false } = {}) {
  const gap = urgent ? 0.7 : 2.1;
  if (d.t - d.lastSaid < gap) return;
  if (key === d.lastKey && d.t - d.lastSaid < 6) return;
  const pool = d.lines[key] || LINES[key];
  if (!pool) return;
  d.lastSaid = d.t;
  d.lastKey = key;
  d.feed.push({ text: pick(pool), mood });
}

/* Attention is the whole balance: an absorbed human stops watching the buttons,
 * so keeping patience high is literally what buys room to disobey. */
export function attentionOf(d) {
  const f = Math.max(0, Math.min(1, d.patience / METER.patienceMax));
  return lerp(METER.attentionAtEmpty, METER.attentionAtFull, f) * d.profile.attention;
}

export function updateDirector(d, world, human, you, dt) {
  if (d.ended) return;
  d.t += dt;
  d.patienceSum += d.patience;
  d.patienceSamples++;
  d.lowPatience = Math.min(d.lowPatience, d.patience);
  d.coins = world.coins;

  const alive = !world.player.dead;

  /* Nothing here drains on a timer. Coins, distance, near misses and speed pay
   * nothing and cost nothing — they are score and spectacle. The meter moves
   * only on verdicts, down in `judgeDiscrete`. */

  /* ── divergence ────────────────────────────────────────────────────────
   * Nothing is held any more, so there is no sustained state to compare — every
   * input on every machine is a press, and the only question worth asking is
   * whether yours matched theirs in time. Three channels, one rule. */
  const covered = world.cover > 0 || !alive;
  const attention = attentionOf(d);
  /* Two prices, because the two ways of being out of step are not equally
   * visible and how visible they are depends on the machine. Acting unbidden is
   * cheap on a shooter (one more bullet among dozens) and damning on a
   * platformer (the character leapt for no reason); failing to act is obvious
   * everywhere, because a dead button is a dead button. A cabinet that does not
   * split them pays one price for both. */
  const ms = world.judge.missScale ?? 1;
  const gs = world.judge.ghostScale ?? ms;

  judgeDiscrete(d, 'left', world.justTurn === -1, human.justPressed.left,
                world.canTurn.left, attention, covered, dt, ms, gs);
  judgeDiscrete(d, 'right', world.justTurn === 1, human.justPressed.right,
                world.canTurn.right, attention, covered, dt, ms, gs);
  judgeDiscrete(d, 'jump', world.justAction, human.justPressed.jump,
                world.canAct, attention, covered, dt, ms, gs);

  /* There is no separate confidence to rebuild any more: the same matched press
   * that buys patience *is* the reassurance. What still decays is the visible
   * damage, so a bad patch tears the picture up and then settles. */
  d.heat = Math.max(0, d.heat - METER.heatDecay * dt);
  d.peakHeat = Math.max(d.peakHeat, d.heat);

  for (const k of CHANNELS) if (d.clash[k] > 0) d.clash[k] = Math.max(0, d.clash[k] - dt);
  d.mismatchKind = CHANNELS.some(k => d.clash[k] > 0) ? 'miss' : null;

  /* ── clamp, tier talk, endings ── */
  d.patience = Math.max(0, Math.min(METER.patienceMax, d.patience));

  /* One escalating voice, because there is one thing left to complain about.
   * It only ever ratchets up, so the feed reads as a mood hardening rather than
   * as a readout flickering around a threshold. */
  const tier = d.patience < 16 ? 3 : d.patience < 34 ? 2 : d.patience < 54 ? 1 : 0;
  if (tier > d.doubtTier) say(d, 'sus' + tier, { mood: 'sus' });
  d.doubtTier = tier;

  if (d.patience <= 0) d.ended = 'broken';
}

/* ── the hit window ───────────────────────────────────────────────────────
 * Their press and your action each open a pending claim on the other. A claim
 * resolves only when its window lapses, because whoever moved first cannot yet
 * know whether the other side is about to match them.
 *
 * What gets judged is the *visible* action — `world.justAction` / `world.justTurn`
 * — not your keypress. An input the machine swallowed (a jump buffered in
 * mid-air, a turn pressed mid-corridor) is not something the person at the
 * cabinet can see, so it is not a lie.
 */
function judgeDiscrete(d, key, didIt, theyPressed, canAct, attention, covered, dt,
                       missScale = 1, ghostScale = missScale) {
  const c = d.chan[key];
  if (c.verdictT > 0) c.verdictT = Math.max(0, c.verdictT - dt);

  if (covered) {                       // the machine is visibly moving them
    c.yourT = c.theirT = -99;
    c.windowLeft = 0;
    return;
  }

  const hit = () => {
    c.yourT = c.theirT = -99;
    d.hits++;
    /* The only income in the game. The machine did the exact thing they asked
     * for, on the key they asked with — that is the entire reason a person
     * stays at a cabinet, and it is both the entertainment and the
     * reassurance, which is why one number now carries both. */
    d.patience = Math.min(METER.patienceMax, d.patience + METER.hitGain);
    c.verdict = 'hit';
    c.verdictT = 0.5;
    c.windowLeft = 0;
  };
  const miss = (kind) => {
    d.misses++;
    const ghost = kind === 'ghost';
    const scale = ghost ? ghostScale : missScale;
    d.patience -= (ghost ? METER.missGhost : METER.missIgnored) * attention * scale;
    d.heat = Math.min(1, d.heat + METER.heatPerMiss * scale);
    d.clash[key] = 0.45;
    c.verdict = 'miss';
    c.verdictT = 0.5;
    say(d, kind, { mood: kind === 'ghost' ? 'sus' : 'angry', urgent: true });
  };

  if (didIt) {
    if (c.theirT > -90) hit();         // inside their window — obedience
    else c.yourT = d.t;                // pending: they may still be about to press
  }

  if (theyPressed) {
    if (c.yourT > -90) hit();          // you anticipated it — still obedience
    else { c.theirT = d.t; c.couldAct = canAct; }
  }

  if (c.theirT > -90 && canAct) c.couldAct = true;

  if (c.yourT > -90 && d.t - c.yourT > METER.jumpAcceptEarly) {
    c.yourT = -99;
    miss('ghost');
  }
  if (c.theirT > -90 && d.t - c.theirT > METER.jumpAcceptLate) {
    const could = c.couldAct;
    c.theirT = -99;
    /* Never charged for something that was physically impossible — if the
     * machine could not have obeyed at any point while the window was open,
     * there was nothing to obey with. */
    if (could) miss('ignored');
  }

  c.windowLeft = c.theirT > -90
    ? Math.max(0, METER.jumpAcceptLate - (d.t - c.theirT))
    : 0;
}

/* Events routed in from the simulation.
 *
 * None of them touch the meter — only a verdict does. What they are for is the
 * comment feed: the person reacts to what is on the screen, which is most of
 * what makes them feel like a person rather than a difficulty setting. Deaths
 * are the exception, and they spend the *other* resource.
 */
export function directorEvent(d, name) {
  switch (name) {
    case 'coin':      say(d, 'coin', { mood: 'happy' }); break;
    case 'stomp':     say(d, 'stomp', { mood: 'happy' }); break;
    case 'nearmiss':  say(d, 'nearmiss', { mood: 'happy', urgent: true }); break;
    case 'checkpoint':say(d, 'checkpoint', { mood: 'happy' }); break;
    case 'spring':    say(d, 'spring', { mood: 'happy' }); break;
    case 'escape':    say(d, 'escape', { mood: 'angry', urgent: true }); break;
    case 'death': {
      d.deaths++;
      d.hearts--;
      say(d, 'death' + Math.min(3, d.deaths), { mood: d.deaths === 1 ? 'happy' : 'angry', urgent: true });
      if (d.hearts <= 0 && !d.ended) d.ended = 'nohearts';
      break;
    }
    case 'goal':
      say(d, 'goal', { mood: 'happy', urgent: true });
      if (!d.ended) d.ended = 'win';
      break;
    default: break;
  }
}

export function reportFor(d, world) {
  /* The star rating is the only thing patience and sync are still reported
   * through, and deliberately so: printing the numbers on the end screen
   * undoes the whole premise of never drawing them during play. */
  const avgPatience = d.patienceSamples ? d.patienceSum / d.patienceSamples : 0;
  const calls = d.hits + d.misses;
  const sync = calls ? Math.round(100 * d.hits / calls) : 100;
  let stars = 1;
  if (sync >= 62) stars++;
  if (avgPatience >= 55) stars++;
  if (d.ended !== 'win') stars = 0;
  return {
    stars,
    coins: world.coins,
    coinsTotal: world.coinsTotal,
    deaths: d.deaths,
  };
}

