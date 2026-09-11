/* Đại Chiến Bong Bóng — engine tests.
 *
 * The engine is DOM-free ES modules, so unlike monster-battle (which needs
 * tests/harness.mjs to carve regions out of one HTML file and run them in a
 * node:vm) these can just be imported.
 *
 * Never write pixel literals in here: TILE is a tuning dial, and a test that
 * pins a raw pixel offset silently starts probing the wrong tile the day it
 * changes. Use cx()/cy().
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const G = '../games/dai-chien-bong-bong/js';

const { createState, solidFor } = await import(`${G}/engine/state.js`);
const { HARD, SOFT, EMPTY } = await import(`${G}/engine/grid.js`);
const { placeBalloon, detonate, fire, flood, updateBalloons } = await import(`${G}/engine/balloons.js`);
const { createPlayer, updatePlayers, killPlayer } = await import(`${G}/engine/players.js`);
const { createMonster, spawnMonster, updateMonsters, soakMonster, killMonster, aliveMonsters }
  = await import(`${G}/engine/minions.js`);
const { PATTERNS, cast, updateTelegraphs } = await import(`${G}/engine/abilities.js`);
const { updateBoss } = await import(`${G}/engine/boss.js`);
const { createStage, updateStage } = await import(`${G}/engine/stage.js`);
const { rankOf, score } = await import(`${G}/engine/rank.js`);
const { BOSSES } = await import(`${G}/data/bosses.js`);
const { CHAPTERS } = await import(`${G}/data/chapters.js`);
const { createInput } = await import(`${G}/input.js`);
const C = await import(`${G}/config.js`);

/* ── fixtures ─────────────────────────────────────────────────────────── */

const seeded = (n = 1) => () => (n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const cx = (c) => c * C.TILE + C.TILE / 2;
const cy = (r) => r * C.TILE + C.TILE / 2;
const at = (tiles, c, r) => tiles.filter(t => t.c === c && t.r === r);

const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];

function scene(lines = OPEN) {
  const st = createState(lines, { rand: seeded() });
  const p = createPlayer(0, { c: 1, r: 1 });
  p.invuln = 0;
  st.players.push(p);
  return st;
}

const step = (st, n, intents = { 0: { dx: 0, dy: 0 } }) => {
  for (let i = 0; i < n; i++) {
    st.t += 1 / 60;
    updatePlayers(st, 1 / 60, intents);
    updateBalloons(st, 1 / 60);
    updateMonsters(st, 1 / 60);
  }
};

/* ── the blast ────────────────────────────────────────────────────────── */

test('water stops at HARD and consumes exactly the first SOFT', () => {
  const st = scene([
    '#########',
    '#.......#',
    '#...o...#',
    '#.#.....#',
    '#.......#',
    '#.......#',
    '#########',
  ]);
  const p = st.players[0];
  p.x = cx(4); p.y = cy(3);
  p.stats.power = 3;
  const tiles = detonate(st, placeBalloon(st, p));

  assert.equal(at(tiles, 4, 2).length, 1, 'reaches the SOFT tile above');
  assert.equal(at(tiles, 4, 1).length, 0, 'and stops there — SOFT is not passed through');
  assert.equal(at(tiles, 3, 3).length, 1, 'one tile left before the HARD pillar');
  assert.equal(at(tiles, 2, 3).length, 0, 'HARD is never watered');
  assert.equal(at(tiles, 7, 3).length, 1, 'full power to the right');
  assert.equal(tiles.length, 8, 'origin + 1 up + 2 down + 1 left + 3 right');
});

test('chain reaction cancels the second fuse and carries the wave onward', () => {
  const st = scene(['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########']);
  const p = st.players[0];
  p.stats.power = 2;
  p.stats.balloons = 2;
  p.x = cx(2); p.y = cy(3);
  const a = placeBalloon(st, p);
  p.x = cx(4);
  placeBalloon(st, p);
  assert.equal(st.balloons.length, 2);

  const tiles = detonate(st, a);
  assert.equal(st.balloons.length, 0, 'both bombs consumed by one detonation');
  const far = at(tiles, 6, 3);
  assert.equal(far.length, 1, 'the chained bomb extended the blast past its own reach');
  assert.equal(far[0].wave, 4, 'and on a later wave, so it animates as a chain');
});

