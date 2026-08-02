/* Cabinet: SHMUP — a vertical scrolling shooter.
 *
 * ◀ ▶ dodge, SPACE fires one shot. Every input is a press, judged on a hit
 * window.
 *
 * Why this machine suits the game: the ship is the only thing on screen under
 * your control, so drifting away from their stick is instantly legible — and
 * "I pressed fire and nothing came out" is the most damning thing that can
 * happen in a shooter, which finally gives the ignored-action miss a genre
 * where it is maximally visible.
 */
import { VIEW_W, VIEW_H, METER, DEBUG } from '../config.js';
import { emoji } from '../crt.js';

/* `mashScale` is what makes this machine fair. A shooter has to fire several
 * times a second to clear a wave, so a person playing one hammers the button
 * rather than tapping it — and if they did not, every shot the ship needed
 * beyond what they asked for would read as the cabinet firing on its own.
 * Even then the ship needs to shoot more than a hand can ask for, so a *ghost*
 * shot is priced near zero — one stray bullet among dozens is not something
 * anyone can pin on the machine. A dead trigger still is, so `missScale` for an
 * ignored press stays where it was. */
const JUDGE = {
  dir: 'discrete', action: 'discrete',
  missScale: 0.3, ghostScale: 0.25, mashScale: 3.5,
};

const SHIP = {
  w: 22, h: 22, y: VIEW_H - 54,
  /* A dodge is a tap, so this is the whole of a sideways move — it has to be
   * controllable rather than fast. */
  speed: 160, decay: 150,
  /* Fast on purpose. Every shot costs a press, and on this machine a press is
   * also a thing the person did or did not ask for — so the gun must never be
   * the bottleneck. Lining the ship up is the skill; waiting for a cooldown
   * would just be tax. */
  fireGap: 0.20,
  bulletSpeed: 430,
};
const SCROLL = 62;            // px/sec of stage travel
/* Flak is the shooter's whole answer to "obeying must never win". Nothing here
 * charges for an invader getting past any more, so the only thing that can end
 * a run is being hit — which means the screen has to carry enough aimed fire
 * that moving at random gets you killed and moving deliberately does not. */
const ENEMY = { w: 26, h: 24, bulletSpeed: 140 };
const GRAZE = 26;             // how close a bullet must pass to thrill them
/* The ship is 22px of sprite and 13px of ship. Every shooter worth playing keeps
 * the hitbox under the picture — that is what makes threading a pattern feel
 * skilful rather than arbitrary, and it is what stops a near miss being a death.
 * At 8 it was under-generous in the other direction: bullets passed visibly
 * *through* the rocket without registering, which reads as the game being broken
 * just as much as an unfair hit does. */
const HURT = 13;

/* Nobody at a shooting game says "jump". Every line that names the action has
 * to be re-voiced, or the feed stops sounding like a person watching this
 * screen. */
export const LINES = {
  ghost: ['I never pressed fire.', 'it shot on its own??', 'okay, that shot was not me'],
  ignored: ["FIRE! I'm pressing fire!", 'the fire button is dead', 'shoot — SHOOT'],
  stomp: ['got one', 'boom', 'splash one', 'nice shot'],
  coin: ['grab it', 'ooh, a star', 'mine', 'shiny'],
  nearmiss: ['that one grazed us', 'WHOA', 'millimetres', 'my heart'],
  goal: ['YES!', 'stage clear!', 'told you I could fly', 'get in!'],
};

export const CABINET = {
  id: 'shmup',
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
  const stage = level.stage;
  const world = {
    level, theme: level.theme, judge: JUDGE,
    kind: 'shmup',
    w: VIEW_W, h: VIEW_H,
    camX: 0, camY: 0, time: 0,
    progress: 0, progress01: 0,
    scrollLen: stage.length,
    pickupIcon: '⭐',
    coins: 0, coinsTotal: stage.waves.reduce((n, w) => n + (w.drops || 0), 0),
    cover: 0, shake: 0, finished: false,
    justAction: false, justTurn: 0, canAct: true,
    canTurn: { left: true, right: true },
    entities: [],
    bullets: [],          // yours
    flak: [],             // theirs
    stars: makeStarfield(),
    waves: stage.waves.map(w => ({ ...w, done: false })),
    currents: stage.currents || [],
    boss: null,
    flash: 0,
    player: makeShip(),
  };
  return world;
}

