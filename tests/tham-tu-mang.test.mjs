/* Thám Tử Mạng is a folder game, so its engine and data are real ES modules and the tests
   import them directly — no node:vm harness needed. The contract those modules must keep is
   that they stay DOM-free at import time, which the bare import proves. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { mulberry32, range, pick, shuffle } from '../games/tham-tu-mang/js/engine/rng.js';

test('mulberry32 is deterministic for a seed', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepStrictEqual(seqA, seqB);
});

test('mulberry32 returns values in [0, 1)', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 500; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('different seeds diverge', () => {
  const a = mulberry32(1), b = mulberry32(2);
  assert.notStrictEqual(a(), b());
});

test('range is inclusive at both ends', () => {
  const seen = new Set();
  const rng = mulberry32(99);
  for (let i = 0; i < 2000; i++) seen.add(range(rng, 5, 8));
  assert.deepStrictEqual([...seen].sort(), [5, 6, 7, 8]);
});

test('shuffle does not mutate its input and keeps every member', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(mulberry32(3), src);
  assert.deepStrictEqual(src, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepStrictEqual([...out].sort((x, y) => x - y), src);
});

test('pick returns a member of the array', () => {
  const arr = ['a', 'b', 'c'];
  const rng = mulberry32(42);
  for (let i = 0; i < 100; i++) assert.ok(arr.includes(pick(rng, arr)));
});

/* ── the module-loads gate ─────────────────────────────────────────────────────
   Walks the game's JS tree and imports everything. This is what enforces the
   "no DOM at import time" rule across every module, not just the engine — a stray
   top-level `document` would otherwise surface as an unrelated suite-wide crash. */

const GAME_JS = new URL('../games/tham-tu-mang/js/', import.meta.url);

function walk(dirUrl) {
  const dir = decodeURIComponent(dirUrl.pathname).replace(/^\/([A-Za-z]:)/, '$1');
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(pathToFileURL(full + '/')));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

test('every module imports without touching the DOM', async () => {
  const files = walk(GAME_JS);
  assert.ok(files.length > 0, 'found no modules to check');
  for (const file of files) {
    await assert.doesNotReject(
      () => import(pathToFileURL(file).href),
      `${relative(process.cwd(), file)} failed to import — a SyntaxError, or DOM access at ` +
      `module top level. DOM access belongs inside functions.`
    );
  }
});

/* ── Task 2: lasso geometry ─────────────────────────────────────────────── */

import { MIN_STROKE, MAX_W, MAX_H, bounds, strokeVerdict, pointInPolygon, centroid,
         nearestEnclosed } from '../games/tham-tu-mang/js/engine/hittest.js';

const square = (x, y, s) => [
  { x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }
];

test('bounds measures the stroke box', () => {
  const b = bounds(square(10, 20, 40));
  assert.deepStrictEqual(
    { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, w: b.w, h: b.h },
    { minX: 10, minY: 20, maxX: 50, maxY: 60, w: 40, h: 40 }
  );
});

test('a stroke under the floor is TOO_SMALL, not a claim', () => {
  assert.strictEqual(strokeVerdict(square(0, 0, MIN_STROKE - 1)), 'TOO_SMALL');
  assert.strictEqual(strokeVerdict([{ x: 1, y: 1 }, { x: 2, y: 2 }]), 'TOO_SMALL');
});

test('a stroke past the budget ring is TOO_BIG', () => {
  assert.strictEqual(strokeVerdict(square(0, 0, MAX_W + 1)), 'TOO_BIG');
  assert.strictEqual(strokeVerdict([
    { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: MAX_H + 5 }, { x: 0, y: MAX_H + 5 }
  ]), 'TOO_BIG');
});

test('a stroke inside both gates is OK', () => {
  assert.strictEqual(strokeVerdict(square(0, 0, 100)), 'OK');
});

test('pointInPolygon handles a convex loop', () => {
  const poly = square(0, 0, 100);
  assert.strictEqual(pointInPolygon({ x: 50, y: 50 }, poly), true);
  assert.strictEqual(pointInPolygon({ x: 150, y: 50 }, poly), false);
});

test('pointInPolygon handles a concave loop', () => {
  const poly = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 30 }, { x: 40, y: 30 },
    { x: 40, y: 70 }, { x: 100, y: 70 }, { x: 100, y: 100 }, { x: 0, y: 100 }
  ];
  assert.strictEqual(pointInPolygon({ x: 20, y: 50 }, poly), true);
  assert.strictEqual(pointInPolygon({ x: 70, y: 50 }, poly), false);
});

test('pointInPolygon handles a self-intersecting scribble without throwing', () => {
  const bowtie = [
    { x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }
  ];
  assert.strictEqual(typeof pointInPolygon({ x: 50, y: 25 }, bowtie), 'boolean');
});

test('centroid averages the stroke', () => {
  assert.deepStrictEqual(centroid(square(0, 0, 100)), { x: 50, y: 50 });
});