test('you may leave the tile you bombed, but not walk back onto it', () => {
  const st = scene();
  const p = st.players[0];
  p.x = cx(2); p.y = cy(2);
  const b = placeBalloon(st, p);

  assert.equal(solidFor(st, p, b.c, b.r), false, 'passable while you are still on it');
  assert.equal(solidFor(st, null, b.c, b.r), true, 'but solid to everything else at once');
  p.x = cx(4);
  step(st, 1);
  assert.equal(solidFor(st, p, b.c, b.r), true, 'once clear, it is a wall to you too');
});

/* ── corner-slip ──────────────────────────────────────────────────────── */

test('corner-slip rounds a corner you are barely clipping', () => {
  const st = scene(['#####', '#...#', '##..#', '#...#', '#####']);
  const p = st.players[0];
  /* Mostly in column 2, poking into column 1 by just inside the assist's reach.
   * Straight down is HARD; down-and-right is open. */
  const poke = C.SLIP_PX - 4;
  p.x = 2 * C.TILE - poke + C.HITBOX / 2;
  p.y = cy(1);
  const y0 = p.y;

  step(st, 45, { 0: { dx: 0, dy: 1 } });
  assert.ok(p.y > y0 + C.TILE, `slipped past the corner (y ${y0} → ${p.y.toFixed(0)})`);
  assert.ok(p.x - C.HITBOX / 2 >= 2 * C.TILE - 0.5, 'fully out of the blocked lane');
});

test('corner-slip does NOT fire when you are squarely against a wall', () => {
  const st = scene(['#####', '#...#', '##..#', '#...#', '#####']);
  const p = st.players[0];
  p.x = cx(1); p.y = cy(1);
  const y0 = p.y;
  step(st, 45, { 0: { dx: 0, dy: 1 } });
  assert.ok(p.y - y0 < 8, 'stopped at the wall instead of sliding sideways');
});

/* ── water traps, monsters kill ───────────────────────────────────────── */

function wetScene() {
  const st = scene();
  const p = st.players[0];
  p.x = cx(3); p.y = cy(2);
  p.invuln = 0;
  flood(st, 3, 2, 1);
  return { st, p };
}

test('water traps a player rather than killing them', () => {
  const { st, p } = wetScene();
  const lives = p.lives;
  step(st, 1);
  assert.ok(p.bubble, 'bubbled');
  assert.equal(p.lives, lives, 'no life lost on contact — only on the pop');
});

test('mashing empties the struggle meter and escapes free', () => {
  const { st, p } = wetScene();
  const lives = p.lives;
  step(st, 1);
  for (let i = 0; i < C.STRUGGLE_MASHES + 1 && p.bubble; i++) {
    step(st, 1, { 0: { dx: 1, dy: 0, mashed: true } });
  }
  assert.equal(p.bubble, null, 'broke out');
  assert.equal(p.lives, lives, 'and kept the life');
});

test('letting the bubble timer run out costs exactly one life', () => {
  const { st, p } = wetScene();
  const lives = p.lives;
  step(st, 1);
  step(st, Math.ceil(C.BUBBLE_DURATION * 60) + 5);
  assert.equal(p.bubble, null);
  assert.equal(p.lives, lives - 1);
});

/* This is the rule the whole mode turns on. */
test('touching a monster costs a life INSTANTLY — no bubble, no rescue', () => {
  for (const kind of ['cannon', 'rusher', 'fuzzy', 'croc']) {
    const st = scene();
    const p = st.players[0];
    p.x = cx(4); p.y = cy(2);
    p.invuln = 0;
    const lives = p.lives;
    const m = createMonster({ kind, c: 4, r: 2, move: 'still' });
    m.x = p.x; m.y = p.y;
    st.monsters.push(m);

    updateMonsters(st, 1 / 60);
    assert.equal(p.lives, lives - 1, `${kind} did not take a life`);
    assert.equal(p.bubble, null, `${kind} bubbled instead of killing`);
    assert.equal(p.alive, false, `${kind} left the player standing`);
  }
});

