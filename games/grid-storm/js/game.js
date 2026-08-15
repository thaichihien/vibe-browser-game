/* The engine: state, the loop, movement, the base missile spawner and the
   event scheduler. Everything an event can touch hangs off `g`. */

import {
  BASE_SIZE, BIG_SIZE, CENTER, BASE_SPAWN, COUNT_STEP, FIRST_EVENT_AT, EVENT_GAP,
  MAX_CONCURRENT, PLAYER, PALETTE, pick, rnd, rndi, clamp, lerp
} from './config.js';
import { makeRenderer } from './render.js';
import { makeFx, updateFx, burst, ring, floatText, flash, shake } from './fx.js';
import { updateBullets, updateHazards, edgeShot } from './bullets.js';
import { Sound } from './audio.js';
import { EVENTS, FIRST_EVENT, pickEvent } from './events/index.js';

export function createGame(canvas, hooks = {}) {
  const R = makeRenderer(canvas);

  const g = {
    running: false, alive: false,
    time: 0, deadT: 0, best: 0,
    size: BASE_SIZE, lo: 0, hi: 0, center: CENTER,
    bullets: [], hazards: [], fx: makeFx(),
    events: [], recent: [], firstDone: false, nextEventAt: 0,
    timeScale: 1, speed: BASE_SPAWN.speed[0],
    spawnT: 0, spawnEvery: BASE_SPAWN.every[0], spawnCount: BASE_SPAWN.count[0],
    frozenCount: null, expandedAt: 0, lastStep: 0,
    expand: null, deathReason: '', deathEmoji: '💀',
    flags: { gravity: false, fog: 0, wrap: false, ice: false, invert: 0 },
    player: { gx: 0, gy: 0, px: 0, py: 0, face: '🙂', shield: 0, iFrames: 0 }
  };

  /* ── helpers events rely on ───────────────────────────────────────────── */

  g.playerCell = () => [Math.round(g.player.px), Math.round(g.player.py)];
  g.randCell = () => [rndi(g.lo, g.hi), rndi(g.lo, g.hi)];
  g.inside = (x, y) => x >= g.lo && x <= g.hi && y >= g.lo && y <= g.hi;

  g.expandGrid = () => {
    if (g.size === BIG_SIZE) return;
    g.expand = { t: 0, oldLo: g.lo, oldHi: g.hi };
    setSize(BIG_SIZE);

    // the new edges shoot too, and that volley size is then frozen — from here
    // on it only steps up on the schedule in COUNT_STEP
    g.expandedAt = g.time;
    g.frozenCount = g.spawnCount + 1;
  };

  g.kill = (reason, emoji = '💀', unblockable = false) => {
    if (!g.alive) return;

    if (!unblockable && g.player.iFrames > 0) return;

    if (!unblockable && g.player.shield > 0) {
      g.player.shield = 0;
      g.player.iFrames = 1.5;
      Sound.blast();
      flash(g.fx, '#7cf7ff', 0.35);
      shake(g.fx, 10);
      ring(g.fx, g.player.px, g.player.py, '#7cf7ff', 0.4, 3, 0.5, 6);
      floatText(g.fx, g.player.px, g.player.py - 0.8, 'BLOCKED', '#7cf7ff', 1, 0.5);
      // clear whatever is sitting on top of you so the shield is worth having
      g.bullets = g.bullets.filter(b =>
        Math.hypot(b.x - g.player.px, b.y - g.player.py) > 1.6);
      return;
    }

    g.alive = false;
    g.deadT = 0;
    g.deathReason = reason;
    g.deathEmoji = emoji;

    Sound.die();
    shake(g.fx, 22);
    flash(g.fx, '#ff2e5b', 0.55);
    burst(g.fx, g.player.px, g.player.py, '#ff2e5b', 34, 9, '💥');
    ring(g.fx, g.player.px, g.player.py, '#ff2e5b', 0.3, 5, 0.7, 7);
    g.player.face = '💀';

    if (hooks.onDeath) hooks.onDeath(Math.floor(g.time), reason, emoji);
  };

  /* a forced move (gravity, black hole) — ignores scramble and ice */
  g.shove = (dx, dy, reason, emoji) => {
    if (!g.alive) return;
    const nx = g.player.gx + dx, ny = g.player.gy + dy;

    if (!g.inside(nx, ny)) {
      if (g.flags.wrap) { warpTo(wrapC(nx), wrapC(ny)); return; }
      g.player.gx = nx; g.player.gy = ny;
      g.kill(reason, emoji, true);
      return;
    }
    g.player.gx = nx; g.player.gy = ny;
    burst(g.fx, g.player.px, g.player.py, '#ff8a3d', 4, 2);
  };

  function setSize(n) {
    g.size = n;
    g.lo = (BIG_SIZE - n) / 2;
    g.hi = g.lo + n - 1;
  }

  const wrapC = v => {
    const span = g.hi - g.lo + 1;
    return v < g.lo ? v + span : v > g.hi ? v - span : v;
  };

  function warpTo(x, y) {
    g.player.gx = x; g.player.gy = y;
    g.player.px = x; g.player.py = y;   // no sliding across the whole board
    burst(g.fx, x, y, '#b388ff', 10, 4, '🌀');
  }

  /* ── input ────────────────────────────────────────────────────────────── */

  function rotate(dx, dy, turns) {
    let x = dx, y = dy;
    for (let i = 0; i < (turns || 0); i++) { const nx = -y; y = x; x = nx; }
    return [x, y];
  }

  g.move = (dx, dy) => {
    if (!g.alive) return;
    const [mx, my] = rotate(dx, dy, g.flags.invert);
    const steps = g.flags.ice ? 2 : 1;   // one extra cell — the board is only 9 wide

    for (let i = 0; i < steps; i++) {
      const nx = g.player.gx + mx, ny = g.player.gy + my;

      if (!g.inside(nx, ny)) {
        if (g.flags.wrap) { warpTo(wrapC(nx), wrapC(ny)); continue; }
        if (i === 0) {
          g.player.gx = nx; g.player.gy = ny;
          g.kill('walked off the grid', '💀', true);
          return;
        }
        break;                      // ice slides stop at the wall
      }
      g.player.gx = nx; g.player.gy = ny;
    }

    Sound.step();
    if (g.flags.ice) burst(g.fx, g.player.px, g.player.py, '#7cf7ff', 4, 2, '❄️');
  };

  /* ── base missiles: the plain Grid Survival volley, ramping up ────────── */

  function rampBase() {
    const p = clamp(g.time / BASE_SPAWN.ramp, 0, 1);

    g.speed = lerp(BASE_SPAWN.speed[0], BASE_SPAWN.speed[1], p);
    g.spawnEvery = lerp(BASE_SPAWN.every[0], BASE_SPAWN.every[1], p) *
      (g.size === BIG_SIZE ? 0.85 : 1);

    if (g.frozenCount === null) {
      // still on the small grid: one missile, then two, then more
      g.spawnCount = Math.round(lerp(BASE_SPAWN.count[0], BASE_SPAWN.count[1], p));
      return;
    }

    const since = g.time - g.expandedAt;
    const extra = since < COUNT_STEP.first ? 0
      : Math.min(COUNT_STEP.max, 1 + Math.floor((since - COUNT_STEP.first) / COUNT_STEP.every));

    g.spawnCount = g.frozenCount + extra;

    if (extra > g.lastStep) {
      g.lastStep = extra;
      floatText(g.fx, g.center, g.center - 1.4, '+1 MISSILE', '#ff9800', 1.6, 0.55);
      Sound.charge();
      shake(g.fx, 5);
    }
  }

  function spawnVolley() {
    for (let i = 0; i < g.spawnCount; i++) {
      edgeShot(g, rndi(0, 3), rndi(g.lo, g.hi), g.speed, {
        r: 0.22,
        color: pick(PALETTE),
        shape: pick(['circle', 'diamond', 'bar', 'star']),
        spin: rnd(-4, 4),
        trailRate: 0.045
      });
    }
    Sound.fire();
  }

  /* ── the event scheduler ──────────────────────────────────────────────── */

  function startEvent(def) {
    const e = { def, t: 0, duration: def.duration || 10 };

    if (def.permanent) {
      if (def.start) def.start(g, e);
    } else {
      if (def.start) def.start(g, e);
      g.events.push(e);
    }

    g.recent.push(def.id);
    if (g.recent.length > 4) g.recent.shift();

    if (!def.relief) { Sound.event(); shake(g.fx, 7); }
    if (hooks.onEvent) hooks.onEvent(def);   // the banner names it; no canvas echo
  }

  function scheduleEvents(dt) {
    if (!g.firstDone) {
      if (g.time >= FIRST_EVENT_AT) {
        g.firstDone = true;
        startEvent(FIRST_EVENT);
        g.nextEventAt = g.time + EVENT_GAP;
      }
      return;
    }

    if (g.time < g.nextEventAt) return;

    const solo = g.events.some(e => e.def.solo);
    if (solo || g.events.length >= MAX_CONCURRENT) { g.nextEventAt = g.time + 1.5; return; }

    const def = pickEvent(g.events.map(e => e.def.id), g.recent, g.events.length === 0);
    if (!def) { g.nextEventAt = g.time + 2; return; }

    startEvent(def);

    // solo set-pieces own the board, so the clock restarts when they finish
    g.nextEventAt = g.time +
      (def.solo ? def.duration + 2.5 : def.relief ? 3 : EVENT_GAP);
  }

  function updateEvents(dt) {
    g.events = g.events.filter(e => {
      e.t += dt;
      if (e.def.update) e.def.update(g, e, dt);
      if (e.t < e.duration) return true;
      if (e.def.end) e.def.end(g, e);
      return false;
    });
  }

  /* ── collision + look ─────────────────────────────────────────────────── */

  function collide() {
    if (!g.alive || g.player.iFrames > 0) return;

    for (const b of g.bullets) {
      if (!b.deadly) continue;
      if (Math.abs(b.x - g.player.px) < PLAYER.half + b.r &&
          Math.abs(b.y - g.player.py) < PLAYER.half + b.r) {
        g.kill('hit by incoming fire', b.emoji || '💥');
        return;
      }
    }
  }

  function updateFace() {
    if (!g.alive) { g.player.face = '💀'; return; }

    let near = 99;
    for (const b of g.bullets) {
      const d = Math.hypot(b.x - g.player.px, b.y - g.player.py);
      if (d < near) near = d;
    }

    g.player.face = near < 1.15 ? '😱'
      : g.flags.ice ? '🥶'
      : g.flags.fog ? '👀'
      : g.player.shield > 0 ? '😎'
      : near < 2.4 ? '😬' : '🙂';
  }

  /* ── loop ─────────────────────────────────────────────────────────────── */

  let last = 0, raf = 0;

  function frame(now) {
    if (!g.running) return;
    raf = requestAnimationFrame(frame);

    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt);
    R.frame(g);
  }

  function step(dt) {
    if (g.alive) {
      g.time += dt;
      g.player.iFrames = Math.max(0, g.player.iFrames - dt);

      rampBase();
      scheduleEvents(dt);
      updateEvents(dt);

      const soloOn = g.events.some(e => e.def.solo);
      g.spawnT -= dt;
      if (!soloOn && g.time > 1 && g.spawnT <= 0) { g.spawnT = g.spawnEvery; spawnVolley(); }
    } else {
      g.deadT += dt;
      dt *= 0.35;                         // slow-motion death
    }

    if (g.expand) {
      g.expand.t += dt;
      if (g.expand.t > 1.2) g.expand = null;
    }

    updateBullets(g, dt);
    updateHazards(g, dt);
    updateFx(g.fx, dt);

    // smooth glide toward the target cell
    const k = Math.min(1, dt * PLAYER.ease);
    g.player.px += (g.player.gx - g.player.px) * k;
    g.player.py += (g.player.gy - g.player.py) * k;

    collide();
    updateFace();

    if (hooks.onTick) hooks.onTick(g);
  }

  /* ── controls ─────────────────────────────────────────────────────────── */

  return {
    g,
    R,

    /* `opts.time` fast-forwards the clock — used by ?t= for testing events
       without sitting through the first minute every run. */
    start(opts = {}) {
      cancelAnimationFrame(raf);

      g.bullets = []; g.hazards = []; g.fx = makeFx();
      g.events = []; g.recent = []; g.firstDone = false; g.nextEventAt = 0;
      g.time = 0; g.deadT = 0; g.timeScale = 1; g.expand = null;
      g.frozenCount = null; g.expandedAt = 0; g.lastStep = 0;
      g.flags = { gravity: false, fog: 0, wrap: false, ice: false, invert: 0 };
      setSize(BASE_SIZE);

      g.player.gx = g.player.px = CENTER;
      g.player.gy = g.player.py = CENTER;
      g.player.shield = 0;
      g.player.iFrames = 1.0;
      g.player.face = '🙂';

      g.spawnT = 1.0;
      g.time = Math.max(0, opts.time || 0);
      g.alive = true;
      g.running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },

    /* force one event on demand (dev mode / codex sandbox) */
    trigger(id) {
      const def = EVENTS.find(d => d.id === id) || (id === FIRST_EVENT.id ? FIRST_EVENT : null);
      if (!def || !g.alive) return false;
      if (g.events.some(e => e.def.id === def.id)) return false;
      startEvent(def);
      return true;
    },

    stop() { g.running = false; cancelAnimationFrame(raf); },

    resume() {
      if (!g.alive || g.running) return;
      g.running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },

    move: (dx, dy) => g.move(dx, dy),
    events: EVENTS
  };
}