test('nearestEnclosed returns null when the loop holds nothing', () => {
  const targets = [{ id: 'a', anomaly: false, cx: 900, cy: 900 }];
  assert.strictEqual(nearestEnclosed(square(0, 0, 100), targets), null);
});

test('nearestEnclosed scores exactly one target, nearest the centroid', () => {
  const targets = [
    { id: 'far',  anomaly: false, cx: 20, cy: 20 },
    { id: 'near', anomaly: true,  cx: 52, cy: 48 }
  ];
  assert.strictEqual(nearestEnclosed(square(0, 0, 100), targets).id, 'near');
});

test('nearestEnclosed breaks ties stably toward the earlier target', () => {
  const targets = [
    { id: 'first',  anomaly: true,  cx: 40, cy: 50 },
    { id: 'second', anomaly: false, cx: 60, cy: 50 }
  ];
  assert.strictEqual(nearestEnclosed(square(0, 0, 100), targets).id, 'first');
});

test('a target centre exactly on an edge does not throw', () => {
  const targets = [{ id: 'edge', anomaly: true, cx: 0, cy: 50 }];
  assert.doesNotThrow(() => nearestEnclosed(square(0, 0, 100), targets));
});

/* ── Task 3: pinned image urls and the offline fallback ─────────────────── */

import { flickr, picsum, isPinned, fallbackSvg, imgHtml }
  from '../games/tham-tu-mang/js/engine/img.js';

test('flickr urls are pinned with a lock', () => {
  const url = flickr({ w: 600, h: 400, kw: 'skincare', lock: 7 });
  assert.match(url, /^https:\/\/loremflickr\.com\/600\/400\/skincare\?/);
  assert.match(url, /lock=7/);
  assert.strictEqual(isPinned(url), true);
});

test('picsum urls are pinned with an id', () => {
  const url = picsum({ w: 320, h: 240, id: 1015 });
  assert.strictEqual(url, 'https://picsum.photos/id/1015/320/240');
  assert.strictEqual(isPinned(url), true);
});

test('an unpinned url is rejected by isPinned', () => {
  assert.strictEqual(isPinned('https://loremflickr.com/600/400/lake'), false);
  assert.strictEqual(isPinned('https://picsum.photos/600/400'), false);
});

test('an unpinned request throws rather than returning a random photo', () => {
  assert.throws(() => flickr({ w: 600, h: 400, kw: 'lake' }), /lock is required/);
  assert.throws(() => picsum({ w: 600, h: 400 }), /id is required/);
});