test('a monster the water has disabled is safe to touch', () => {
  const frozen = (() => {
    const st = scene();
    const p = st.players[0];
    p.x = cx(4); p.y = cy(2); p.invuln = 0;
    const m = createMonster({ kind: 'fuzzy', c: 4, r: 2, move: 'still' });
    m.x = p.x; m.y = p.y; m.state = 'frozen'; m.timer = 3;
    st.monsters.push(m);
    updateMonsters(st, 1 / 60);
    return { p, m };
  })();
  assert.equal(frozen.p.lives, 3, 'a frozen ⛄ cannot hurt you');
  assert.equal(frozen.m.dead, true, 'touching it shatters it instead');

  const st = scene();
  const p = st.players[0];
  p.x = cx(4); p.y = cy(2); p.invuln = 0;
  const m = createMonster({ kind: 'croc', c: 4, r: 2, move: 'still' });
  m.x = p.x; m.y = p.y; m.state = 'shrivel'; m.timer = 3;
  st.monsters.push(m);
  updateMonsters(st, 1 / 60);
  assert.equal(p.lives, 3, 'a shrivelled 🐊 cannot hurt you either');
});

/* ── the three water-reactions ────────────────────────────────────────── */

function monsterScene(kind, tweak) {
  const st = scene();
  st.players[0].x = cx(7); st.players[0].y = cy(4);   // out of contact range
  const m = createMonster({ kind, c: 3, r: 2, move: 'still' });
  if (tweak) tweak(m);
  st.monsters.push(m);
  return { st, m };
}

test('🎱 and 🧨 die on the first drop of water', () => {
  for (const kind of ['cannon', 'rusher']) {
    const { st, m } = monsterScene(kind);
    soakMonster(st, m, 0);
    assert.equal(m.dead, true, `${kind} survived a direct hit`);
  }
});

test('⛄ is only frozen by water — a player has to touch it', () => {
  const { st, m } = monsterScene('fuzzy');
  soakMonster(st, m, 0);
  assert.equal(m.state, 'frozen');
  assert.equal(m.dead, false, 'water alone never kills it');

  st.players[0].x = m.x; st.players[0].y = m.y;
  updateMonsters(st, 1 / 60);
  assert.equal(m.dead, true, 'shattered by the same input that rescues an ally');
});

test('⛄ thaws if it is left frozen too long', () => {
  const { st, m } = monsterScene('fuzzy');
  soakMonster(st, m, 0);
  for (let i = 0; i < Math.ceil(C.MONSTER.fuzzy.freeze * 60) + 5; i++) updateMonsters(st, 1 / 60);
  assert.equal(m.dead, false);
  assert.equal(m.state, 'walk', 'back on its feet');
});

test('🐊 needs a second hit while shrivelled, and recovers if it never comes', () => {
  const a = monsterScene('croc');
  soakMonster(a.st, a.m, 0);
  assert.equal(a.m.state, 'shrivel');
  assert.equal(a.m.dead, false);
  a.m.hitCd = 0;
  soakMonster(a.st, a.m, 0);
  assert.equal(a.m.dead, true, 'the second hit finishes it');

  const b = monsterScene('croc');
  soakMonster(b.st, b.m, 0);
  for (let i = 0; i < Math.ceil(C.MONSTER.croc.shrivel * 60) + 5; i++) updateMonsters(b.st, 1 / 60);
  assert.equal(b.m.dead, false);
  assert.equal(b.m.state, 'walk');
});

