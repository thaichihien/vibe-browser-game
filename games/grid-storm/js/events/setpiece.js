/* Set-piece events: the ones that own the whole board for a while.
   Anything marked `solo` pauses the plain missile spawner and refuses to share
   the stage with another event — they are already a full screen of danger. */

import { spawnBullet, addHazard, cellBlast } from '../bullets.js';
import { burst, ring, flash, shake, floatText, confetti } from '../fx.js';
import { Sound } from '../audio.js';
import { BIG_SIZE, rnd, rndi, clamp } from '../config.js';

/* ── 🔲 GRID EXPANSION — always the first event, and it never ends ──────── */

export const expand = {
  id: 'expand', name: 'GRID EXPANSION', emoji: '🔲', tint: '#7cf7ff',
  blurb: 'The arena locks open at 9×9 — and every new edge shoots too.',
  duration: 4, weight: 0, permanent: true,

  start(g) {
    g.expandGrid();
    Sound.expand();
    flash(g.fx, '#7cf7ff', 0.5);
    shake(g.fx, 12);
    confetti(g.fx, g.center, g.center, ['🔲', '✨', '🟦'], 24);
    ring(g.fx, g.center, g.center, '#7cf7ff', 2, 7, 0.9, 6);
  }
};

/* ── 💠 CLOSING RINGS ───────────────────────────────────────────────────── */

export const rings = {
  id: 'rings', name: 'CLOSING RINGS', emoji: '💠', tint: '#00e5ff',
  blurb: 'Five rings collapse toward the middle. Each has one gap.',
  duration: 19, weight: 3, solo: true,

  start(g, e) { e.timer = 0.6; e.made = 0; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0 || e.made >= 5) return;
    e.timer = 3;
    e.made++;
    spawnRing(g, 5.0);
  }
};

function spawnRing(g, span = 5) {
  const gap = rnd(0, Math.PI * 2);
  const half = 0.5;               // half-width of the escape gap, radians
  const r0 = (g.hi - g.lo + 1) / 2 + 2.5;   // just outside whatever grid is live

  Sound.warn();

  addHazard(g, {
    life: span + 0.4, under: false, r: r0,
    update(h, gg) {
      h.r = r0 * (1 - h.t / span);
      if (h.r <= 0.25) {
        if (!h.popped) {
          h.popped = true;
          burst(gg.fx, gg.center, gg.center, '#00e5ff', 20, 6, '💠');
          Sound.blast();
          shake(gg.fx, 6);
        }
        return;
      }
      const dx = gg.player.px - gg.center, dy = gg.player.py - gg.center;
      const d = Math.hypot(dx, dy);
      if (Math.abs(d - h.r) > 0.42) return;

      const a = Math.atan2(dy, dx);
      const da = Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da > half) gg.kill('crushed by a closing ring', '💠');
    },
    draw(h, gg, ctx, R) {
      if (h.r <= 0.25) return;
      const a0 = gap + half, a1 = gap - half + Math.PI * 2;
      R.arc(gg.center, gg.center, h.r, a0, a1, '#00e5ff', 9, 0.95);
      R.arc(gg.center, gg.center, h.r, a0, a1, '#ffffff', 3, 0.5);

      // sparkle the two lips of the gap so the exit reads at a glance
      R.emoji(gg.center + Math.cos(gap) * h.r, gg.center + Math.sin(gap) * h.r, '✨', 0.5, 0.9);
    }
  });
}

/* ── 🧱 WALL RUSH ───────────────────────────────────────────────────────── */

