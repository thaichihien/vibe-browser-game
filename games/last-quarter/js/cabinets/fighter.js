/* Cabinet: FIGHTER — one screen, two fighters, best of three rounds.
 *
 * ◀ step back, ▶ step in, ⤒ attack. Holding ◀ blocks, the way every arcade
 * fighter has worked since the eighties, so one stick still does two jobs.
 *
 * Why this machine fits the game better than anything else we tried:
 *
 *  1. Guarding is a *backward* tap. If they are calling you forward and you tap
 *     back to survive, that is a press they never asked for — so the safe play
 *     is the suspicious one, and the aggressive play is the one that pleases
 *     them. The genre and the meta-layer pull against each other for free.
 *  2. A fighting game is dull when both sides turtle and thrilling when there
 *     are exchanges, which is what boredom already charges for. Here
 *     "keep them entertained" and "play well" are the same instruction.
 */
import { VIEW_W, VIEW_H, METER, DEBUG } from '../config.js';
import { emoji } from '../crt.js';

/* Swings are thrown constantly here, like shots in the shooter, so one mistimed
 * attack cannot carry a missed jump's price — a single swing among dozens is
 * simply not as damning as a jump that never happened. */
/* A single swing among dozens is not as damning as a jump that never
 * happened, so a mistimed attack is priced at half. Swinging when they never
 * asked is not discounted, though: on a fighter the character visibly lunges,
 * and doing that unbidden is the most legible thing the machine can do wrong. */
const JUDGE = { dir: 'discrete', action: 'discrete', missScale: 0.5, ghostScale: 0.45 };

const FLOOR = VIEW_H - 74;
const BODY = { w: 40, h: 58 };
const WALK = 112;
const REACH = 68;
const HEALTH = 84;
const ROUNDS_TO_WIN = 2;

/* startup → active → recovery. Whiffing leaves you in recovery, which is the
 * window the whole genre is built on. */
const ATK = { startup: 0.15, active: 0.09, recovery: 0.30, whiff: 0.52 };
const DMG = { hit: 9, counter: 16, chip: 2 };
const STUN = { hit: 0.34, block: 0.17, counter: 0.5 };
const HITSTOP = 0.075;
/* Nothing is held, so the guard is a timed window opened by a back-step rather
 * than a stance. That is better than it sounds: it is parry-shaped, far more
 * readable, and it keeps the tension — guarding still costs a press they may
 * never have asked for. */
const STEP = { dist: 46, time: 0.22 };
const GUARD_TIME = 0.36;

/* A fighting game has its own vocabulary — and "checkpoint" would be nonsense
 * for a round win, so that one is re-voiced too. */
export const LINES = {
  ghost: ['I never threw that.', 'it swung on its own??', 'that punch was not me'],
  ignored: ['HIT HIM! I pressed it!', 'the punch button is stuck', 'attack — ATTACK'],
  stomp: ['nice!', 'get in', "that's the one", 'haha, got him'],
  checkpoint: ['round to us!', 'yes! one more', "that's one", 'come on then'],
  nearmiss: ["ohhh that's clean", 'did you SEE that', 'brutal', 'get in!'],
  goal: ['YES!', "that's the match", 'told you', 'easy'],
  death1: ['oof', 'ha! ok, my bad', 'he got me', 'one more round'],
  death2: ['come on', 'block, BLOCK', 'that was NOT my fault'],
  death3: ['this thing cheats', "I'm not enjoying this", 'seriously?'],
};

export const CABINET = {
  id: 'fighter',
  judge: JUDGE,
  lines: LINES,
  build,
  step,
  draw,
  sense,
  debugDraw,
};

/* ── build ────────────────────────────────────────────────────────────── */
function build(level) {
  const world = {
    level, theme: level.theme, judge: JUDGE,
    kind: 'fighter',
    w: VIEW_W, h: VIEW_H,
    camX: 0, camY: 0, time: 0,
    progress: 0, progress01: 0,
    pickupIcon: '🏆',
    coins: 0, coinsTotal: ROUNDS_TO_WIN,
    cover: 0, shake: 0, finished: false,
    justAction: false, justTurn: 0, canAct: true,
    canTurn: { left: true, right: true },
    freeze: 0,
    round: 1, roundsWon: 0, roundsLost: 0,
    banner: 'ROUND 1', bannerT: 1.6, pendingReset: 0,
    cpu: level.cpu || {},
    player: null, foe: null,
    fx: [],
  };
  resetRound(world, true);
  return world;
}