test('🥚 hatches into a fuzzy if you leave it alone', () => {
  const { st, m } = monsterScene('egg', (x) => { x.move = 'still'; });
  assert.equal(m.kind, 'egg');
  for (let i = 0; i < Math.ceil(C.MONSTER.egg.hatchAt * 60) + 5; i++) updateMonsters(st, 1 / 60);
  assert.equal(m.kind, 'fuzzy', 'it became the thing it was always going to become');
});

/* ── scripted movement ────────────────────────────────────────────────── */

test('monsters do NOT dodge water — luring them in is the kill', () => {
  /* A one-tile-tall corridor with water dead ahead. If it sidestepped, the
   * whole "bait it into your blast" skill would not exist. */
  const st = createState([
    '#########',
    '#.......#',
    '#########',
  ], { rand: seeded(3) });
  const m = spawnMonster(st, { kind: 'cannon', c: 2, r: 1, move: 'h' });
  m.dir = [1, 0];
  flood(st, 5, 1, 0);

  for (let i = 0; i < 240 && !m.dead; i++) {
    st.t += 1 / 60;
    flood(st, 5, 1, 0);              // hold the puddle open
    updateMonsters(st, 1 / 60);
  }
  assert.equal(m.dead, true, 'it walked straight into the water and died');
});

test("an 'h' patroller never leaves its row, and reverses at a wall", () => {
  const st = createState([
    '#########',
    '#.......#',
    '#.......#',
    '#########',
  ], { rand: seeded(4) });
  const m = spawnMonster(st, { kind: 'cannon', c: 2, r: 1, move: 'h' });
  const rows = new Set();
  let sawBoth = false, dirs = new Set();
  for (let i = 0; i < 60 * 12; i++) {
    st.t += 1 / 60;
    updateMonsters(st, 1 / 60);
    rows.add(st.grid.rowOf(m.y));
    if (m.dir) dirs.add(m.dir[0]);
  }
  assert.deepEqual([...rows], [1], 'stayed on row 1 the whole time');
  sawBoth = dirs.has(1) && dirs.has(-1);
  assert.ok(sawBoth, 'bounced off both walls');
});

test("a 'v' patroller is the same thing on the other axis", () => {
  const st = createState([
    '#####',
    '#.#.#',
    '#.#.#',
    '#.#.#',
    '#####',
  ], { rand: seeded(6) });
  const m = spawnMonster(st, { kind: 'fuzzy', c: 1, r: 1, move: 'v' });
  const cols = new Set();
  for (let i = 0; i < 60 * 10; i++) { st.t += 1 / 60; updateMonsters(st, 1 / 60); cols.add(st.grid.colOf(m.x)); }
  assert.deepEqual([...cols], [1], 'never left its shaft');
});

test('a balloon walls a patroller in — pinning one with your own bombs is legal', () => {
  const st = createState(['#######', '#.....#', '#######'], { rand: seeded(7) });
  const m = spawnMonster(st, { kind: 'cannon', c: 3, r: 1, move: 'h' });
  const p = createPlayer(0, { c: 1, r: 1 });
  p.stats.balloons = 4;
  st.players.push(p);
  for (const c of [2, 4]) {
    p.x = cx(c); p.y = cy(1);
    placeBalloon(st, p);
  }
  p.x = cx(1);

  const seen = new Set();
  for (let i = 0; i < 60 * 4; i++) { st.t += 1 / 60; updateMonsters(st, 1 / 60); seen.add(st.grid.colOf(m.x)); }
  assert.deepEqual([...seen].sort(), [3], 'boxed into the single tile between two bombs');
});

/* ── wake triggers ────────────────────────────────────────────────────── */