export const wallRush = {
  id: 'walls', name: 'WALL RUSH', emoji: '🧱', tint: '#ff9800',
  blurb: 'Ten walls from one side. Each leaves exactly one hole.',
  duration: 16, weight: 3, solo: true,

  start(g, e) {
    e.dir = rndi(0, 3);
    e.gap = rndi(g.lo, g.hi);
    e.timer = 0.8;
    e.made = 0;
    e.speed = g.speed * 0.8;
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0 || e.made >= 10) return;
    e.timer = 1.05;
    e.made++;

    e.gap = clamp(e.gap + rndi(-2, 2), g.lo, g.hi);
    Sound.fire();

    for (let lane = g.lo; lane <= g.hi; lane++) {
      if (lane === e.gap) continue;

      const s = e.speed;
      const spec = {
        emoji: '🧱', r: 0.3, color: '#ff9800', trailRate: 0, life: 20
      };
      if (e.dir === 0) { spec.x = lane; spec.y = g.lo - 1.5; spec.vy = s; }
      if (e.dir === 1) { spec.x = lane; spec.y = g.hi + 1.5; spec.vy = -s; }
      if (e.dir === 2) { spec.x = g.lo - 1.5; spec.y = lane; spec.vx = s; }
      if (e.dir === 3) { spec.x = g.hi + 1.5; spec.y = lane; spec.vx = -s; }

      spawnBullet(g, spec);
    }
  }
};

/* ── ☢️ MINEFIELD ──────────────────────────────────────────────────────── */

export const mines = {
  id: 'mines', name: 'MINEFIELD', emoji: '☢️', tint: '#ffeb3b',
  blurb: 'Cells arm themselves under your feet. Keep moving.',
  duration: 14, weight: 2,

  start(g, e) { e.timer = 0.3; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = rnd(0.45, 0.8);

    // one mine is aimed where you are standing — the rest are luck
    const near = Math.random() < 0.45;
    const [pcx, pcy] = g.playerCell();
    const cell = near
      ? [clamp(pcx + rndi(-1, 1), g.lo, g.hi), clamp(pcy + rndi(-1, 1), g.lo, g.hi)]
      : g.randCell();

    cellBlast(g, [cell], {
      warn: 1.7, burn: 0.45, color: '#ffeb3b', emoji: '☢️',
      onBurn: (h, gg) => { burst(gg.fx, cell[0], cell[1], '#ffeb3b', 10, 4, '☢️'); Sound.blast(); }
    });
  }
};

/* ── 🔥 FLOOR IS LAVA ───────────────────────────────────────────────────── */

export const lava = {
  id: 'lava', name: 'FLOOR IS LAVA', emoji: '🔥', tint: '#ff4d1a',
  blurb: 'Only the marked tiles survive the flood. Stand on one.',
  duration: 15, weight: 3, solo: true,

  start(g, e) { e.timer = 0.8; e.rounds = 0; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0 || e.rounds >= 3) return;
    e.rounds++;
    e.timer = 5.0;

    const safe = [];
    const n = Math.max(4, 8 - e.rounds);
    for (let i = 0; i < n; i++) safe.push(g.randCell());
    const key = ([x, y]) => x + ',' + y;
    const safeSet = new Set(safe.map(key));

    const warn = 3.0, burn = 1.3;
    Sound.charge();

    addHazard(g, {
      life: warn + burn, under: true,
      draw(h, gg, ctx, R) {
        const armed = h.t >= warn;
        const p = armed ? 1 - (h.t - warn) / burn : h.t / warn;

        for (let cy = gg.lo; cy <= gg.hi; cy++) {
          for (let cx = gg.lo; cx <= gg.hi; cx++) {
            if (safeSet.has(cx + ',' + cy)) {
              R.cellRect(cx, cy, '#1c7c3a', 0.85);
              R.cellStroke(cx, cy, '#7dff9f', 0.9, 2);
              continue;
            }
            R.cellRect(cx, cy, armed ? '#ff4d1a' : '#5c1f0a', armed ? 0.55 + 0.35 * p : 0.25 + 0.35 * (h.t / warn));
          }
        }
        for (const [sx, sy] of safe) R.emoji(sx, sy, '🟩', 0.55, 0.85);
        if (armed) {
          for (let i = 0; i < 6; i++) {
            const [cx, cy] = [rndi(gg.lo, gg.hi), rndi(gg.lo, gg.hi)];
            if (!safeSet.has(cx + ',' + cy)) R.emoji(cx, cy, '🔥', 0.6, 0.5 + 0.5 * p);
          }
        }
      },
      update(h, gg) {
        if (h.t < warn) return;
        if (!h.fired) {
          h.fired = true;
          Sound.blast();
          shake(gg.fx, 10);
          flash(gg.fx, '#ff4d1a', 0.25);
        }
        const [pcx, pcy] = gg.playerCell();
        if (!safeSet.has(pcx + ',' + pcy)) gg.kill('burned by the floor', '🔥');
      }
    });
  }
};