function makeFighter(x, face) {
  return {
    x, y: FLOOR, w: BODY.w, h: BODY.h, face,
    vx: 0, hp: HEALTH,
    state: 'idle',          // idle | attack | hurt | block | ko
    t: 0, phase: '',        // attack phase
    stun: 0, hitBy: null,
    blocking: false, didHit: false, guardT: 0, stepT: 0, stepDir: 0,
    combo: 0, comboT: 0,
    /* the contract the director reads */
    dead: false, deadT: 0, invuln: 0, forcedWait: false, onGround: true,
    nearMissT: 0,
  };
}

function resetRound(world, first) {
  world.player = Object.assign(makeFighter(150, 1), { dead: false });
  world.foe = makeFighter(VIEW_W - 150 - BODY.w, -1);
  world.fx.length = 0;
  world.foeAI = { think: 0.4, want: 'approach', sawWhiff: false };
  if (!first) world.bannerT = 1.4;
  /* the machine is visibly running its own show between rounds */
  world.cover = Math.max(world.cover, 1.2);
}

const cx = f => f.x + f.w / 2;
const facing = (a, b) => (cx(b) >= cx(a) ? 1 : -1);
const gap = (a, b) => Math.abs(cx(a) - cx(b)) - BODY.w;

/* ── the frame ────────────────────────────────────────────────────────── */
function step(world, dt, input, emit) {
  world.time += dt;
  world.justAction = false;
  world.justTurn = 0;
  if (world.cover > 0) world.cover = Math.max(0, world.cover - dt);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 3);
  if (world.bannerT > 0) world.bannerT = Math.max(0, world.bannerT - dt);

  for (let i = world.fx.length - 1; i >= 0; i--) {
    const f = world.fx[i];
    f.t += dt;
    if (f.t > f.life) world.fx.splice(i, 1);
  }

  /* hitstop: a few frames of freeze on impact. It is the cheapest way to make
   * a punch feel like it landed, and this level lives or dies on that. */
  if (world.freeze > 0) { world.freeze -= dt; world.canAct = false; return; }

  /* nobody moves over a knockdown — and it is all cover, since the machine is
   * plainly running its own animation rather than answering the stick */
  if (world.pendingReset > 0) {
    world.pendingReset -= dt;
    world.cover = Math.max(world.cover, 0.4);
    world.canAct = false;
    if (world.pendingReset <= 0) { world.pendingReset = 0; resetRound(world, false); }
    return;
  }

  const p = world.player, foe = world.foe;

  if (world.bannerT > 0.4 && world.banner) {   // round intro, nobody moves
    world.canAct = false;
    return;
  }

  p.face = facing(p, foe);
  foe.face = facing(foe, p);

  stepPlayer(world, p, foe, dt, input, emit);
  stepFoe(world, foe, p, dt, emit);

  separate(p, foe);

  for (const f of [p, foe]) {
    f.comboT = Math.max(0, f.comboT - dt);
    if (f.comboT <= 0) f.combo = 0;
  }

  world.progress01 = Math.min(1,
    (world.roundsWon + (1 - foe.hp / HEALTH)) / ROUNDS_TO_WIN);
  world.progress = world.progress01 * 2000;
  world.coins = world.roundsWon;

  if (foe.hp <= 0 && foe.state !== 'ko') knockOut(world, foe, emit, true);
  else if (p.hp <= 0 && p.state !== 'ko') knockOut(world, p, emit, false);
}

function stepPlayer(world, p, foe, dt, input, emit) {
  if (p.state === 'ko') return;

  if (p.stun > 0) {
    p.stun -= dt;
    if (p.stun <= 0) { p.state = 'idle'; p.phase = ''; }
    world.canAct = false;
    return;
  }

  /* attack in flight */
  if (p.state === 'attack') {
    p.t += dt;
    advanceAttack(world, p, foe, emit);
    world.canAct = false;
    return;
  }

  /* a back-step opens the guard; a forward tap closes the distance */
  if (p.guardT > 0) p.guardT = Math.max(0, p.guardT - dt);
  if (p.stepT > 0) p.stepT = Math.max(0, p.stepT - dt);

  if (input.left) { p.guardT = GUARD_TIME; p.stepT = STEP.time; p.stepDir = -p.face; world.justTurn = -1; }
  else if (input.right) { p.stepT = STEP.time; p.stepDir = p.face; world.justTurn = 1; }

  p.blocking = p.guardT > 0;
  p.state = p.blocking ? 'block' : 'idle';
  if (p.stepT > 0) p.x += p.stepDir * (STEP.dist / STEP.time) * dt;
  p.x = Math.max(8, Math.min(VIEW_W - p.w - 8, p.x));

  world.canAct = true;
  world.canTurn.left = world.canTurn.right = true;
  if (input.jumpPressed) {
    p.state = 'attack'; p.t = 0; p.phase = 'startup'; p.didHit = false;
    world.justAction = true;
    emit('shoot');
  }
}