test('a dormant monster stands still until the first kill in the stage', () => {
  const st = createState(['#########', '#.......#', '#.......#', '#########'], { rand: seeded(8) });
  st.players.push(createPlayer(0, { c: 1, r: 2 }));
  const sleeper = spawnMonster(st, { kind: 'rusher', c: 6, r: 1, move: 'still', wake: { onKill: true, move: 'chase' } });
  const bait = spawnMonster(st, { kind: 'cannon', c: 3, r: 1, move: 'still' });

  const x0 = sleeper.x;
  for (let i = 0; i < 60; i++) { st.t += 1 / 60; updateMonsters(st, 1 / 60); }
  assert.equal(sleeper.x, x0, 'still asleep');
  assert.equal(sleeper.move, 'still');

  killMonster(st, bait, 0);
  assert.equal(sleeper.move, 'chase', 'the first kill woke the room');
  for (let i = 0; i < 90; i++) { st.t += 1 / 60; updateMonsters(st, 1 / 60); }
  assert.notEqual(sleeper.x, x0, 'and it is coming');
});

test('a timed wake fires off the stage clock', () => {
  const st = createStage(CHAPTERS[0], 2, { seats: 1, rand: seeded(9) });
  const sleeper = st.monsters.find(m => m.spec.wake && m.spec.wake.at);
  assert.ok(sleeper, 'the boss stage has a timed sleeper');
  assert.equal(sleeper.move, 'still');
  for (let i = 0; i < 60 * 11; i++) updateStage(st, 1 / 60, {});
  assert.equal(sleeper.move, 'chase', 'woke on schedule');
});

test('a reviving monster has to be killed twice', () => {
  const st = scene();
  st.players[0].x = cx(7); st.players[0].y = cy(4);
  const m = spawnMonster(st, { kind: 'cannon', c: 3, r: 2, move: 'still', revive: 1 });
  killMonster(st, m, 0);
  assert.equal(m.dead, true);
  for (let i = 0; i < 60 * 3; i++) { st.t += 1 / 60; updateMonsters(st, 1 / 60); }
  assert.equal(m.dead, false, 'it came back');
  killMonster(st, m, 0);
  for (let i = 0; i < 60 * 4; i++) { st.t += 1 / 60; updateMonsters(st, 1 / 60); }
  assert.equal(m.dead, true, 'and stayed down the second time');
});

/* ── the boss ─────────────────────────────────────────────────────────── */

const bossScene = (i = 0) => {
  const st = createStage(CHAPTERS[i], 2, { seats: 1, rand: seeded(11) });
  st.boss.invuln = 0;
  return st;
};

test('the boss has plain HP and dies to bombs — no meter to fill', () => {
  const st = bossScene();
  const b = st.boss;
  assert.ok(b.hp > 0 && b.hpMax === b.hp);
  assert.equal(b.soak, undefined, 'there is no soak meter anywhere on it');

  const hp0 = b.hp;
  flood(st, b.c, b.r, 0, false);
  updateBoss(st, 1 / 60);
  assert.equal(b.hp, hp0 - 1, 'one water tile is one hit');
});

test('the same puddle cannot machine-gun the boss', () => {
  const st = bossScene();
  const b = st.boss;
  const hp0 = b.hp;
  for (let i = 0; i < 10; i++) { flood(st, b.c, b.r, 0, false); updateBoss(st, 1 / 60); }
  assert.equal(b.hp, hp0 - 1, 'still a single hit inside the cooldown');
});

test('enough hits close together stagger it', () => {
  const st = bossScene();
  const b = st.boss;
  for (let i = 0; i < C.STAGGER_AT_HITS; i++) {
    b.hitCd.clear();
    flood(st, b.c + (i % 2), b.r, 0, false);
    st.t += 0.05;
    updateBoss(st, 1 / 60);
  }
  assert.equal(b.mode, 'stagger', 'it reels');
});

test('touching the boss costs a life, same as any monster', () => {
  const st = bossScene();
  const b = st.boss;
  const p = st.players[0];
  p.invuln = 0;
  const lives = p.lives;
  p.x = cx(b.c + 1); p.y = cy(b.r + 1);
  updateBoss(st, 1 / 60);
  assert.equal(p.lives, lives - 1);
  assert.equal(p.bubble, null, 'killed, not trapped');
});