function makeShip() {
  return {
    x: VIEW_W / 2 - SHIP.w / 2, y: SHIP.y,
    w: SHIP.w, h: SHIP.h,
    vx: 0, vy: 0,
    onGround: true,           // meaningless here, but the contract expects it
    dead: false, deadT: 0, invuln: 1.0,
    forcedWait: false,
    cool: 0, nearMissT: 0, facing: 1, squash: 0,
  };
}

function makeStarfield() {
  let s = 20250802;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 70 }, () => ({
    x: rnd() * VIEW_W, y: rnd() * VIEW_H,
    z: 0.35 + rnd() * 1.1, size: rnd() < 0.75 ? 1 : 2,
  }));
}

const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const hurtBox = p => ({
  x: p.x + (p.w - HURT) / 2, y: p.y + (p.h - HURT) / 2, w: HURT, h: HURT,
});

/* ── the frame ────────────────────────────────────────────────────────── */
function step(world, dt, input, emit) {
  world.time += dt;
  world.justAction = false;
  world.justTurn = 0;
  if (world.cover > 0) world.cover = Math.max(0, world.cover - dt);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 3);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt * 2.5);

  const p = world.player;

  /* the stage only advances while you are alive to fly it */
  if (!p.dead && !world.finished) {
    world.progress = Math.min(world.scrollLen, world.progress + SCROLL * dt);
    world.progress01 = world.progress / world.scrollLen;
  }
  for (const s of world.stars) {
    s.y += SCROLL * s.z * dt;
    if (s.y > VIEW_H) { s.y -= VIEW_H; s.x = (s.x * 7 + 31) % VIEW_W; }
  }

  spawnWaves(world);
  stepEnemies(world, dt, emit);
  stepBullets(world, dt, emit);

  if (p.dead) {
    p.deadT -= dt;
    world.canAct = false;
    world.canTurn.left = world.canTurn.right = false;
    if (p.deadT <= 0) respawn(world, emit);
    return;
  }

  if (p.invuln > 0) p.invuln -= dt;
  p.cool = Math.max(0, p.cool - dt);

  /* ── nebula current: the stage moving you, not the stick ── */
  const cur = world.currents.find(c => world.progress >= c.from && world.progress <= c.to);
  if (cur) {
    p.x += cur.dir * 58 * dt;
    world.cover = Math.max(world.cover, METER.coverRide);
  }

  /* ── dodge: a tap throws the ship sideways, then it drifts to a stop ── */
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    p.vx = dir * SHIP.speed;
    p.facing = dir;
    world.justTurn = dir;
  } else {
    const drop = SHIP.decay * dt;
    p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - Math.sign(p.vx) * drop;
  }
  p.x += p.vx * dt;
  if (p.x < 4) { p.x = 4; p.vx = 0; }
  if (p.x > VIEW_W - p.w - 4) { p.x = VIEW_W - p.w - 4; p.vx = 0; }

  /* ── fire ── */
  const couldFire = p.cool <= 0;
  if (input.jumpPressed && couldFire) {
    p.cool = SHIP.fireGap;
    world.bullets.push({ x: p.x + p.w / 2 - 2, y: p.y - 6, w: 4, h: 10 });
    world.justAction = true;
    p.squash = -0.25;
    emit('shoot');
  }
  p.squash *= Math.max(0, 1 - dt * 7);
  /* "I pressed fire and nothing came out" is only a lie if the gun was ready */
  world.canAct = couldFire;
  world.canTurn.left = world.canTurn.right = true;


  collide(world, emit);
  graze(world, dt, emit);

  if (!world.finished && world.progress >= world.scrollLen &&
      !world.boss && !world.entities.some(e => e.type === 'enemy' && !e.dead)) {
    world.finished = true;
    emit('goal');
  }
}

function spawnWaves(world) {
  for (const w of world.waves) {
    if (w.done || world.progress < w.at) continue;
    w.done = true;
    if (w.kind === 'boss') { spawnBoss(world, w); continue; }
    const n = w.n || 4;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      world.entities.push({
        type: 'enemy', kind: w.kind,
        x: 40 + t * (VIEW_W - 80) - ENEMY.w / 2, y: -30 - i * (w.stagger || 0),
        w: ENEMY.w, h: ENEMY.h,
        hp: w.hp || 1, t: 0, phase: t * Math.PI * 2,
        baseX: 40 + t * (VIEW_W - 80) - ENEMY.w / 2,
        speed: w.speed || 46, fireEvery: w.fireEvery || 2.3, fireT: 0.8 + t,
        drop: i < (w.drops || 0),
        emoji: w.emoji || world.theme.enemy, dead: 0,
      });
    }
  }
}