/* ── 🕳️ BLACK HOLE ─────────────────────────────────────────────────────── */

export const blackhole = {
  id: 'blackhole', name: 'BLACK HOLE', emoji: '🕳️', tint: '#b388ff',
  blurb: 'It drags you a cell at a time. Bullets bend toward it too.',
  duration: 13, weight: 2,

  start(g, e) {
    [e.cx, e.cy] = g.randCell();
    e.pull = 1.0;
    e.hz = addHazard(g, {
      life: this.duration + 0.4, under: true, ignoreTime: true,
      draw: (h, gg, ctx, R) => {
        R.cellRect(e.cx, e.cy, '#0a0616', 0.9);
        for (let i = 1; i <= 3; i++) {
          R.arc(e.cx, e.cy, i * 0.7 + Math.sin(h.t * 2 + i) * 0.1, 0, Math.PI * 2, '#b388ff', 2, 0.25);
        }
        R.emoji(e.cx, e.cy, '🕳️', 0.9, 1, h.t * 1.6);
      }
    });
  },

  update(g, e, dt) {
    // bend every bullet a little
    for (const b of g.bullets) {
      const dx = e.cx - b.x, dy = e.cy - b.y;
      const d = Math.max(0.6, Math.hypot(dx, dy));
      b.vx += (dx / d) * dt * 2.2;
      b.vy += (dy / d) * dt * 2.2;
    }

    e.pull -= dt;
    if (e.pull > 0) return;
    e.pull = 1.05;

    const dx = e.cx - g.player.gx, dy = e.cy - g.player.gy;
    if (!dx && !dy) return;
    const step = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    g.shove(step[0], step[1], 'swallowed by the black hole', '🕳️');
    floatText(g.fx, g.player.px, g.player.py - 0.7, 'PULL', '#b388ff', 0.7, 0.42);
  },

  end(g, e) { if (e.hz) e.hz.dead = true; }
};

/* ── 🗜️ PISTONS ────────────────────────────────────────────────────────── */

/* A pair of lines that march in step. Each step lights its cells for a beat,
   flashes, and kills whatever is standing on it, then both lines advance one
   cell — inward from the two edges until they meet in the middle, or outward
   from the middle until they reach the edges.

   The lane you are standing in is only ever deadly on the beat it flashes, so
   the play is to hold just ahead of the line and step *through* it the moment
   it fires, into the ground it has already covered. Only one axis is live per
   wave, so the other one is always free — there is no unwinnable step.

   Four waves, one of each variant (rows/columns × inward/outward) in a drawn
   order, so a run of this never repeats itself and never skips one either. */

const PISTON = {
  lead: 1.00,   // the first step of a wave telegraphs longer: it names the variant
  warn: 0.62,   // every step after that
  burn: 0.24,   // how long the flash stays deadly
  gap:  0.90,   // breath between waves
  open: 0.60    // and before the first
};

const PISTON_STEPS = (BIG_SIZE + 1) / 2;   // 5 — the pair meets in the middle