test('edging works: a body overlapping the boss but centred on a dry tile is safe', () => {
  const st = bossScene();
  const b = st.boss;
  const p = st.players[0];
  p.invuln = 0;
  /* Centre one tile outside the footprint, hitbox spilling over its edge. */
  p.x = cx(b.c - 1) + C.HITBOX / 2 - 1;
  p.y = cy(b.r + 1);
  const lives = p.lives;
  updateBoss(st, 1 / 60);
  assert.equal(p.lives, lives, 'contact is judged on the centre tile — that is what makes 걸치기 possible');
});

test('the boss escalates at its phase thresholds and unlocks a pattern', () => {
  const st = bossScene();
  const b = st.boss;
  const before = b.unlocked.length;
  b.hp = Math.floor(b.hpMax * C.PHASE_AT[0]) - 1;
  for (let i = 0; i < 4; i++) { st.t += 1 / 60; updateBoss(st, 1 / 60); }
  assert.equal(b.phase, 1);
  b.mode = 'move'; b.modeT = 0; b.invuln = 0;
  b.hp = Math.floor(b.hpMax * C.PHASE_AT[1]) - 1;
  for (let i = 0; i < 4; i++) { st.t += 1 / 60; updateBoss(st, 1 / 60); }
  assert.equal(b.phase, 2, 'one step per threshold, never two');
  assert.ok(b.unlocked.length >= before, 'and it learned something on the way');
});

test('🐙 splits into a real body and two fakes; only the real one ends it', () => {
  const st = bossScene(0);
  const b = st.boss;
  cast(st, b, 'clone');
  st.t += 2;
  updateTelegraphs(st);

  assert.equal(st.clones.length, 2, 'two fakes');
  assert.ok(st.clones.every(cl => cl.hp < b.hpMax), 'fakes are frailer than the original');

  st.clones.forEach(cl => { cl.hp = 0; });
  for (let i = 0; i < 60; i++) updateStage(st, 1 / 60, {});
  assert.equal(st.outcome, null, 'killing both fakes does not clear the stage');
});

test('🦭 has no spray at all — standing beside it is the point', () => {
  assert.ok(!BOSSES.seal.patterns.some(p => p.kind === 'spray'),
    'the seal must not learn a spray; its whole identity is that you can stand next to it');
  for (const id of ['octopus', 'penguin']) {
    assert.ok(BOSSES[id].patterns.some(p => p.kind === 'spray'), `${id} should spray`);
  }
});

test('every pattern telegraphs, and every pattern a boss lists exists', () => {
  for (const [kind, pat] of Object.entries(PATTERNS)) {
    assert.ok(pat.lead >= C.TELEGRAPH_MIN, `${kind} leads only ${pat.lead}s`);
  }
  for (const b of Object.values(BOSSES)) {
    for (const p of b.patterns) assert.ok(PATTERNS[p.kind], `${b.id} lists unknown pattern "${p.kind}"`);
  }
});

test('nothing the live scheduler casts skips its telegraph', () => {
  const st = bossScene();
  const seen = [];
  for (let i = 0; i < 60 * 40; i++) {
    updateStage(st, 1 / 60, {});
    for (const t of st.telegraphs) if (!seen.includes(t)) seen.push(t);
  }
  assert.ok(seen.length > 3, `the boss actually cast things (${seen.length})`);
  for (const t of seen) {
    assert.ok(t.at - t.born >= C.TELEGRAPH_FINAL - 1e-9, `${t.kind} resolved too soon`);
    assert.ok(t.tiles.length > 0, `${t.kind} telegraphed no tiles`);
  }
});

/* ── stages are authored, not generated ───────────────────────────────── */