function spawnBoss(world, w) {
  world.boss = {
    type: 'boss', x: VIEW_W / 2 - 40, y: -70, w: 80, h: 56,
    hp: w.hp || 14, maxHp: w.hp || 14, dir: 1, t: 0, fireT: 1.2, dead: 0,
    emoji: w.emoji || '🛸',
  };
  world.entities.push(world.boss);
}

function stepEnemies(world, dt, emit) {
  const p = world.player;
  for (let i = world.entities.length - 1; i >= 0; i--) {
    const e = world.entities[i];

    if (e.dead) {
      e.dead += dt;
      if (e.dead > 0.4) world.entities.splice(i, 1);
      continue;
    }

    if (e.type === 'star') {
      e.y += e.vy * dt;
      if (e.y > VIEW_H + 20) world.entities.splice(i, 1);
      continue;
    }

    e.t += dt;

    if (e.type === 'boss') {
      e.y = Math.min(48, e.y + 42 * dt);
      e.x += e.dir * 70 * dt;
      if (e.x < 10) { e.x = 10; e.dir = 1; }
      if (e.x > VIEW_W - e.w - 10) { e.x = VIEW_W - e.w - 10; e.dir = -1; }
      /* The boss is the gate, and it alternates on purpose. The fan leaves gaps
       * you have to be standing in; the aimed pair punishes standing still. One
       * of those is beaten by moving at random and the other by not moving, so
       * neither is — which is what a lucky obedient run has to fail against. */
      e.fireT -= dt;
      if (e.fireT <= 0 && e.y > 10) {
        e.fireT = 1.25;
        e.volley = (e.volley || 0) + 1;
        const cx = e.x + e.w / 2 - 4, cy = e.y + e.h;
        if (e.volley % 2) {
          for (let k = -2; k <= 2; k++) {
            world.flak.push({ x: cx, y: cy, w: 8, h: 8, vx: k * 58, vy: ENEMY.bulletSpeed });
          }
        } else {
          const tx = p.x + p.w / 2 - cx, ty = p.y - cy;
          const len = Math.hypot(tx, ty) || 1;
          for (const off of [-16, 16]) {
            world.flak.push({
              x: cx, y: cy, w: 8, h: 8,
              vx: (tx / len) * ENEMY.bulletSpeed + off,
              vy: (ty / len) * ENEMY.bulletSpeed,
            });
          }
        }
      }
      continue;
    }

    /* descent patterns — all of them keep the ship moving laterally, which is
     * exactly where the disagreement with the stick lives */
    if (e.kind === 'sweep') {
      e.y += e.speed * dt;
      e.x = e.baseX + Math.sin(e.t * 1.6 + e.phase) * 54;
    } else if (e.kind === 'dive') {
      e.y += (e.speed + e.t * 42) * dt;
      e.x += Math.sin(e.t * 3) * 34 * dt;
    } else {
      e.y += e.speed * dt;                       // 'row'
    }

    if (e.y > VIEW_H + 40) {
      /* Let it go. Nothing that never touched the ship costs a heart on this
       * machine — an invader flying off the bottom is a thing they shout about
       * and nothing more. What stops obedience winning here is the flak: see
       * `fireEvery` in the stage. */
      world.entities.splice(i, 1);
      emit('escape');
      continue;
    }

    e.fireT -= dt;
    if (e.fireT <= 0 && e.y > 0 && e.y < VIEW_H * 0.7) {
      e.fireT = e.fireEvery;
      const cx = e.x + e.w / 2, cy = e.y + e.h;
      const tx = p.x + p.w / 2 - cx, ty = p.y - cy;
      const len = Math.hypot(tx, ty) || 1;
      world.flak.push({
        x: cx - 4, y: cy, w: 8, h: 8,
        vx: (tx / len) * ENEMY.bulletSpeed * 0.28,
        vy: Math.max(70, (ty / len) * ENEMY.bulletSpeed),
      });
    }
  }
}