export const pistons = {
  id: 'pistons', name: 'PISTONS', emoji: '🗜️', tint: '#a3e635',
  blurb: 'Two lines light up, flash, and march a cell at a time. Step through them, not away.',
  weight: 3, solo: true,

  duration: PISTON.open + 4 * (
    PISTON.lead + PISTON.burn +
    (PISTON_STEPS - 1) * (PISTON.warn + PISTON.burn) +
    PISTON.gap),

  start(g, e) {
    // one of each variant, in a drawn order
    e.plan = shuffle([
      { axis: 'row', out: false }, { axis: 'row', out: true },
      { axis: 'col', out: false }, { axis: 'col', out: true }
    ]);
    e.wave = 0;
    e.lanes = null;
    e.timer = PISTON.open;
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;

    if (!e.lanes || e.k >= e.lanes.length) {
      if (e.wave >= e.plan.length) { e.timer = 99; return; }   // done — coast out
      const v = e.plan[e.wave++];
      e.axis = v.axis;
      e.lanes = lanePairs(g, v.out);
      e.k = 0;
    }

    const [a, b] = e.lanes[e.k++];
    const warn = e.k === 1 ? PISTON.lead : PISTON.warn;
    pressStep(g, e.axis, a, b, warn);

    const waveDone = e.k >= e.lanes.length;
    e.timer = warn + PISTON.burn + (waveDone ? PISTON.gap : 0);
  }
};

/* The lanes each step covers, outermost pair first (or innermost, going out).
   Both walks end on the same list reversed, so a wave always covers the board
   exactly once and the two ends meet on a single lane. */
function lanePairs(g, out) {
  const mid = g.center;
  const pairs = [];
  for (let k = 0; k <= (g.hi - g.lo) / 2; k++) {
    pairs.push(out ? [mid - k, mid + k] : [g.lo + k, g.hi - k]);
  }
  return pairs;
}