test('every stage spawns exactly the monsters its script names, on those tiles', () => {
  for (const ch of CHAPTERS) {
    ch.stages.forEach((spec, i) => {
      const st = createStage(ch, i, { seats: 1, rand: seeded(13) });
      assert.equal(st.monsters.length, spec.monsters.length,
        `${ch.id} stage ${i + 1} spawned the wrong count`);
      spec.monsters.forEach((m, k) => {
        assert.equal(st.monsters[k].c, m.c, `${ch.id} s${i + 1} monster ${k} column`);
        assert.equal(st.monsters[k].r, m.r, `${ch.id} s${i + 1} monster ${k} row`);
        assert.equal(st.grid.at(m.c, m.r), EMPTY, `${ch.id} s${i + 1} monster ${k} is inside a wall`);
      });
    });
  }
});

test('a monster stage clears exactly when the last monster dies', () => {
  const st = createStage(CHAPTERS[0], 0, { seats: 1, rand: seeded(14) });
  assert.ok(st.monsters.length > 0);
  st.monsters.slice(0, -1).forEach(m => { m.dead = true; });
  updateStage(st, 1 / 60, {});
  assert.equal(st.outcome, null, 'not while one is still up');
  st.monsters.forEach(m => { m.dead = true; m.reviveIn = 0; m.revive = 0; });
  for (let i = 0; i < 90; i++) updateStage(st, 1 / 60, {});
  assert.equal(st.outcome, 'clear');
});

test('a boss stage ends on the boss, not on its monsters', () => {
  const st = bossScene();
  assert.ok(st.monsters.length > 0, 'the boss stage has monsters of its own');
  st.boss.hp = 0;
  for (let i = 0; i < 90; i++) updateStage(st, 1 / 60, {});
  assert.equal(st.outcome, 'clear', 'a live monster does not hold the stage open');
});

test('everyone out of lives fails the stage; one survivor does not', () => {
  const st = createStage(CHAPTERS[0], 0, { seats: 2, rand: seeded(15) });
  st.players[0].down = true;
  for (let i = 0; i < 90; i++) updateStage(st, 1 / 60, {});
  assert.equal(st.outcome, null, 'a lone survivor plays on');
  st.players[1].down = true;
  for (let i = 0; i < 90; i++) updateStage(st, 1 / 60, {});
  assert.equal(st.outcome, 'fail');
});

/* ── rank ─────────────────────────────────────────────────────────────── */

test('a perfect run grades SS, and each shortfall drops it', () => {
  const ss = { kills: 18, time: 150 };
  assert.equal(rankOf({ kills: 18, time: 120, deaths: 0 }, ss).id, 'SS', 'fast, complete, clean');
  assert.ok(['S', 'A'].includes(rankOf({ kills: 18, time: 150, deaths: 1 }, ss).id), 'one death costs a grade');
  const slow = rankOf({ kills: 18, time: 400, deaths: 0 }, ss);
  assert.ok(['A', 'B', 'C'].includes(slow.id), `dawdling costs grades (got ${slow.id})`);
  assert.equal(rankOf({ kills: 2, time: 600, deaths: 6 }, ss).id, 'D', 'a bad run is a D');
});

test('beating the SS time is worth no more than hitting it', () => {
  const ss = { kills: 10, time: 100 };
  const onTime = score({ kills: 10, time: 100, deaths: 0 }, ss);
  const rushed = score({ kills: 10, time: 20, deaths: 0 }, ss);
  assert.equal(rushed, onTime, 'no prize for overshooting the target');
});

test('the run totals accumulate across a whole raid, not per stage', () => {
  const shared = { kills: 0, time: 0, deaths: 0 };
  const a = createStage(CHAPTERS[0], 0, { seats: 1, rand: seeded(16), run: shared });
  for (let i = 0; i < 120; i++) updateStage(a, 1 / 60, {});
  const afterA = shared.time;
  assert.ok(afterA > 1.9 && afterA < 2.1, `stage 1 logged ~2s (${afterA.toFixed(2)})`);

  const b = createStage(CHAPTERS[0], 1, { seats: 1, rand: seeded(17), run: shared });
  for (let i = 0; i < 120; i++) updateStage(b, 1 / 60, {});
  assert.ok(shared.time > afterA + 1.9, 'stage 2 kept counting from where stage 1 left off');
});