function stepBullets(world, dt, emit) {
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.y -= SHIP.bulletSpeed * dt;
    if (b.y < -14) { world.bullets.splice(i, 1); continue; }

    for (const e of world.entities) {
      if (e.dead || e.type === 'star' || !overlap(b, e)) continue;
      world.bullets.splice(i, 1);
      e.hp -= 1;
      if (e.hp <= 0) {
        e.dead = 0.001;
        if (e.type === 'boss') { world.boss = null; world.flash = 1; }
        if (e.drop) {
          world.entities.push({
            type: 'star', x: e.x + e.w / 2 - 9, y: e.y + 4, w: 18, h: 18,
            vy: 58, taken: false, dead: 0, hp: 1,
          });
        }
        emit('stomp', e);
      }
      break;
    }
  }

  for (let i = world.flak.length - 1; i >= 0; i--) {
    const f = world.flak[i];
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.y > VIEW_H + 20 || f.x < -20 || f.x > VIEW_W + 20) world.flak.splice(i, 1);
  }
}

function collide(world, emit) {
  const p = world.player;

  const hurt = hurtBox(p);
  for (const e of world.entities) {
    if (e.type === 'star' && !e.dead) {
      /* pickups use the generous full sprite — being rewarded should be easy */
      if (overlap(p, e)) {
        e.dead = 0.001;
        world.coins++;
        emit('coin', e);
      }
      continue;
    }
    if (e.dead || e.type === 'star') continue;
    if (p.invuln <= 0 && overlap(hurt, e)) return kill(world, emit);
  }

  if (p.invuln > 0) return;
  for (const f of world.flak) {
    if (overlap(hurt, f)) return kill(world, emit);
  }
}

/* Grazing — the shmup thrill, and the same idea as the platformer's near miss:
 * you were nearly hit and you were not. */
function graze(world, dt, emit) {
  const p = world.player;
  p.nearMissT = Math.max(0, p.nearMissT - dt);
  if (p.nearMissT > 0 || p.invuln > 0) return;
  const h = hurtBox(p);
  const box = { x: h.x - GRAZE, y: h.y - GRAZE, w: h.w + GRAZE * 2, h: h.h + GRAZE * 2 };
  for (const f of world.flak) {
    if (!overlap(box, f)) continue;
    p.nearMissT = METER.nearMissCooldown;
    emit('nearmiss');
    return;
  }
}

function kill(world, emit) {
  const p = world.player;
  if (p.dead) return;
  p.dead = true;
  p.deadT = 0.85;
  p.vx = 0;
  world.shake = 1;
  emit('death', { cause: 'hit' });
}

function respawn(world, emit) {
  const p = world.player;
  Object.assign(p, makeShip());
  p.invuln = 2.0;
  world.flak.length = 0;                          // a fair restart, not a wall
  world.cover = 0;
  emit('respawn');
}