test('grayscale and blur compose onto a pinned base without losing the pin', () => {
  const grey = flickr({ w: 600, h: 400, kw: 'lake', lock: 3, grayscale: true });
  assert.match(grey, /lock=3/);
  assert.ok(/grayscale|\/g\//.test(grey), `no grayscale marker in ${grey}`);
  assert.strictEqual(isPinned(grey), true);

  const blurred = picsum({ w: 600, h: 400, id: 20, blur: 2 });
  assert.match(blurred, /blur=2/);
  assert.strictEqual(isPinned(blurred), true);
});

test('fallbackSvg is a self-contained data uri needing no network', () => {
  const svg = fallbackSvg({ w: 600, h: 400, tint: '#d8c3b0', seed: 4 });
  assert.match(svg, /^data:image\/svg\+xml,/);

  // The xmlns is a namespace identifier, never fetched — so look for things that actually
  // pull bytes: href/src attributes and url() references pointing off-document.
  const body = decodeURIComponent(svg).replace(/xmlns="[^"]*"/g, '');
  assert.ok(!/(?:href|src)\s*=\s*"[^"]*http/i.test(body), 'fallback fetches a remote resource');
  assert.ok(!/url\(\s*['"]?http/i.test(body), 'fallback references a remote url()');
});

test('imgHtml wires an onerror fallback onto every image', () => {
  const html = imgHtml({
    src: flickr({ w: 600, h: 400, kw: 'skincare', lock: 7 }),
    alt: 'Kem dưỡng ẩm', w: 600, h: 400, tint: '#d8c3b0'
  });
  assert.match(html, /<img /);
  assert.match(html, /onerror=/);
  assert.match(html, /data:image\/svg\+xml/);
  assert.match(html, /alt="Kem dưỡng ẩm"/);
});

test('imgHtml refuses an unpinned src', () => {
  assert.throws(
    () => imgHtml({ src: 'https://picsum.photos/600/400', alt: 'x', w: 600, h: 400, tint: '#000' }),
    /pinned/i
  );
});

/* ── Task 4: chapter data ───────────────────────────────────────────────── */

import { CH1 } from '../games/tham-tu-mang/js/chapters/ch1-lumiere.js';
import { CHAPTERS } from '../games/tham-tu-mang/js/chapters/index.js';

test('chapter 1 declares the slot inventory the spec gives it', () => {
  const slots = CH1.pages[0].slots;
  assert.strictEqual(slots.paragraph, 9);
  assert.strictEqual(slots.photo, 7);
  assert.strictEqual(slots.avatar, 4);
  assert.strictEqual(slots['feature-icon'], 6);
  assert.strictEqual(slots.nav, 1);
  assert.strictEqual(slots.newsletter, 1);
});

test('chapter 1 rolls 6 to 8', () => {
  assert.strictEqual(CH1.min, 6);
  assert.strictEqual(CH1.max, 8);
});

test('chapter 1 forces the emoji anomaly so the tutorial teaches on something legible', () => {
  assert.deepStrictEqual(CH1.force, ['S07']);
});

test('CHAPTERS lists chapter 1 first', () => {
  assert.strictEqual(CHAPTERS[0].id, CH1.id);
});

test('every flavour pool is a non-empty array', () => {
  for (const [id, pool] of Object.entries(CH1.flavour)) {
    assert.ok(Array.isArray(pool), `${id} flavour must be an array`);
    assert.ok(pool.length > 0, `${id} flavour is empty`);
  }
});

test('T02 replacements change the SHAPE of the block, not one character', () => {
  // Spec §6 T02: a swap the player could only find by having memorised the page is luck,
  // not observation. >12 characters of difference is the mechanical proxy for that rule.
  for (const entry of CH1.flavour.T02) {
    const delta = Math.abs(entry.after.length - entry.before.length);
    assert.ok(delta > 12,
      `T02 "${entry.before}" -> "${entry.after}" differs by only ${delta} chars; ` +
      `the player would have to have memorised the page to spot it`);
  }
});

/* ── Task 5: the anomaly registry ───────────────────────────────────────── */

import { ANOMALIES, byId } from '../games/tham-tu-mang/js/engine/registry.js';

const STAGE1_IDS = ['T01','T02','T03','T04','T05','S01','S04','S05','S06','S07','M01','M03','E01','E04','E05','R05','I01','I03','I04'];
const FAMILIES = ['TEXT','STYLE','MOTION','ELEMENT','REACTIVE','IMAGE'];

test('the registry holds exactly the stage 1 anomalies', () => {
  assert.deepStrictEqual(ANOMALIES.map((a) => a.id).sort(), [...STAGE1_IDS].sort());
});

test('every anomaly id is unique', () => {
  const ids = ANOMALIES.map((a) => a.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('all six families are represented', () => {
  const present = new Set(ANOMALIES.map((a) => a.family));
  for (const f of FAMILIES) assert.ok(present.has(f), `family ${f} is missing`);
});

test('every anomaly declares a family, at least one slot, a weight and an apply', () => {
  for (const a of ANOMALIES) {
    assert.ok(FAMILIES.includes(a.family), `${a.id} has family ${a.family}`);
    assert.ok(Array.isArray(a.slots) && a.slots.length > 0, `${a.id} declares no slots`);
    assert.strictEqual(typeof a.weight, 'number', `${a.id} has no weight`);
    assert.strictEqual(typeof a.apply, 'function', `${a.id} has no apply()`);
  }
});

test('every anomaly is eligible for at least one chapter', () => {
  for (const a of ANOMALIES) {
    const ok = CHAPTERS.some((c) =>
      c.pages.some((p) => a.slots.some((s) => (p.slots[s] || 0) > 0)));
    assert.ok(ok, `${a.id} can never be placed — no chapter has any of ${a.slots.join(', ')}`);
  }
});

test('every eligible anomaly has a flavour pool in chapter 1', () => {
  for (const a of ANOMALIES) {
    const eligible = CH1.pages.some((p) => a.slots.some((s) => (p.slots[s] || 0) > 0));
    if (!eligible) continue;
    assert.ok(CH1.flavour[a.id], `${a.id} can be placed in Ch1 but has no flavour pool there`);
  }
});

test('byId finds an anomaly and returns null for a stranger', () => {
  assert.strictEqual(byId('T01').family, 'TEXT');
  assert.strictEqual(byId('ZZ9'), null);
});

/* ── Task 11: the T03 number ladder ─────────────────────────────────────── */

import { descend, formatVi, renderNumber } from '../games/tham-tu-mang/js/anomalies/text.js';

test('formatVi uses a comma for decimals, never a dot', () => {
  assert.strictEqual(formatVi(8.5), '8,5');
  assert.strictEqual(formatVi(12), '12');
  assert.ok(!formatVi(8.25).includes('.'));
});

test('descend walks the five phases in order and gives up on being a number', () => {
  const seen = [];
  let value = 12;
  for (let step = 0; step < 24; step++) {
    const next = descend(value, step);
    seen.push(renderNumber(next));
    if (typeof next === 'number') value = next;
  }
  assert.ok(seen.some((t) => /^\d+$/.test(t)), 'no plain integer phase');
  assert.ok(seen.some((t) => t.includes(',')), 'no fractional phase');
  assert.ok(seen.some((t) => t.startsWith('-')), 'no negative phase');
  assert.ok(seen.some((t) => /e-?\d/i.test(t)), 'no scientific-notation phase');
  assert.ok(seen.some((t) => GIVE_UP_MARKERS.includes(t)), 'it never stops being a number');
});

const GIVE_UP_MARKERS = ['∅', 'NaN', '∞'];

test('the descent passes through Avogadro before giving up', () => {
  // Note: String(6.02e23) is "6.02e+23" — it is renderNumber that produces the Vietnamese
  // "6,02e23" the player actually sees, so the assertion has to go through it.
  const all = [];
  let value = 12;
  for (let step = 0; step < 24; step++) {
    const next = descend(value, step);
    all.push(renderNumber(next));
    if (typeof next === 'number') value = next;
  }
  assert.ok(all.includes('6,02e23'),
    `the descent must land on Avogadro. Got: ${all.join(' ')}`);
});

/* ── Task 6: the director ───────────────────────────────────────────────── */

import { plan } from '../games/tham-tu-mang/js/engine/director.js';

const SEEDS = Array.from({ length: 500 }, (_, i) => i * 7919 + 13);

test('the same seed reproduces an identical plan', () => {
  assert.deepStrictEqual(plan(CH1, 4242), plan(CH1, 4242));
});

test('different seeds produce different plans at least sometimes', () => {
  const shapes = new Set(SEEDS.slice(0, 50).map((s) => JSON.stringify(plan(CH1, s).picks)));
  assert.ok(shapes.size > 5, `only ${shapes.size} distinct plans in 50 seeds — not random enough`);
});

test('count always lands inside the chapter range, and every rolled anomaly is placed', () => {
  for (const seed of SEEDS) {
    const { count, picks } = plan(CH1, seed);
    assert.ok(count >= CH1.min && count <= CH1.max, `seed ${seed} rolled ${count}`);
    assert.strictEqual(picks.length, count, `seed ${seed} promised ${count}, placed ${picks.length}`);
  }
});

test('never two anomalies on the same slot element', () => {
  for (const seed of SEEDS) {
    const keys = plan(CH1, seed).picks.map((p) => `${p.page}:${p.slot}:${p.nth}`);
    assert.strictEqual(new Set(keys).size, keys.length, `seed ${seed} stacked two on one element`);
  }
});

test('never more than two from one family', () => {
  for (const seed of SEEDS) {
    const counts = {};
    for (const p of plan(CH1, seed).picks) counts[p.family] = (counts[p.family] || 0) + 1;
    for (const [family, n] of Object.entries(counts)) {
      assert.ok(n <= 2, `seed ${seed} took ${n} from ${family}`);
    }
  }
});

test('at least three families every time', () => {
  for (const seed of SEEDS) {
    const families = new Set(plan(CH1, seed).picks.map((p) => p.family));
    assert.ok(families.size >= 3, `seed ${seed} used only ${families.size} families`);
  }
});

test('every page gets at least one anomaly', () => {
  for (const seed of SEEDS) {
    const { picks } = plan(CH1, seed);
    for (const page of CH1.pages) {
      assert.ok(picks.some((p) => p.page === page.id), `seed ${seed} left page ${page.id} clean`);
    }
  }
});

test('a forced anomaly is always present', () => {
  for (const seed of SEEDS) {
    assert.ok(plan(CH1, seed).picks.map((p) => p.id).includes('S07'),
      `seed ${seed} dropped the forced S07`);
  }
});

test('an excluded anomaly never appears', () => {
  const chapter = { ...CH1, force: [], exclude: ['T01', 'S07'] };
  for (const seed of SEEDS) {
    const ids = plan(chapter, seed).picks.map((p) => p.id);
    assert.ok(!ids.includes('T01') && !ids.includes('S07'), `seed ${seed} placed an excluded anomaly`);
  }
});

test('every placed slot actually exists on its page', () => {
  for (const seed of SEEDS) {
    for (const p of plan(CH1, seed).picks) {
      const page = CH1.pages.find((pg) => pg.id === p.page);
      const available = page.slots[p.slot] || 0;
      assert.ok(p.nth < available,
        `seed ${seed} placed ${p.id} on ${p.slot}[${p.nth}] but the page has ${available}`);
    }
  }
});

test('an anomaly is only placed on a slot type it declares', () => {
  for (const seed of SEEDS) {
    for (const p of plan(CH1, seed).picks) {
      assert.ok(byId(p.id).slots.includes(p.slot), `${p.id} does not accept ${p.slot}`);
    }
  }
});

/* ── Task 7 + 10: ranks, and the heart rules ────────────────────────────── */

import { rankOf } from '../games/tham-tu-mang/js/storage.js';
import { resolve } from '../games/tham-tu-mang/js/engine/run.js';
import { newRun } from '../games/tham-tu-mang/js/state.js';

test('rank is derived from hearts remaining', () => {
  assert.strictEqual(rankOf(3), 'S');
  assert.strictEqual(rankOf(2), 'A');
  assert.strictEqual(rankOf(1), 'B');
  assert.strictEqual(rankOf(0), '—');
});

const box = (x, y, s) => [
  { x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }
];
const runWith = (total) => newRun(CH1, 1, Array.from({ length: total }, (_, i) => ({ id: `A${i}` })));

test('circling an anomaly logs evidence and keeps every heart', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: true, anomId: 'T01', cx: 50, cy: 50 }];
  const r = resolve(run, box(0, 0, 100), 'OK', targets);
  assert.strictEqual(r.outcome, 'CAPTURED');
  assert.strictEqual(run.hearts, 3);
  assert.strictEqual(run.found.size, 1);
});

test('circling ordinary content costs a heart', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: false, anomId: null, cx: 50, cy: 50 }];
  assert.strictEqual(resolve(run, box(0, 0, 100), 'OK', targets).outcome, 'WRONG');
  assert.strictEqual(run.hearts, 2);
});