function advanceAttack(world, f, other, emit) {
  const { startup, active, recovery, whiff } = ATK;
  if (f.t < startup) { f.phase = 'startup'; return; }
  if (f.t < startup + active) {
    f.phase = 'active';
    if (!f.didHit && gap(f, other) <= REACH && other.state !== 'ko') {
      f.didHit = true;
      land(world, f, other, emit);
    }
    return;
  }
  /* A swing that hit nothing leaves you open far longer than one that
   * connected. This single asymmetry is what stops mashing from being a
   * winning strategy — and mashing is exactly what the person at the cabinet
   * does, so without it, obeying them wins. */
  const tail = f.didHit ? recovery : whiff;
  if (f.t < startup + active + tail) { f.phase = 'recovery'; return; }
  f.state = 'idle'; f.phase = ''; f.t = 0;
}

function land(world, attacker, victim, emit) {
  const isPlayer = attacker === world.player;
  /* a counter hit is one that lands while they were winding up — the read that
   * every fighting game is actually about */
  const counter = victim.state === 'attack' && victim.phase === 'startup';
  const blocked = victim.blocking && !counter;

  const dmg = blocked ? DMG.chip : counter ? DMG.counter : DMG.hit;
  victim.hp = Math.max(0, victim.hp - dmg);
  victim.stun = blocked ? STUN.block : counter ? STUN.counter : STUN.hit;
  victim.state = blocked ? 'block' : 'hurt';
  if (!blocked) { victim.state = 'hurt'; victim.phase = ''; }

  const push = blocked ? 14 : counter ? 34 : 24;
  victim.x = Math.max(8, Math.min(VIEW_W - victim.w - 8, victim.x + attacker.face * push));

  world.freeze = blocked ? HITSTOP * 0.6 : counter ? HITSTOP * 1.8 : HITSTOP;
  world.shake = blocked ? 0.35 : counter ? 1 : 0.6;

  world.fx.push({
    x: cx(victim) - attacker.face * 10, y: victim.y + 18,
    kind: blocked ? 'guard' : counter ? 'counter' : 'hit', t: 0, life: 0.45,
  });

  if (isPlayer) {
    attacker.combo = blocked ? attacker.combo : attacker.combo + 1;
    attacker.comboT = 1.1;
    if (blocked) emit('land');
    else {
      emit('stomp', { x: cx(victim), y: victim.y + 20, w: 1, h: 1 });
      if (counter || attacker.combo >= 2) emit('nearmiss');   // the crowd noise
    }
  } else {
    if (blocked) emit('land');
    else emit('hurt-taken');
  }
}

/* The opponent inside the cabinet game. Not the person at the controls — this
 * is just the CPU the arcade game shipped with. */
function stepFoe(world, foe, p, dt, emit) {
  if (foe.state === 'ko') return;

  if (foe.stun > 0) {
    foe.stun -= dt;
    if (foe.stun <= 0) { foe.state = 'idle'; foe.phase = ''; }
    return;
  }
  if (foe.state === 'attack') { foe.t += dt; advanceAttack(world, foe, p, emit); return; }

  const ai = world.foeAI;
  const c = world.cpu;
  ai.think -= dt;
  const d = gap(foe, p);

  /* Whiff punish — the whole genre is built on taking your turn when they have
   * spent theirs. Decided once per whiff rather than per frame: rolling every
   * frame at 60fps turns any chance below 1 into a certainty. */
  const open = p.state === 'attack' && p.phase === 'recovery' && d <= REACH;
  if (!open) ai.sawWhiff = false;
  else if (!ai.sawWhiff) {
    ai.sawWhiff = true;
    if (Math.random() < (c.punish ?? 0.5)) {
      foe.state = 'attack'; foe.t = 0; foe.phase = 'startup'; foe.didHit = false;
      ai.want = 'wait';
      return;
    }
  }

  if (ai.think <= 0) {
    ai.think = 0.22 + Math.random() * 0.24;
    if (p.state === 'attack' && p.phase === 'startup' && d < REACH * 1.2) {
      ai.want = 'block';                       // they read the wind-up
    } else if (d <= REACH * 0.92) {
      ai.want = Math.random() < (c.aggression ?? 0.62) ? 'attack'
              : Math.random() < 0.5 ? 'block' : 'back';
    } else if (d > REACH * 2.2) ai.want = 'approach';
    else ai.want = Math.random() < 0.4 ? 'approach' : 'wait';
  }

  foe.blocking = ai.want === 'block';
  foe.state = foe.blocking ? 'block' : 'idle';

  if (ai.want === 'attack' && d <= REACH) {
    foe.state = 'attack'; foe.t = 0; foe.phase = 'startup'; foe.didHit = false;
    ai.want = 'wait';
  } else if (ai.want === 'approach') {
    foe.x += foe.face * WALK * (c.speed ?? 0.82) * dt;
  } else if (ai.want === 'back') {
    foe.x -= foe.face * WALK * 0.7 * dt;
  }
  foe.x = Math.max(8, Math.min(VIEW_W - foe.w - 8, foe.x));
}