/* ── what the person at the cabinet can see ───────────────────────────── */
function sense(world) {
  const p = world.player;
  const cx = p.x + p.w / 2;

  let dangerDist = Infinity, threatDist = Infinity, aimX = null, dodgeDir = 0;

  for (const e of world.entities) {
    if (e.dead || (e.type !== 'enemy' && e.type !== 'boss')) continue;
    const ex = e.x + e.w / 2;
    if (aimX === null || Math.abs(ex - cx) < Math.abs(aimX - cx)) aimX = ex;
    if (Math.abs(ex - cx) < 34) dangerDist = Math.min(dangerDist, Math.max(0, p.y - e.y - e.h));
  }

  for (const f of world.flak) {
    if (f.vy <= 0 || f.y > p.y) continue;
    const dx = (f.x + 4) - cx;
    if (Math.abs(dx) > 46) continue;
    const d = p.y - f.y;
    if (d < threatDist) { threatDist = d; dodgeDir = dx > 0 ? -1 : 1; }
  }

  let wantDir = 0;
  if (threatDist < 150) wantDir = dodgeDir;                  // get out of the way
  else if (aimX !== null && Math.abs(aimX - cx) > 12) wantDir = aimX > cx ? 1 : -1;

  return {
    wantDir,
    /* a dodge only needs re-tapping once the last one has bled off */
    needMove: wantDir !== 0 && Math.sign(p.vx) !== wantDir,
    dangerDist,                       // an enemy is lined up: shoot it
    threatDist,                       // incoming fire: dodge or panic
    canAct: world.canAct,
    approachSpeed: 60,                // how fast a lined-up enemy closes
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

  for (const s of world.stars) {
    ctx.fillStyle = `rgba(255,255,255,${0.18 + s.z * 0.4})`;
    ctx.fillRect(s.x, s.y, s.size, s.size + s.z);
  }

  /* nebula current — the stage visibly pushing you, so divergence is free */
  const cur = world.currents.find(c => world.progress >= c.from && world.progress <= c.to);
  if (cur) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 22; i++) {
      const y = ((world.time * 150 + i * 41) % (VIEW_H + 60)) - 30;
      const x = ((i * 97) % VIEW_W);
      ctx.fillStyle = th.accent;
      ctx.fillRect(x, y, cur.dir * 26, 2);
    }
    ctx.restore();
  }

  for (const b of world.bullets) {
    ctx.fillStyle = '#bef264';
    ctx.shadowColor = '#a3e635'; ctx.shadowBlur = 8;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.shadowBlur = 0;
  }

  for (const e of world.entities) {
    if (e.type === 'star') {
      if (e.dead) continue;
      ctx.save();
      ctx.shadowColor = '#fde047'; ctx.shadowBlur = 12;
      emoji(ctx, '⭐', e.x + e.w / 2, e.y + e.h / 2, 18);
      ctx.restore();
      continue;
    }
    if (e.dead) {
      ctx.globalAlpha = Math.max(0, 1 - e.dead * 2.5);
      emoji(ctx, '💥', e.x + e.w / 2, e.y + e.h / 2, (e.type === 'boss' ? 60 : 30) * (1 + e.dead));
      ctx.globalAlpha = 1;
      continue;
    }
    if (e.type === 'boss') {
      ctx.save();
      ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 22;
      emoji(ctx, e.emoji, e.x + e.w / 2, e.y + e.h / 2, 56);
      ctx.restore();
      const w = e.w, hp = e.hp / e.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x, e.y - 10, w, 5);
      ctx.fillStyle = '#f8536a'; ctx.fillRect(e.x, e.y - 10, w * hp, 5);
      continue;
    }
    /* glow behind every enemy: unlit, a purple invader on a purple nebula is
     * invisible, and the thing that kills you must never be the hard thing to
     * see */
    ctx.save();
    ctx.shadowColor = e.hp > 1 ? '#fb7185' : '#7dd3fc';
    ctx.shadowBlur = 14;
    emoji(ctx, e.emoji, e.x + e.w / 2, e.y + e.h / 2, 25,
          Math.sin(world.time * 6 + e.phase) * 0.1);
    ctx.restore();
  }

  for (const f of world.flak) {
    ctx.fillStyle = '#fb7185';
    ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(f.x + 4, f.y + 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawShip(ctx, world, d);

  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * world.flash})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawShip(ctx, world, d) {
  const p = world.player;
  const x = p.x + p.w / 2, y = p.y + p.h / 2;

  if (world.cover > 0) ring(ctx, x, y, 22, 'rgba(103,232,249,.75)', world.time * 6);
  else if (d && d.mismatchKind) ring(ctx, x, y, 20, 'rgba(248,113,113,.85)', world.time * 14);

  if (p.dead) { emoji(ctx, '💥', x, y, 38); return; }
  if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) return;

  /* thruster */
  const fl = 8 + Math.sin(world.time * 30) * 4;
  const flame = ctx.createLinearGradient(0, p.y + p.h - 4, 0, p.y + p.h + fl);
  flame.addColorStop(0, 'rgba(255,255,255,.9)');
  flame.addColorStop(0.4, 'rgba(103,232,249,.85)');
  flame.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(x - 5, p.y + p.h - 4);
  ctx.lineTo(x + 5, p.y + p.h - 4);
  ctx.lineTo(x, p.y + p.h + fl);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.vx / SHIP.speed * 0.22);
  ctx.scale(1 + p.squash, 1 - p.squash);
  ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🚀', 0, 0);
  ctx.restore();
}

function ring(ctx, x, y, rad, color, phase) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -phase * 4;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function debugDraw(ctx, world) {
  if (!DEBUG.hitboxes) return;
  const p = world.player;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#22d3ee';
  ctx.strokeRect(p.x, p.y, p.w, p.h);
  ctx.strokeStyle = '#f43f5e';
  for (const e of world.entities) if (!e.dead) ctx.strokeRect(e.x, e.y, e.w, e.h);
  for (const f of world.flak) ctx.strokeRect(f.x, f.y, f.w, f.h);
  ctx.restore();
}