/* ── the three raids are peers ────────────────────────────────────────── */

test('every raid runs the same monster budget and SS target', () => {
  const counts = CHAPTERS.map(ch =>
    ch.stages.reduce((n, s) => n + (s.monsters?.length || 0), 0));
  const spread = Math.max(...counts) - Math.min(...counts);
  assert.ok(spread <= 3, `monster counts are within a few of each other: ${counts}`);
  for (const ch of CHAPTERS) {
    assert.equal(ch.ss.time, CHAPTERS[0].ss.time, `${ch.id} has a different time target`);
    assert.equal(ch.stages.length, 3, `${ch.id} is Stage 1 → Stage 2 → Boss`);
    assert.ok(ch.stages[2].boss, `${ch.id} stage 3 has a boss`);
    assert.ok(!ch.stages[0].boss && !ch.stages[1].boss, `${ch.id} stages 1-2 are monster stages`);
  }
});

test('every boss has the same HP, speed and pattern budget', () => {
  const list = Object.values(BOSSES);
  for (const b of list) {
    assert.equal(b.hp, list[0].hp, `${b.id} has different HP`);
    assert.equal(b.speed, list[0].speed, `${b.id} moves at a different speed`);
    assert.equal(b.size, list[0].size, `${b.id} is a different size`);
    assert.equal(b.patterns.length, list[0].patterns.length, `${b.id} has a different pattern count`);
  }
});

test('no raid assumes another has been played first', () => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const st = createStage(CHAPTERS[i], 0, { seats: 1, rand: seeded(i + 1) });
    assert.deepEqual(st.players[0].stats,
      { balloons: C.BASE.balloons, power: C.BASE.power, speedTier: C.BASE.speedTier, kick: false, throw: false },
      `${CHAPTERS[i].id} does not start from base stats`);
  }
});

/* ── solo controls ────────────────────────────────────────────────────── */

function fakeKeyboard() {
  const handlers = {};
  const target = {
    addEventListener: (t, fn) => { (handlers[t] ||= []).push(fn); },
    removeEventListener: () => {},
  };
  const fire = (type, code) =>
    (handlers[type] || []).forEach(fn => fn({ code, repeat: false, preventDefault() {} }));
  return { target, down: (c) => fire('keydown', c), up: (c) => fire('keyup', c) };
}

test('alone, the player answers to arrows and Space — and to WASD and Enter', () => {
  const kb = fakeKeyboard();
  const input = createInput(kb.target);
  input.setSolo(true);

  kb.down('ArrowRight');
  assert.deepEqual([input.read(0).dx], [1], 'ArrowRight moves right');
  kb.down('Space');
  assert.equal(input.read(0).place, true, 'Space places a bomb');
  kb.up('ArrowRight');
  kb.down('KeyW');
  assert.deepEqual([input.read(0).dy], [-1], 'W still moves up');
  kb.down('Enter');
  assert.equal(input.read(0).place, true, 'Enter still places');
});

test('the most recent direction wins even across the two keysets', () => {
  const kb = fakeKeyboard();
  const input = createInput(kb.target);
  input.setSolo(true);
  kb.down('KeyD');
  kb.down('ArrowUp');
  assert.deepEqual([input.read(0).dx, input.read(0).dy], [0, -1], 'newer press wins — never a diagonal');
  kb.up('ArrowUp');
  const it = input.read(0);
  assert.deepEqual([it.dx, it.dy], [1, 0], 'falls back to the key still held');
});

test('with two players the keysets stay separate', () => {
  const kb = fakeKeyboard();
  const input = createInput(kb.target);
  input.setSolo(false);
  kb.down('KeyD');
  kb.down('ArrowLeft');
  const p1 = input.read(0), p2 = input.read(1);
  assert.deepEqual([p1.dx, p1.dy], [1, 0], 'player 1 reads only WASD');
  assert.deepEqual([p2.dx, p2.dy], [-1, 0], 'player 2 reads only the arrows');
});