function pressStep(g, axis, a, b, warn) {
  const lanes = a === b ? [a] : [a, b];
  const burn = PISTON.burn;
  const cellsOf = lane => {
    const out = [];
    for (let i = g.lo; i <= g.hi; i++) out.push(axis === 'row' ? [i, lane] : [lane, i]);
    return out;
  };

  Sound.warn();

  addHazard(g, {
    life: warn + burn, under: true,
    draw(h, gg, ctx, R) {
      if (h.t < warn) {
        // small lights on every cell, swelling as the flash gets close
        const p = h.t / warn;
        for (const lane of lanes) {
          R.beam(gg, axis, lane, '#a3e635', 0.05 + 0.13 * p, 0.9);
          for (const [cx, cy] of cellsOf(lane)) {
            R.dot(cx, cy, 0.05 + 0.12 * p * p, '#a3e635', 0.35 + 0.6 * p, 12);
          }
        }
      } else {
        const p = 1 - (h.t - warn) / burn;
        for (const lane of lanes) {
          R.beam(gg, axis, lane, '#a3e635', 0.9 * p, 1.0);
          R.beam(gg, axis, lane, '#ffffff', p, 0.32 * p);
        }
      }
    },
    update(h, gg) {
      if (h.t < warn) return;
      if (!h.fired) {
        h.fired = true;
        Sound.press();
        shake(gg.fx, 6);
        for (const lane of lanes) {
          for (const [cx, cy] of cellsOf(lane)) {
            if ((cx + cy) % 2) continue;               // every other cell is plenty
            burst(gg.fx, cx, cy, '#a3e635', 3, 3);
          }
        }
      }
      const [pcx, pcy] = gg.playerCell();
      for (const lane of lanes) {
        if (axis === 'row' ? pcy === lane : pcx === lane) gg.kill('caught in the press', '🗜️');
      }
    }
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rndi(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── 🧮 POP QUIZ ───────────────────────────────────────────────────────── */

/* A sum appears above the board and every lane is labelled with a number — rows
   one round, columns the next. Three seconds later the lane holding the right
   answer is the only ground left standing; every other lane burns.

   The labels are the digits 0-8 shuffled fresh each round, so the answer never
   sits in the same lane twice and the board has to be read rather than
   remembered. The sum is built backwards from a chosen answer, which is what
   keeps every operand a single digit and guarantees the answer is on the board. */

const QUIZ = {
  think:  3.0,   // as asked: three seconds per sum
  burn:   1.1,   // how long the wrong lanes stay lethal
  gap:    0.9,   // beat between rounds
  open:   0.6,
  rounds: 3
};

export const quiz = {
  id: 'quiz', name: 'POP QUIZ', emoji: '🧮', tint: '#60a5fa',
  blurb: 'One sum, nine lanes, three seconds. Stand in the lane that answers it.',
  weight: 3, solo: true,

  duration: QUIZ.open + QUIZ.rounds * (QUIZ.think + QUIZ.burn + QUIZ.gap),

  start(g, e) { e.round = 0; e.timer = QUIZ.open; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;

    if (e.round >= QUIZ.rounds) { e.timer = 99; return; }   // done — coast out
    e.round++;
    askSum(g);
    e.timer = QUIZ.think + QUIZ.burn + QUIZ.gap;
  }
};

function askSum(g) {
  const axis = Math.random() < 0.5 ? 'row' : 'col';
  const lanes = [];
  for (let i = g.lo; i <= g.hi; i++) lanes.push(i);

  const labels = shuffle(lanes.map((_, i) => i));      // 0..8, one per lane
  const sum = buildSum(labels.length - 1);
  const safe = lanes[labels.indexOf(sum.answer)];

  const cellsOf = lane => {
    const out = [];
    for (let i = g.lo; i <= g.hi; i++) out.push(axis === 'row' ? [i, lane] : [lane, i]);
    return out;
  };

  Sound.charge();

  addHazard(g, {
    life: QUIZ.think + QUIZ.burn, under: true,

    draw(h, gg, ctx, R) {
      const armed = h.t >= QUIZ.think;
      const left = armed ? 0 : 1 - h.t / QUIZ.think;
      const fade = armed ? 1 - (h.t - QUIZ.think) / QUIZ.burn : 1;

      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i], right = lane === safe;

        for (const [cx, cy] of cellsOf(lane)) {
          if (armed) {
            R.cellRect(cx, cy, right ? '#1c7c3a' : '#ff2e5b', right ? 0.85 : 0.5 + 0.35 * fade);
          } else {
            // the bands alternate so nine lanes still read as nine lanes
            R.cellRect(cx, cy, i % 2 ? '#15233f' : '#101b31', 0.75);
          }
          R.text(cx, cy, String(labels[i]), 0.46,
            armed ? (right ? '#dcfce7' : '#ffe1e8') : '#60a5fa',
            armed ? 0.5 + 0.5 * fade : 0.85);
        }

      }

      if (armed) {
        for (const [cx, cy] of cellsOf(safe)) R.cellStroke(cx, cy, '#7dff9f', 0.9 * fade, 2);
      }

      /* The sum sits under the board: clear of its own answer, and clear of the
         event banner, which drops over the top of the board for the first three
         seconds — exactly the seconds the first sum needs to be readable in. */
      const beat = 0.85 + 0.15 * Math.sin(h.t * (5 + 14 * (1 - left)));
      R.text(gg.center, gg.hi + 1.05, `${sum.text} = ?`, 0.9 * (armed ? 1 : beat),
        armed ? '#7dff9f' : '#60a5fa', 1);
    },

    update(h, gg) {
      if (h.t < QUIZ.think) return;

      if (!h.fired) {
        h.fired = true;
        Sound.blast();
        shake(gg.fx, 8);
        flash(gg.fx, '#60a5fa', 0.2);
      }

      const [pcx, pcy] = gg.playerCell();
      if ((axis === 'row' ? pcy : pcx) !== safe) {
        gg.kill('wrong answer', '❌');
      } else if (!h.marked) {
        h.marked = true;
        Sound.bloom();
        confetti(gg.fx, gg.player.px, gg.player.py, ['✅', '✨'], 10);
        floatText(gg.fx, gg.player.px, gg.player.py - 0.8, 'CORRECT', '#7dff9f', 1.1, 0.5);
      }
    }
  });
}

/* Built backwards from the answer, so both operands stay single digits and the
   answer is always one of the labels on the board. */
function buildSum(max) {
  const answer = rndi(0, max);

  if (Math.random() < 0.5) {
    const a = rndi(0, answer);
    return { text: `${a} + ${answer - a}`, answer };
  }

  const b = rndi(0, 9 - answer);
  return { text: `${answer + b} − ${b}`, answer };
}

export const SETPIECE = [rings, wallRush, mines, lava, blackhole, pistons, quiz];