test('circling nothing costs a heart too — an empty circle is a wrong claim', () => {
  const run = runWith(3);
  assert.strictEqual(resolve(run, box(0, 0, 100), 'OK', []).outcome, 'WRONG');
  assert.strictEqual(run.hearts, 2);
});

test('a stroke below the floor is voided before hit-testing and costs nothing', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: false, anomId: null, cx: 5, cy: 5 }];
  assert.strictEqual(resolve(run, box(0, 0, 4), 'TOO_SMALL', targets).outcome, 'TOO_SMALL');
  assert.strictEqual(run.hearts, 3);
});

test('a stroke past the budget ring is voided and captures nothing', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: true, anomId: 'T01', cx: 50, cy: 50 }];
  assert.strictEqual(resolve(run, box(0, 0, 900), 'TOO_BIG', targets).outcome, 'TOO_BIG');
  assert.strictEqual(run.hearts, 3);
  assert.strictEqual(run.found.size, 0, 'an oversized loop must not capture anything');
});

test('re-circling a found anomaly is a no-op, not a heart', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: true, anomId: 'T01', cx: 50, cy: 50 }];
  resolve(run, box(0, 0, 100), 'OK', targets);
  assert.strictEqual(resolve(run, box(0, 0, 100), 'OK', targets).outcome, 'ALREADY');
  assert.strictEqual(run.hearts, 3);
  assert.strictEqual(run.found.size, 1);
});