function separate(a, b) {
  const overlap = (a.x + a.w) - b.x;
  if (a.x < b.x && overlap > 0) { a.x -= overlap / 2; b.x += overlap / 2; }
  const overlap2 = (b.x + b.w) - a.x;
  if (b.x < a.x && overlap2 > 0) { b.x -= overlap2 / 2; a.x += overlap2 / 2; }
  a.x = Math.max(8, Math.min(VIEW_W - a.w - 8, a.x));
  b.x = Math.max(8, Math.min(VIEW_W - b.w - 8, b.x));
}

function knockOut(world, loser, emit, foeLost) {
  loser.state = 'ko';
  loser.stun = 0;
  world.shake = 1;
  world.freeze = 0.18;
  world.cover = Math.max(world.cover, 1.4);

  if (foeLost) {
    world.roundsWon++;
    world.banner = world.roundsWon >= ROUNDS_TO_WIN ? 'K.O.' : `ROUND ${world.round + 1}`;
    emit('checkpoint');
    if (world.roundsWon >= ROUNDS_TO_WIN) {
      world.finished = true;
      emit('goal');
      return;
    }
  } else {
    world.roundsLost++;
    world.banner = `ROUND ${world.round + 1}`;
    emit('death', { cause: 'ko' });
  }
  world.round++;
  world.bannerT = 1.8;
  /* the reset lands after the KO pose, so the knockdown has time to read */
  world.pendingReset = 1.2;
}

/* ── what the person at the cabinet can see ───────────────────────────── */
function sense(world) {
  const p = world.player, foe = world.foe;
  const d = gap(p, foe);

  /* their attack is coming: that is the thing to react to */
  const incoming = foe.state === 'attack' && foe.phase !== 'recovery' && d < REACH * 1.3;

  return {
    /* people walk forward in fighting games. Almost always. */
    wantDir: incoming ? -1 : d > REACH * 0.8 ? 1 : 0,
    needMove: incoming ? p.guardT <= 0 : d > REACH * 0.8,
    dangerDist: d > 0 ? d : 0,          // swing when they are in range
    threatDist: incoming ? d : Infinity,
    canAct: world.canAct,
    approachSpeed: WALK,
  };
}

/* ── drawing ──────────────────────────────────────────────────────────── */
function draw(r, world, d, dt) {
  const { ctx } = r;
  const th = world.theme;

  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, th.skyTop);
  g.addColorStop(1, th.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(-8, -8, VIEW_W + 16, VIEW_H + 16);

  const floorY = FLOOR + BODY.h - 8;

  /* backdrop: a rising sun and lanterns, so the upper two thirds of the stage
   * are not dead space */
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = th.accent;
  ctx.beginPath();
  ctx.arc(VIEW_W / 2, floorY - 40, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = th.groundTop;
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const x = 70 + i * 84;
    ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, 58); ctx.stroke();
    emoji(ctx, '🏮', x, 66 + Math.sin(world.time * 1.4 + i) * 3, 20);
  }
  ctx.restore();

  /* crowd, pressed up against the floor line where a crowd actually is */
  for (let i = 0; i < 34; i++) {
    const x = 6 + i * 19;
    const bob = Math.sin(world.time * 3 + i * 0.7) * 2.5;
    ctx.globalAlpha = 0.34;
    emoji(ctx, ['🧑', '👤', '🧍', '🙋'][i % 4], x, floorY - 16 + bob, 19);
  }
  ctx.globalAlpha = 1;

  /* floor */
  ctx.fillStyle = th.groundBody;
  ctx.fillRect(0, floorY, VIEW_W, VIEW_H - floorY);
  ctx.fillStyle = th.groundTop;
  ctx.fillRect(0, floorY, VIEW_W, 3);

  drawFighter(ctx, world, world.foe, world.theme.enemy, false, d);
  drawFighter(ctx, world, world.player, '🦖', true, d);

  for (const f of world.fx) {
    const k = 1 - f.t / f.life;
    ctx.globalAlpha = k;
    if (f.kind === 'guard') emoji(ctx, '🛡️', f.x, f.y, 22 + (1 - k) * 10);
    else if (f.kind === 'counter') emoji(ctx, '💢', f.x, f.y - (1 - k) * 18, 30 + (1 - k) * 14);
    else emoji(ctx, '💥', f.x, f.y, 26 + (1 - k) * 12);
    ctx.globalAlpha = 1;
  }

  healthBars(ctx, world);

  if (world.bannerT > 0 && world.banner) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, world.bannerT * 1.6);
    ctx.font = '900 34px ui-monospace,Menlo,Consolas,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = th.accent; ctx.shadowBlur = 22;
    ctx.fillStyle = '#fff';
    ctx.fillText(world.banner, VIEW_W / 2, VIEW_H / 2 - 20);
    ctx.restore();
  }
}