test('finding every anomaly wins the run', () => {
  const run = runWith(2);
  resolve(run, box(0, 0, 100), 'OK', [{ id: 'a', anomaly: true, anomId: 'A0', cx: 50, cy: 50 }]);
  assert.strictEqual(run.over, false);
  resolve(run, box(0, 0, 100), 'OK', [{ id: 'b', anomaly: true, anomId: 'A1', cx: 50, cy: 50 }]);
  assert.strictEqual(run.over, true);
  assert.strictEqual(run.won, true);
});

test('losing every heart ends the run', () => {
  const run = runWith(5);
  const miss = [{ id: 'x', anomaly: false, anomId: null, cx: 50, cy: 50 }];
  resolve(run, box(0, 0, 100), 'OK', miss);
  resolve(run, box(0, 0, 100), 'OK', miss);
  assert.strictEqual(run.over, false);
  resolve(run, box(0, 0, 100), 'OK', miss);
  assert.strictEqual(run.hearts, 0);
  assert.strictEqual(run.over, true);
  assert.strictEqual(run.won, false);
});

test('a finished run ignores further strokes', () => {
  const run = runWith(1);
  resolve(run, box(0, 0, 100), 'OK', [{ id: 'a', anomaly: true, anomId: 'A0', cx: 50, cy: 50 }]);
  const after = resolve(run, box(0, 0, 100), 'OK',
    [{ id: 'x', anomaly: false, anomId: null, cx: 50, cy: 50 }]);
  assert.strictEqual(after.outcome, 'ALREADY');
  assert.strictEqual(run.hearts, 3);
});

/* ── Task 8: the LUMIÈRE site ───────────────────────────────────────────── */

import { PAGE_INDEX } from '../games/tham-tu-mang/sites/ch1-lumiere/page.js';

function slotCounts(html) {
  const counts = {};
  for (const m of html.matchAll(/data-slot="([^"]+)"/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
  return counts;
}

test('the LUMIÈRE page ships exactly the slots chapter 1 declares', () => {
  assert.deepStrictEqual(slotCounts(PAGE_INDEX.html), CH1.pages[0].slots);
});

test('the page marks ordinary content as catchable', () => {
  const catches = [...PAGE_INDEX.html.matchAll(/data-catch/g)].length;
  assert.ok(catches >= 10, `only ${catches} data-catch elements — wrong captures need targets`);
});

test('every image on the page is pinned', () => {
  for (const m of PAGE_INDEX.html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    assert.ok(isPinned(m[1]), `unpinned image src: ${m[1]}`);
  }
});

test('every image carries an onerror fallback', () => {
  const imgs = [...PAGE_INDEX.html.matchAll(/<img[^>]*>/g)];
  assert.ok(imgs.length > 0, 'the page has no images at all');
  for (const [tag] of imgs) assert.match(tag, /onerror=/, `image without a fallback: ${tag}`);
});

test('the page makes no network request other than images', () => {
  assert.ok(!/<script/i.test(PAGE_INDEX.html), 'site markup must not carry scripts');
  assert.ok(!/<link[^>]+href="http/i.test(PAGE_INDEX.html), 'no remote stylesheets');
});

test('every anomaly the director can place has a slot that exists on the page', () => {
  // Ties the three together: registry slots -> chapter declaration -> real markup.
  const present = slotCounts(PAGE_INDEX.html);
  for (const seed of SEEDS.slice(0, 200)) {
    for (const p of plan(CH1, seed).picks) {
      assert.ok((present[p.slot] || 0) > p.nth,
        `seed ${seed}: ${p.id} wants ${p.slot}[${p.nth}], page has ${present[p.slot] || 0}`);
    }
  }
});

/* ── Give up, and the results reveal ────────────────────────────────────── */

import { giveUp } from '../games/tham-tu-mang/js/engine/run.js';

test('giving up ends the run without spending hearts', () => {
  const run = runWith(6);
  assert.strictEqual(giveUp(run), true);
  assert.strictEqual(run.over, true);
  assert.strictEqual(run.won, false);
  assert.strictEqual(run.gaveUp, true);
  assert.strictEqual(run.hearts, 3, 'giving up is not a heart penalty');
});

test('giving up keeps whatever was already found, for the results list', () => {
  const run = runWith(3);
  resolve(run, box(0, 0, 100), 'OK', [{ id: 'a', anomaly: true, anomId: 'A0', cx: 50, cy: 50 }]);
  giveUp(run);
  assert.strictEqual(run.found.size, 1);
  assert.strictEqual(run.total, 3);
});

test('giving up twice is a no-op', () => {
  const run = runWith(3);
  assert.strictEqual(giveUp(run), true);
  assert.strictEqual(giveUp(run), false);
});

test('a run already won cannot be retroactively given up', () => {
  const run = runWith(1);
  resolve(run, box(0, 0, 100), 'OK', [{ id: 'a', anomaly: true, anomId: 'A0', cx: 50, cy: 50 }]);
  assert.strictEqual(run.won, true);
  assert.strictEqual(giveUp(run), false);
  assert.strictEqual(run.won, true, 'winning must survive a stray give-up click');
});

test('every anomaly carries a label, so the results list reads as findings not ids', () => {
  for (const a of ANOMALIES) {
    assert.strictEqual(typeof a.label, 'string', `${a.id} has no label`);
    assert.ok(a.label.length > 3, `${a.id} label is too short to mean anything`);
    assert.ok(a.label !== a.id, `${a.id} label is just its id`);
  }
});

test('the results list can name every anomaly the director places', () => {
  for (const seed of SEEDS.slice(0, 200)) {
    for (const p of plan(CH1, seed).picks) {
      assert.ok(byId(p.id)?.label, `seed ${seed}: ${p.id} would render as a bare id`);
    }
  }
});

/* ── Multi-point targets, and the unwinnable-run safety net ─────────────── */

import { reconcile } from '../games/tham-tu-mang/js/engine/run.js';

test('a target is hit by any of its line points, not only its box centre', () => {
  // A one-line <p> spanning the column: its text sits left, its box centre sits right in
  // empty margin. Circling the words must score; that was the R05 bug.
  const textLine = { id: 'note', anomaly: true, anomId: 'R05', points: [{ x: 40, y: 50 }] };
  const loopOverText = [
    { x: 10, y: 30 }, { x: 90, y: 30 }, { x: 90, y: 70 }, { x: 10, y: 70 }
  ];
  assert.strictEqual(nearestEnclosed(loopOverText, [textLine]).anomId, 'R05');
});

test('a multi-line block is hit by circling any single line', () => {
  const para = {
    id: 'p', anomaly: true, anomId: 'T01',
    points: [{ x: 40, y: 20 }, { x: 40, y: 50 }, { x: 40, y: 80 }]
  };
  for (const y of [20, 50, 80]) {
    const loop = [
      { x: 10, y: y - 12 }, { x: 80, y: y - 12 }, { x: 80, y: y + 12 }, { x: 10, y: y + 12 }
    ];
    assert.strictEqual(nearestEnclosed(loop, [para])?.anomId, 'T01', `line at y=${y} missed`);
  }
});

test('the old single-centre target shape still resolves', () => {
  const t = [{ id: 'a', anomaly: true, anomId: 'X', cx: 50, cy: 50 }];
  assert.strictEqual(nearestEnclosed(square(0, 0, 100), t).anomId, 'X');
});

test('reconcile drops an anomaly that never attached, keeping the run winnable', () => {
  const run = newRun(CH1, 1, [{ id: 'T01' }, { id: 'S01' }, { id: 'E04' }]);
  const dropped = reconcile(run, new Set(['T01', 'E04']), () => null);
  assert.deepStrictEqual(dropped, ['S01']);
  assert.strictEqual(run.total, 2, 'the counter must not promise an unreachable number');
  assert.deepStrictEqual(run.picks.map((p) => p.id), ['T01', 'E04']);
});

test('reconcile spares a deferred anomaly that is absent on purpose', () => {
  const run = newRun(CH1, 1, [{ id: 'T01' }, { id: 'R05' }]);
  const dropped = reconcile(run, new Set(['T01']), (id) => (id === 'R05' ? { deferred: true } : null));
  assert.deepStrictEqual(dropped, [], 'a reactive anomaly is absent until triggered');
  assert.strictEqual(run.total, 2);
});

test('reconcile leaves a fully attached plan untouched', () => {
  const run = newRun(CH1, 1, [{ id: 'T01' }, { id: 'E04' }]);
  assert.deepStrictEqual(reconcile(run, new Set(['T01', 'E04']), () => null), []);
  assert.strictEqual(run.total, 2);
});

test('S01 declares no fixed word list — it must read the page it lands on', () => {
  // The regression that made this chapter unwinnable: S01 carried its own words, none of
  // which appear in the LUMIÈRE copy, so it silently marked nothing at all.
  for (const entry of CH1.flavour.S01) {
    assert.ok(!('word' in entry),
      'S01 flavour must supply only font families; the word comes from the element text');
    assert.ok(entry.family, 'S01 flavour entry needs a font family');
  }
});

test('R05 is the only stage 1 anomaly marked deferred', () => {
  const deferred = ANOMALIES.filter((a) => a.deferred).map((a) => a.id);
  assert.deepStrictEqual(deferred, ['R05'],
    'only two-stage reactive anomalies may be absent from the DOM after apply()');
});

/* ── Resolution: anomaly priority and scribble-to-select ────────────────── */

import { pointInRect } from '../games/tham-tu-mang/js/engine/hittest.js';

const rectAt = (x, y, w, h) => ({ left: x, right: x + w, top: y, bottom: y + h });

test('pointInRect covers the box including its edges', () => {
  const r = rectAt(0, 0, 100, 40);
  assert.strictEqual(pointInRect({ x: 50, y: 20 }, r), true);
  assert.strictEqual(pointInRect({ x: 0, y: 0 }, r), true);
  assert.strictEqual(pointInRect({ x: 101, y: 20 }, r), false);
});

test('an anomaly nested in a clean container wins over the container', () => {
  // The bug this fixes: S01's odd word is a <span> inside a <p data-catch>. Circling the word
  // encloses both, and the paragraph's line centre is often NEARER the loop centroid than the
  // word is — so the player circled the anomaly and lost a heart for it.
  const para = { id: 'p', anomaly: false, anomId: null, points: [{ x: 150, y: 50 }] };
  const word = { id: 'w', anomaly: true, anomId: 'S01', points: [{ x: 120, y: 50 }] };
  const loop = [{ x: 100, y: 30 }, { x: 200, y: 30 }, { x: 200, y: 70 }, { x: 100, y: 70 }];

  // centroid is x=150 — exactly on the paragraph's point, 30px from the word's
  assert.strictEqual(nearestEnclosed(loop, [para, word]).anomId, 'S01');
});

test('anomaly priority holds regardless of target order', () => {
  const para = { id: 'p', anomaly: false, anomId: null, points: [{ x: 150, y: 50 }] };
  const word = { id: 'w', anomaly: true, anomId: 'S01', points: [{ x: 120, y: 50 }] };
  const loop = [{ x: 100, y: 30 }, { x: 200, y: 30 }, { x: 200, y: 70 }, { x: 100, y: 70 }];
  assert.strictEqual(nearestEnclosed(loop, [word, para]).anomId, 'S01');
});

test('the nearest anomaly wins when two anomalies are both enclosed', () => {
  const far = { id: 'a', anomaly: true, anomId: 'T01', points: [{ x: 115, y: 50 }] };
  const near = { id: 'b', anomaly: true, anomId: 'E04', points: [{ x: 148, y: 50 }] };
  const loop = [{ x: 100, y: 30 }, { x: 200, y: 30 }, { x: 200, y: 70 }, { x: 100, y: 70 }];
  assert.strictEqual(nearestEnclosed(loop, [far, near]).anomId, 'E04');
});

test('scribbling on a target selects it even when no centre is inside the loop', () => {
  // A small loop drawn ON a wide line of text: the line's centre is far to the right and
  // outside the loop, but the loop's own centre lands on the text.
  const line = {
    id: 'note', anomaly: true, anomId: 'R05',
    points: [{ x: 400, y: 50 }], rects: [rectAt(20, 40, 760, 20)]
  };
  const scribble = [{ x: 40, y: 45 }, { x: 70, y: 45 }, { x: 70, y: 56 }, { x: 40, y: 56 }];
  assert.strictEqual(nearestEnclosed(scribble, [line])?.anomId, 'R05');
});

test('a loop over genuinely empty space still hits nothing', () => {
  const line = {
    id: 'note', anomaly: true, anomId: 'R05',
    points: [{ x: 400, y: 50 }], rects: [rectAt(20, 40, 760, 20)]
  };
  const elsewhere = [
    { x: 40, y: 300 }, { x: 90, y: 300 }, { x: 90, y: 340 }, { x: 40, y: 340 }
  ];
  assert.strictEqual(nearestEnclosed(elsewhere, [line]), null,
    'scribble-to-select must not turn the whole page into a hit');
});

test('a clean target is still returned when no anomaly is in the loop', () => {
  const para = { id: 'p', anomaly: false, anomId: null, points: [{ x: 150, y: 50 }] };
  const loop = [{ x: 100, y: 30 }, { x: 200, y: 30 }, { x: 200, y: 70 }, { x: 100, y: 70 }];
  assert.strictEqual(nearestEnclosed(loop, [para]).id, 'p');
});

test('anomaly priority does not resurrect an out-of-range anomaly', () => {
  const para = { id: 'p', anomaly: false, anomId: null, points: [{ x: 150, y: 50 }] };
  const away = { id: 'a', anomaly: true, anomId: 'T01', points: [{ x: 900, y: 900 }] };
  const loop = [{ x: 100, y: 30 }, { x: 200, y: 30 }, { x: 200, y: 70 }, { x: 100, y: 70 }];
  assert.strictEqual(nearestEnclosed(loop, [para, away]).id, 'p',
    'only ENCLOSED anomalies get priority');
});

/* ── Positional variety ─────────────────────────────────────────────────── */

test('an anomaly does not always land on the first element of its slot type', () => {
  // The bug: claimSlot offered one option per slot TYPE with nth = "number already used", so
  // the first claimant of a type always got index 0. With three emoji, the odd one was always
  // the first — a rule the player learns far faster than they learn to observe.
  const seen = new Map();
  for (const seed of SEEDS) {
    for (const p of plan(CH1, seed).picks) {
      if (!seen.has(p.slot)) seen.set(p.slot, new Set());
      seen.get(p.slot).add(p.nth);
    }
  }
  for (const [slot, positions] of seen) {
    const available = CH1.pages[0].slots[slot];
    if (available < 2) continue;
    assert.ok(positions.size > 1,
      `${slot} has ${available} elements but anomalies only ever landed on index ` +
      `${[...positions]} across ${SEEDS.length} seeds`);
  }
});

test('over many seeds every position of a multi-slot type gets used', () => {
  const seen = new Set();
  for (const seed of SEEDS) {
    for (const p of plan(CH1, seed).picks) if (p.slot === 'feature-icon') seen.add(p.nth);
  }
  const available = CH1.pages[0].slots['feature-icon'];
  assert.strictEqual(seen.size, available,
    `only ${seen.size} of ${available} feature-icon positions ever used: ${[...seen].sort()}`);
});

/* ── Vietnamese glyph coverage ──────────────────────────────────────────── */

test('S01 never reskins a word with a generic font family', () => {
  // Generic families (cursive/fantasy/monospace) resolve to whatever the OS picked, which
  // often lacks precomposed Vietnamese glyphs. The browser then swaps fonts mid-word and the
  // result reads as "this page is broken" rather than "this word is wrong" — the anomaly
  // stops meaning anything. Named families with Vietnamese coverage only.
  const GENERIC = ['cursive', 'fantasy', 'monospace', 'serif', 'sans-serif', 'system-ui'];
  for (const entry of CH1.flavour.S01) {
    const first = entry.family.split(',')[0].trim().replace(/^["']|["']$/g, '');
    assert.ok(!GENERIC.includes(first),
      `S01 family "${entry.family}" leads with the generic "${first}"`);
  }
});

test('the LUMIÈRE copy really does contain stacked Vietnamese diacritics', () => {
  // Guards the fixture behind the font work: if the copy were ever flattened to ASCII the
  // font stacks would look fine and prove nothing.
  const stacked = /[ằẳẵặầẩẫậềểễệồổỗộừửữựờởỡợắấéếóốớúứíì]/;
  assert.ok(stacked.test(PAGE_INDEX.html),
    'page copy has no stacked-diacritic characters to exercise the font stack');
});