function drawFighter(ctx, world, f, glyph, isPlayer, d) {
  const x = cx(f), y = f.y + f.h / 2;

  if (isPlayer) {
    if (world.cover > 0) ring(ctx, x, y, 30, 'rgba(103,232,249,.75)', world.time * 6);
    else if (d && d.mismatchKind) ring(ctx, x, y, 28, 'rgba(248,113,113,.85)', world.time * 14);
  }

  /* the attack telegraph — you cannot punish what you cannot read */
  if (f.state === 'attack') {
    const col = f.phase === 'startup' ? '#fbbf24' : f.phase === 'active' ? '#f8536a' : 'rgba(255,255,255,.25)';
    ctx.save();
    ctx.globalAlpha = f.phase === 'recovery' ? 0.3 : 0.85;
    ctx.fillStyle = col;
    ctx.fillRect(x + f.face * 18, y - 4, f.face * (f.phase === 'active' ? REACH : 20), 8);
    ctx.restore();
  }
  if (f.blocking) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    emoji(ctx, '🛡️', x + f.face * -14, y, 20);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, f.y + f.h - 6, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  const lean = f.state === 'attack' && f.phase === 'active' ? f.face * 0.18
             : f.state === 'hurt' ? -f.face * 0.22 : 0;
  ctx.rotate(lean);
  if (f.state === 'ko') ctx.rotate(f.face * 1.3);
  ctx.scale(f.face < 0 ? -1 : 1, 1);
  ctx.font = '56px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (f.state === 'hurt') { ctx.shadowColor = '#f8536a'; ctx.shadowBlur = 18; }
  ctx.fillText(glyph, 0, 0);
  ctx.restore();

  if (isPlayer && f.combo >= 2) {
    ctx.save();
    ctx.font = '900 15px ui-monospace,Menlo,monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`${f.combo} HIT`, x, f.y - 12);
    ctx.restore();
  }
}

function healthBars(ctx, world) {
  const bar = (x, w, hp, flip, label) => {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x, 34, w, 12);
    const frac = Math.max(0, hp / HEALTH);
    ctx.fillStyle = frac > 0.45 ? '#4ade80' : frac > 0.2 ? '#fbbf24' : '#f8536a';
    if (flip) ctx.fillRect(x + w * (1 - frac), 34, w * frac, 12);
    else ctx.fillRect(x, 34, w * frac, 12);
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, 34.5, w - 1, 11);
    ctx.font = '700 10px ui-monospace,Menlo,monospace';
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.textAlign = flip ? 'right' : 'left';
    ctx.fillText(label, flip ? x + w : x, 55);
  };
  bar(14, 260, world.player.hp, false, 'YOU');
  bar(VIEW_W - 274, 260, world.foe.hp, true, 'CPU');

  ctx.textAlign = 'center';
  ctx.font = '700 12px ui-monospace,Menlo,monospace';
  ctx.fillStyle = '#fde047';
  ctx.fillText('●'.repeat(world.roundsWon) + '○'.repeat(ROUNDS_TO_WIN - world.roundsWon),
               VIEW_W / 2, 41);
}

function ring(ctx, x, y, rad, color, phase) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -phase * 4;
  ctx.beginPath();
  ctx.ellipse(x, y, rad, rad * 0.9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function debugDraw(ctx, world) {
  if (!DEBUG.hitboxes) return;
  ctx.save();
  ctx.lineWidth = 1;
  for (const [f, col] of [[world.player, '#22d3ee'], [world.foe, '#f43f5e']]) {
    ctx.strokeStyle = col;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    if (f.state === 'attack' && f.phase === 'active') {
      ctx.strokeStyle = '#a3e635';
      ctx.strokeRect(cx(f) + (f.face > 0 ? 0 : -REACH), f.y + 10, REACH, 20);
    }
  }
  ctx.restore();
}
