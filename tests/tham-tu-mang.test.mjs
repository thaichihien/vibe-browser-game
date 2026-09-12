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

import { MIN_STROKE, MAX_W, MAX_H, CLOSE_MIN, bounds, strokeVerdict, pointInPolygon, centroid,
         closureGap, closureSlack, isClosed, VOID_VERDICTS,
         nearestEnclosed } from '../games/tham-tu-mang/js/engine/hittest.js';

const square = (x, y, s) => [
  { x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }
];

/* What a finished stroke looks like: the pen came back to where it started.
   `square` is four corners of a POLYGON — its closure is implicit, and it is still the right
   fixture for pointInPolygon. A stroke is a path, and strokeVerdict now judges whether the
   player actually closed it, so stroke fixtures have to say so explicitly. */
const loop = (x, y, s) => [...square(x, y, s), { x, y }];

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

test('a stroke inside every gate is OK', () => {
  assert.strictEqual(strokeVerdict(loop(0, 0, 100)), 'OK');
});

test('a loop that never came back to its start is NOT_CLOSED, not a claim', () => {
  // Three quarters of a 100px box: the pen stopped 100px from where it began.
  const arc = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  assert.strictEqual(strokeVerdict(arc), 'NOT_CLOSED');
});

test('closing tolerance scales with the size of the loop', () => {
  // The same gap is a rounding error on a big loop and a gaping hole on a small one.
  assert.ok(closureSlack(loop(0, 0, 300)) > closureSlack(loop(0, 0, 40)));
  assert.strictEqual(closureSlack(loop(0, 0, 20)), CLOSE_MIN, 'small loops get the floor');
});

test('a loop closed to within its slack counts as closed', () => {
  const nearly = [...square(0, 0, 100), { x: CLOSE_MIN - 4, y: 0 }];
  assert.ok(closureGap(nearly) < closureSlack(nearly));
  assert.strictEqual(isClosed(nearly), true);
  assert.strictEqual(strokeVerdict(nearly), 'OK');
});

test('closure is judged on release, never while the stroke is still being drawn', () => {
  // A loop in progress is open almost the whole way round. If the preview applied the closure
  // rule, the aim outline would blank out for all but the last few pixels of every stroke —
  // hiding the one thing the preview exists to show.
  const arc = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  assert.strictEqual(strokeVerdict(arc, undefined, { requireClosed: false }), 'OK');
  assert.strictEqual(strokeVerdict(arc), 'NOT_CLOSED');
});

test('the size gates are still checked before closure, so neither can leak', () => {
  // An unclosed stroke that is also too big must report the cheaper rejection first: both are
  // void, and both are decided without ever looking at the page.
  const huge = [{ x: 0, y: 0 }, { x: MAX_W + 50, y: 0 }, { x: MAX_W + 50, y: 50 }];
  assert.strictEqual(strokeVerdict(huge), 'TOO_BIG');
  for (const v of ['TOO_SMALL', 'TOO_BIG', 'NOT_CLOSED']) assert.ok(VOID_VERDICTS.includes(v));
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

import { flickr, picsum, portrait, isPinned, fallbackSvg, imgHtml }
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

test('portrait urls are pinned by their path', () => {
  // No parameter to forget: the path itself names one photograph.
  assert.strictEqual(portrait({ set: 'women', n: 27 }),
    'https://randomuser.me/api/portraits/women/27.jpg');
  assert.strictEqual(isPinned(portrait({ set: 'women', n: 27 })), true);
  assert.strictEqual(isPinned(portrait({ set: 'men', n: 4 })), true);
});

test('portrait refuses a missing index or an unknown set', () => {
  assert.throws(() => portrait({ set: 'women' }), /n is required/);
  assert.throws(() => portrait({ set: 'people', n: 3 }), /unknown set/);
});

test('an unpinned url is rejected by isPinned', () => {
  assert.strictEqual(isPinned('https://loremflickr.com/600/400/lake'), false);
  assert.strictEqual(isPinned('https://picsum.photos/600/400'), false);
  assert.strictEqual(isPinned('https://randomuser.me/api/portraits/women/'), false);
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
  assert.strictEqual(slots.hours, 3);
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

test('every flavour pool holds something to draw from', () => {
  // Most pools are a flat array. T07's is keyed by the SHAPE of the timestamp it corrupts
  // ({ time, date }), because a clock reading dropped into a date field reads as junk data
  // rather than as a date that cannot exist — see anomalies/text.js.
  for (const chapter of CHAPTERS) {
    for (const [id, pool] of Object.entries(chapter.flavour)) {
      const lists = Array.isArray(pool) ? [pool] : Object.values(pool);
      assert.ok(lists.length > 0, `${chapter.id}/${id} flavour is empty`);
      for (const list of lists) {
        assert.ok(Array.isArray(list), `${chapter.id}/${id} flavour must be an array`);
        assert.ok(list.length > 0, `${chapter.id}/${id} flavour is empty`);
      }
    }
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

/* Mọi dị thường đã dựng. T09, M06, E03, I02 và R04 vào cùng chương 4 — bốn cái đầu vì
   chương đó là chỗ đầu tiên có `map`, có bảy tấm ảnh và có một thanh nav chưa ai dùng hết,
   còn R04 thì spec §6 đã dành sẵn cho ô đặt phòng của nó. */
const STAGE1_IDS = ['T01','T02','T03','T05','T06','T07','T08','T09','S01','S05','S06','S07',
  'M01','M03','M06','E01','E02','E03','E04','E05','R01','R02','R04','R05','R06','I01','I02','I03','I04'];
const FAMILIES = ['TEXT','STYLE','MOTION','ELEMENT','REACTIVE','IMAGE'];

test('the registry holds exactly the anomalies that are built', () => {
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

test('an unclosed loop is voided before hit-testing and costs nothing', () => {
  // The stroke sits right on top of clean content, so if closure were judged after hit-testing
  // this would be a WRONG and a lost heart. Cancelling has to happen first, and cost nothing.
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: false, anomId: null, cx: 50, cy: 50 }];
  const r = resolve(run, box(0, 0, 100), 'NOT_CLOSED', targets);
  assert.strictEqual(r.outcome, 'NOT_CLOSED');
  assert.strictEqual(run.hearts, 3);
  assert.strictEqual(run.found.size, 0, 'a cancelled gesture must not score either');
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

test('the four testimonial portraits are four different photographs', () => {
  // I03 puts one avatar's face onto another so that two names share it. If the portraits
  // were not plainly different people to begin with, there is nothing for it to collapse.
  const faces = [...PAGE_INDEX.html.matchAll(/randomuser\.me\/api\/portraits\/\w+\/(\d+)\.jpg/g)]
    .map((m) => m[1]);
  assert.strictEqual(faces.length, 4, 'chapter 1 declares four avatar slots');
  assert.strictEqual(new Set(faces).size, 4, `two testimonials already share a face: ${faces}`);
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

test('the page answers ordinary interaction without a script tag in its markup', () => {
  // A form that swallows an email and says nothing is an anomaly nobody placed — and it also
  // kills R05, because if the clean branch is silent then ANY confirmation is the anomaly and
  // the player never has to read the date. Site markup may not carry <script>, so the honest
  // behaviour lives in a behaviour() hook that main.js calls after mounting.
  assert.strictEqual(typeof PAGE_INDEX.behaviour, 'function');
  assert.ok(!/<script/i.test(PAGE_INDEX.html));
});

test('importing a site never touches the DOM, behaviour hook included', () => {
  // The hook may only reach for the document when it is CALLED. If it ran at import, this
  // file — which has no DOM at all — would already have thrown above.
  assert.strictEqual(PAGE_INDEX.behaviour.length, 1, 'behaviour(shadow) takes its root as an argument');
  assert.throws(() => PAGE_INDEX.behaviour(undefined), /Cannot read|undefined/);
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

/* ── Chapter 2: two pages, and the cross-page reference ─────────────────── */

import { CH2 } from '../games/tham-tu-mang/js/chapters/ch2-bep-nha-may.js';
import { CH3 } from '../games/tham-tu-mang/js/chapters/ch3-san-do-cu.js';
import { CH3_PAGES, GOODS, CATEGORIES } from '../games/tham-tu-mang/sites/ch3-san-do-cu/pages.js';
import { CH4 } from '../games/tham-tu-mang/js/chapters/ch4-ho-vang.js';
import { PAGE_INDEX as CH4_INDEX } from '../games/tham-tu-mang/sites/ch4-ho-vang/page.js';
const CH4_PAGES = [CH4_INDEX];
const CH3_BY_ID = Object.fromEntries(CH3_PAGES.map((p) => [p.id, p]));
import { CH2_PAGES, CH2_INDEX, CH2_POST } from '../games/tham-tu-mang/sites/ch2-bep-nha-may/pages.js';
const CH2_BY_ID = Object.fromEntries(CH2_PAGES.map((p) => [p.id, p]));
import { unlockedUpTo, isUnlocked, unlockAllRequested }
  from '../games/tham-tu-mang/js/chapters/index.js';

const CH2_MARKUP = CH2_BY_ID;

test('both LUMIÈRE pages and both Bếp Nhà Mây pages ship exactly the slots they declare', () => {
  /* The assertion that catches "the director placed an anomaly on paragraph[3] of a page that
     only has three paragraphs" — which silently drops the anomaly and shrinks the evidence
     count with nothing on screen to say so. It has to be per PAGE, not per chapter: slot
     indexes restart on every page. */
  for (const page of CH2.pages) {
    assert.deepStrictEqual(slotCounts(CH2_MARKUP[page.id].html), page.slots,
      `chapter 2 page "${page.id}" markup does not match its declaration`);
  }
});

test('chapter 2 declares no nav slot, so nothing that needs one can land there', () => {
  // A personal blog has a one-line header. Spec §6.1 lists this as deliberate.
  for (const page of CH2.pages) assert.ok(!page.slots.nav, `page ${page.id} grew a nav slot`);
  for (const seed of SEEDS.slice(0, 200)) {
    for (const p of plan(CH2, seed).picks) {
      assert.notStrictEqual(p.slot, 'nav', `seed ${seed} placed ${p.id} on a nav that does not exist`);
    }
  }
});

test('the archive can be wrong, and every month it offers is impossible', () => {
  /* The sidebar used to be ten data-catch elements and no slots — a region that could only
     ever punish the player, never reward them. The archive is a real surface now; the
     memorial beside it deliberately is not (see the next test). */
  for (const page of CH2_PAGES) {
    const box = page.html.slice(page.html.indexOf('Lưu trữ'), page.html.indexOf('</aside>'));
    assert.strictEqual((box.match(/data-slot="date"/g) || []).length, 4,
      `${page.id}: the archive months are not anomaly slots`);
  }
  for (const entry of CH2.flavour.T07.month) {
    const m = entry.match(/^Tháng\s+(\d{1,2}),\s*(\d{4})$/);
    assert.ok(m, `"${entry}" is not shaped like an archive row`);
    const [, month, year] = m.map(Number);
    const impossible = month < 1 || month > 12 || year > 2026 || year < 1994;
    assert.ok(impossible, `"${entry}" is a month that could really be in this archive`);
  }
});

test('T07 knows every timestamp shape the chapters actually contain', () => {
  // A pool key with no matching shape on the page means T07 attaches to nothing and gets
  // dropped by reconcile — silently, with the evidence counter already advertised.
  const SHAPES = {
    time: /\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}:\d{2}/,
    date: /\d{1,2}\/\d{1,2}\/\d{4}/,
    month: /Tháng\s+\d{1,2},\s*\d{4}/
  };
  const MARKUP = { [CH1.id]: [PAGE_INDEX], [CH2.id]: CH2_PAGES, [CH3.id]: CH3_PAGES,
                   [CH4.id]: CH4_PAGES };
  for (const chapter of CHAPTERS) {
    const pool = chapter.flavour.T07;
    if (!pool) continue;
    const html = MARKUP[chapter.id].map((p) => p.html).join('');
    for (const key of Object.keys(pool)) {
      assert.ok(SHAPES[key], `${chapter.id} declares an unknown T07 pool "${key}"`);
      assert.match(html, SHAPES[key],
        `${chapter.id} has a T07 "${key}" pool but no ${key} anywhere in its markup`);
    }
  }
});

test('the memorial is clean content on both pages, never an anomaly slot', () => {
  /* T08 only means anything because the sidebar says Mây died in 2021. If the memorial were
     itself a slot, the director could rewrite the very line the anomaly is measured against. */
  for (const page of CH2_PAGES) {
    assert.match(page.html, /Tưởng nhớ Mây/, `${page.id} lost the memorial widget`);
    assert.match(page.html, /1994 – 2021/, `${page.id} lost the dates that make T08 legible`);
    const memo = page.html.slice(page.html.indexOf('side-box memo'), page.html.indexOf('Lưu trữ'));
    assert.ok(!memo.includes('data-slot'), `${page.id}: the memorial became an anomaly slot`);
  }
});

test('T08 has a name hook to rewrite in every byline and comment it can land on', () => {
  // T08 replaces [data-who] so that the NAME is what gets marked — the player circles the
  // thing they noticed. Without the hook it falls back to blanking the whole block.
  const post = CH2_POST.html;
  const bylines = [...post.matchAll(/<p class="byline"[^>]*>([\s\S]*?)<\/p>/g)];
  assert.strictEqual(bylines.length, 1);
  assert.match(bylines[0][1], /data-who/);
  const comments = [...post.matchAll(/data-slot="comment"[\s\S]*?<\/li>/g)];
  assert.strictEqual(comments.length, 9, 'chapter 2 declares nine comments');
  for (const [block] of comments) assert.match(block, /data-who/, 'a comment has no name hook');
});

test('every page that offers a comment form has a list to post into', () => {
  /* R01 appends to [data-comments] on ITS OWN page. A form without a list is a form the
     anomaly can be assigned to and then silently fail to attach to. */
  for (const page of CH2_PAGES) {
    if (!page.html.includes('data-slot="comment-form"')) continue;
    assert.match(page.html, /data-comments/, `${page.id} has a comment form but no list`);
    assert.strictEqual(typeof page.behaviour, 'function',
      `${page.id} has a comment form but never answers it`);
  }
});

test('a post with no comments still shows an ordinary empty state', () => {
  const empty = CH2_BY_ID['post-banh'];
  assert.ok(!empty.html.includes('data-slot="comment"'), 'post-banh is the no-comments post');
  assert.match(empty.html, /Chưa có bình luận nào/, 'the empty state has to look ordinary too');
  assert.match(empty.html, /data-slot="comment-form"/, 'you can still be the first to comment');
});

test('no comment text is repeated across chapter 2', () => {
  /* The same regulars turn up under several posts, which is what a small blog looks like —
     but the same SENTENCE under two posts reads as a duplication bug, and a player who spots
     it will circle it and lose a heart for noticing something real. */
  // Comment bodies only. The memorial and the footer are repeated on every page ON PURPOSE —
  // the memorial is what makes T08 legible from wherever the player happens to be reading.
  const seen = new Map();
  for (const page of CH2_PAGES) {
    for (const body of page.html.matchAll(/<div class="cmt-body">([\s\S]*?)<\/div>/g)) {
      for (const m of body[1].matchAll(/<p data-catch>([^<]{15,})<\/p>/g)) {
        const text = m[1].replace(/\s+/g, ' ').trim();
        assert.ok(!seen.has(text),
          `comment "${text.slice(0, 40)}…" appears on both ${seen.get(text)} and ${page.id}`);
        seen.set(text, page.id);
      }
    }
  }
  assert.ok(seen.size >= 12, `only ${seen.size} comments found — the scan missed them`);
});

test('every post card on the index opens a page that exists, and every page leads back', () => {
  /* Three of the four cards used to be dead links. A post card that does nothing when clicked
     is an anomaly nobody placed — and the worst kind: the player circles it, loses a heart,
     and the results screen tells them they were wrong. */
  const targets = [...new Set([...CH2_INDEX.html.matchAll(/data-goto="([^"]+)"/g)].map((m) => m[1]))];
  const cards = [...CH2_INDEX.html.matchAll(/data-slot="post-title"/g)].length;
  assert.strictEqual(targets.length, cards,
    `${cards} post cards but ${targets.length} distinct destinations: ${targets}`);
  for (const t of targets) {
    assert.ok(CH2_BY_ID[t], `index links to "${t}", which is not a page of this chapter`);
  }
  for (const page of CH2_PAGES) {
    if (page.id === 'index') continue;
    assert.match(page.html, /data-goto="index"/, `${page.id} has no way back to the index`);
  }
});

test('every page of chapter 2 can hold an anomaly from at least three families', () => {
  // The director needs >=3 families overall, and every page needs at least one anomaly. A page
  // whose slots only suit one family makes that impossible to satisfy on some seeds.
  for (const page of CH2.pages) {
    const fams = new Set(
      ANOMALIES.filter((a) => a.slots.some((sl) => (page.slots[sl] || 0) > 0)).map((a) => a.family)
    );
    assert.ok(fams.size >= 3,
      `page ${page.id} can only host ${[...fams].join(',') || 'nothing'}`);
  }
});

test('every image in chapter 2 is pinned and degrades', () => {
  for (const page of CH2_PAGES) {
    const imgs = [...page.html.matchAll(/<img[^>]*>/g)];
    assert.ok(imgs.length > 0, `${page.id} has no images`);
    for (const [tag] of imgs) assert.match(tag, /onerror=/, `image without a fallback: ${tag}`);
    for (const m of page.html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      assert.ok(isPinned(m[1]), `unpinned image src: ${m[1]}`);
    }
  }
});

test('chapter 2 site markup carries no script and no remote stylesheet', () => {
  for (const page of CH2_PAGES) {
    assert.ok(!/<script/i.test(page.html), `${page.id} carries a script`);
    assert.ok(!/<link[^>]+href="http/i.test(page.html), `${page.id} loads a remote stylesheet`);
  }
});

test('the post page answers an ordinary comment without a script tag', () => {
  assert.strictEqual(typeof CH2_POST.behaviour, 'function');
});

test('every anomaly the director can place in chapter 2 has a real slot on that page', () => {
  const present = Object.fromEntries(
    CH2.pages.map((p) => [p.id, slotCounts(CH2_MARKUP[p.id].html)])
  );
  for (const seed of SEEDS.slice(0, 200)) {
    for (const p of plan(CH2, seed).picks) {
      assert.ok((present[p.page]?.[p.slot] || 0) > p.nth,
        `seed ${seed}: ${p.id} wants ${p.page}/${p.slot}[${p.nth}]`);
    }
  }
});

test('the number placed stays inside the range the chapter declares', () => {
  /* The briefing tells the player "there are N things here", and N is what was PLACED. The
     per-page guarantee used to be a fix-up that ADDED anomalies after the roll, so a five-page
     chapter could quietly hand out nine when it advertised six to eight. Pages are covered
     first now, and the fill only tops up to the rolled count. */
  for (const chapter of CHAPTERS) {
    for (const seed of SEEDS) {
      const { picks } = plan(chapter, seed);
      assert.ok(picks.length >= chapter.min && picks.length <= chapter.max,
        `${chapter.id} seed ${seed}: placed ${picks.length}, declared ${chapter.min}..${chapter.max}`);
    }
  }
});

test('every page of chapter 2 is dirty on every seed', () => {
  // A player who clears a page that was never dirty learns the wrong lesson about looking.
  for (const seed of SEEDS) {
    const picks = plan(CH2, seed).picks;
    for (const page of CH2.pages) {
      assert.ok(picks.some((p) => p.page === page.id),
        `seed ${seed} left chapter 2 page "${page.id}" clean`);
    }
  }
});

test('every anomaly eligible for a chapter has a flavour pool there', () => {
  for (const chapter of CHAPTERS) {
    for (const a of ANOMALIES) {
      const eligible = chapter.pages.some((p) => a.slots.some((s) => (p.slots[s] || 0) > 0));
      if (!eligible || chapter.exclude.includes(a.id)) continue;
      assert.ok(chapter.flavour[a.id],
        `${a.id} can be placed in ${chapter.id} but has no flavour pool there`);
    }
  }
});

test('chapter 2 unlocks only after chapter 1 is cleared', () => {
  const nothing = () => false;
  const ch1done = (id) => id === CH1.id;
  assert.strictEqual(unlockedUpTo(nothing), 1, 'chapter 1 alone is open on a fresh save');
  assert.strictEqual(isUnlocked(CH2.id, nothing), false);
  assert.strictEqual(isUnlocked(CH1.id, nothing), true, 'chapter 1 is never locked');
  assert.strictEqual(unlockedUpTo(ch1done), 2);
  assert.strictEqual(isUnlocked(CH2.id, ch1done), true);
});

test('the ?unlock=1 debug flag reads location lazily, never at import', () => {
  // A top-level `location` reference would break every test in this file, which runs with no
  // DOM at all. Under Node there is no location, so the flag must simply be off.
  assert.strictEqual(unlockAllRequested(), false);
});

/* ── Chapter 3: the marketplace, and the cart that spans two pages ──────── */

import { boDau, decay } from '../games/tham-tu-mang/js/anomalies/text.js';

test('all three SănĐồCũ pages ship exactly the slots they declare', () => {
  for (const page of CH3.pages) {
    assert.deepStrictEqual(slotCounts(CH3_BY_ID[page.id].html), page.slots,
      `chapter 3 page "${page.id}" markup does not match its declaration`);
  }
});

test('every good on the listing opens its own page, and every page leads back', () => {
  /* Twelve goods, twelve destinations. A card that does nothing when clicked is an anomaly
     nobody placed — the player circles it, loses a heart, and the results screen says they
     were wrong. Separate pages rather than one page that swaps content: an anomaly attaches
     to a real element at run start, so rewriting that element under it would either destroy
     it or strand it on the wrong item. */
  const targets = [...CH3_BY_ID.listing.html.matchAll(/data-goto="([^"]+)"/g)].map((m) => m[1]);
  const goodsLinks = targets.filter((t) => t !== 'listing' && t !== 'cart');
  assert.strictEqual(new Set(goodsLinks).size, GOODS.length,
    `${GOODS.length} goods but ${new Set(goodsLinks).size} destinations`);
  for (const t of new Set(goodsLinks)) {
    assert.ok(CH3_BY_ID[t], `listing links to "${t}", which is not a page of this chapter`);
  }
  assert.match(CH3_BY_ID.listing.html, /data-goto="cart"/, 'no way to the cart');
  for (const page of CH3_PAGES) {
    if (page.id === 'listing') continue;
    assert.match(page.html, /data-goto="listing"/, `${page.id} has no way back`);
  }
});

test('no text-rewriting slot ever wraps a navigation link', () => {
  /* A whole class of silent breakage. T01, T02, T03, T06, S01 and S05 all assign to their
     slot's textContent — so if the slot WRAPS the card's <a data-goto>, the link element is
     destroyed and that item becomes unreachable. T06 did exactly this to three cards of the
     chapter 3 grid: it rotted their titles and took the links with them.

     The fix is structural: the slot goes ON the link, never around it. Rewriting the link's
     own text leaves the element, its href and its data-goto intact. */
  const REWRITERS = new Set(['paragraph', 'notice', 'post-title', 'product-title', 'price',
                             'tile', 'gallery-caption', 'avatar', 'photo', 'hero-title']);
  const ALL = [[CH1.id, [PAGE_INDEX]], [CH2.id, CH2_PAGES], [CH3.id, CH3_PAGES],
               [CH4.id, CH4_PAGES]];
  for (const [chapterId, pages] of ALL) {
    for (const page of pages) {
      // Crude but sufficient: an opening tag that declares a rewriting slot, followed by a
      // data-goto before that element could plausibly have closed.
      for (const m of page.html.matchAll(/<(\w+)([^>]*\bdata-slot="([^"]+)"[^>]*)>/g)) {
        if (!REWRITERS.has(m[3])) continue;
        const tag = m[1];
        const rest = page.html.slice(m.index + m[0].length);
        const close = rest.indexOf(`</${tag}>`);
        const inner = close === -1 ? rest.slice(0, 400) : rest.slice(0, close);
        assert.ok(!/data-goto=/.test(inner),
          `${chapterId}/${page.id}: a "${m[3]}" slot wraps a data-goto link — ` +
          'rewriting its text would delete the link');
      }
    }
  }
});

test('every good page can put its own item in the cart', () => {
  for (const g of GOODS) {
    const page = CH3_BY_ID[g.key];
    assert.ok(page, `no page for ${g.key}`);
    assert.match(page.html, /data-add-to-cart/, `${g.key} cannot be bought`);
    assert.strictEqual(typeof page.behaviour, 'function', `${g.key} never answers its button`);
  }
});

test('the listing carries a working search and filter, over static cards', () => {
  /* Both only hide and show cards — never rewrite them, which would wipe an anomaly sitting
     on one. A hidden card stops being a target (targets() checks checkVisibility), so
     filtering and unfiltering is safe: the anomaly comes back exactly where it was. */
  const html = CH3_BY_ID.listing.html;
  assert.match(html, /data-find/, 'no search form');
  assert.match(html, /data-cat-filter/, 'no category filter');
  assert.match(html, /data-price-filter/, 'no price filter');
  assert.match(html, /data-reset/, 'no way to clear the filters');
  for (const g of GOODS) {
    assert.ok(html.includes(`data-title="${g.title.toLowerCase()}"`),
      `${g.key} has no searchable title on its card`);
    assert.ok(html.includes(`data-cat="${g.cat}"`), `${g.key} has no category on its card`);
  }
  for (const c of CATEGORIES) {
    assert.ok(html.includes(`value="${c}"`), `category "${c}" has no filter checkbox`);
  }
});

test('R02 has a trigger on one page and a cart to grow on another', () => {
  /* The first anomaly that spans pages: the button is on the product page, the evidence is a
     line on the cart. Either half missing means it attaches to nothing and reconcile drops it
     after the evidence counter has already promised it. */
  assert.match(CH3_BY_ID['may-anh'].html, /data-add-to-cart/, 'no add-to-cart button');
  assert.match(CH3_BY_ID.cart.html, /data-cart\b/, 'no cart list to append to');
  assert.match(CH3_BY_ID.cart.html, /data-slot="cart-line"/, 'no line for R02 to clone');
  for (const hook of ['data-line-title', 'data-line-price', 'data-line-note']) {
    assert.match(CH3_BY_ID.cart.html, new RegExp(hook), `cart line has no ${hook} to rewrite`);
  }
  assert.match(CH3_BY_ID.cart.html, /data-ship-address/, 'nothing for R02 to prefill');
});

test('the closed-account notice is clean content, never an anomaly slot', () => {
  /* T08's anchor, exactly like chapter 2's memorial: a question signed "Hạnh · vừa xong" is
     only wrong because another page says her account closed in 2024. If the director could
     rewrite that line it would be moving the ruler. */
  const cart = CH3_BY_ID.cart.html;
  const notice = cart.slice(cart.indexOf('class="gone"'), cart.indexOf('class="total"'));
  assert.match(notice, /Hạnh/);
  assert.match(notice, /02\/2024/);
  assert.ok(!notice.includes('data-slot'), 'the closed-account notice became a slot');
  for (const entry of CH3.flavour.T08) {
    assert.strictEqual(entry.name, 'Hạnh', 'T08 must name the person the notice says is gone');
  }
});

test('every Q&A row gives T08 a name to rewrite', () => {
  const rows = [...CH3_BY_ID['may-anh'].html.matchAll(/data-slot="comment"[\s\S]*?<\/li>/g)];
  assert.ok(rows.length >= 2, 'the rich good page carries the comment slots');
  for (const [block] of rows) assert.match(block, /data-who/, 'a Q&A row has no name hook');
});

test('every image in chapter 3 is pinned and degrades, and no two goods share a photo', () => {
  const srcs = [];
  for (const page of CH3_PAGES) {
    for (const [tag] of page.html.matchAll(/<img[^>]*>/g)) assert.match(tag, /onerror=/);
    for (const m of page.html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      assert.ok(isPinned(m[1]), `unpinned image src: ${m[1]}`);
    }
  }
  // Twelve different sellers photographing twelve different things is the camouflage (§5.3).
  for (const m of CH3_BY_ID.listing.html.matchAll(/picsum\.photos\/id\/(\d+)\//g)) srcs.push(m[1]);
  assert.strictEqual(srcs.length, 12, 'the listing grid is twelve goods');
  assert.strictEqual(new Set(srcs).size, 12, `two goods share a photograph: ${srcs}`);
});

test('chapter 3 site markup carries no script and no remote stylesheet', () => {
  for (const page of CH3_PAGES) {
    assert.ok(!/<script/i.test(page.html), `${page.id} carries a script`);
    assert.ok(!/<link[^>]+href="http/i.test(page.html), `${page.id} loads a remote stylesheet`);
  }
});

test('every anomaly the director can place in chapter 3 has a real slot on that page', () => {
  const present = Object.fromEntries(
    CH3.pages.map((p) => [p.id, slotCounts(CH3_BY_ID[p.id].html)])
  );
  for (const seed of SEEDS.slice(0, 200)) {
    for (const p of plan(CH3, seed).picks) {
      assert.ok((present[p.page]?.[p.slot] || 0) > p.nth,
        `seed ${seed}: ${p.id} wants ${p.page}/${p.slot}[${p.nth}]`);
    }
  }
});

test('every page the player cannot avoid is dirty on every seed', () => {
  /* Pages may opt out with `optional: true` — chapter 3's twelve goods do, because 6–8
     anomalies cannot cover fourteen pages and a marketplace where every listing is wrong
     stops being a marketplace. The rule still holds where it matters: the pages you are
     guaranteed to pass through are never completely clean. */
  for (const chapter of CHAPTERS) {
    for (const seed of SEEDS) {
      const picks = plan(chapter, seed).picks;
      for (const page of chapter.pages.filter((p) => !p.optional)) {
        assert.ok(picks.some((p) => p.page === page.id),
          `${chapter.id} seed ${seed} left page "${page.id}" clean`);
      }
    }
  }
});

test('optional pages are still real anomaly surfaces, not decoration', () => {
  // If nothing ever landed on the twelve goods, browsing them would be pure busywork.
  const optional = new Set(CH3.pages.filter((p) => p.optional).map((p) => p.id));
  const hit = new Set();
  for (const seed of SEEDS) {
    for (const p of plan(CH3, seed).picks) if (optional.has(p.page)) hit.add(p.page);
  }
  assert.strictEqual(hit.size, optional.size,
    `only ${hit.size}/${optional.size} good pages ever receive an anomaly`);
});

test('T06 strips Vietnamese one layer at a time, and never touches the first item', () => {
  /* The first item in the window is the ruler. If every item were wrong there would be
     nothing to show that they are rotting rather than simply being misspelled. */
  const src = 'Thông báo nghỉ lễ';
  assert.strictEqual(decay(src, 0), src, 'level 0 is the untouched ruler');

  // Level 1 is the only unambiguous one: fold to ASCII, keep every letter.
  assert.strictEqual(boDau(src), 'Thong bao nghi le');
  assert.strictEqual(decay(src, 1), 'Thong bao nghi le', 'tones and hats go first');
  assert.strictEqual(boDau('Đèn bàn kim loại'), 'Den ban kim loai', 'đ folds to d');

  /* Levels 2 and 3 are asserted as PROPERTIES, not as transcriptions. Spec §6 T06 sketches
     "Thong bao nghi le" -> "thng bo ngh l" -> "t b n l", but that sketch keeps the o in "bao"
     while dropping the o in "thong" — it is illustrative, not an algorithm. Dropping every
     vowel is the rule that is actually consistent, and what matters for the anomaly is that
     each level is strictly less readable than the one before it. */
  const levels = [0, 1, 2, 3].map((n) => decay(src, n));
  for (let i = 1; i < levels.length; i++) {
    // Level 1 only folds, so it is the same length; 2 and 3 actually take letters away.
    const shrinks = i === 1 ? levels[i].length === levels[i - 1].length
                            : levels[i].length < levels[i - 1].length;
    assert.ok(shrinks,
      `level ${i} ("${levels[i]}") did not decay from level ${i - 1} ("${levels[i - 1]}")`);
    assert.ok(!/[\u0300-\u036f]/.test(levels[i].normalize('NFD')),
      `level ${i} still carries diacritics`);
  }
  assert.ok(!/[aeiou]/i.test(levels[2]), 'level 2 should have no vowels left');
  assert.strictEqual(levels[3].split(' ').length, src.split(' ').length,
    'level 3 keeps one letter per word, so the shape of the line survives');
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

test('only the two-stage reactive anomalies are marked deferred', () => {
  const deferred = ANOMALIES.filter((a) => a.deferred).map((a) => a.id);
  assert.deepStrictEqual(deferred, ['R01', 'R02', 'R04', 'R05', 'R06'],
    'only two-stage reactive anomalies may be absent from the DOM after apply()');
  for (const id of deferred) assert.strictEqual(byId(id).family, 'REACTIVE');
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

test('the withdrawn S04 is gone from the registry, not merely unused', () => {
  // Withdrawn after playtest: a shadow falling the other way reads as a styling choice,
  // never as a symptom. Leaving it registered would let the director keep placing it.
  assert.strictEqual(byId('S04'), null);
  assert.ok(!('S04' in CH1.flavour), 'chapter 1 still carries a dead S04 flavour pool');
});

test('T07 only ever corrupts the closing time, never the opening one', () => {
  // A line wrong at both ends reads as junk data; one that starts right and then goes wrong
  // reads as a shop that really does close then.
  for (const entry of CH1.flavour.T07.time) {
    assert.strictEqual(typeof entry, 'string');
    // Impossible either because it is not a clock reading at all (09:-30, 08^2:00, 19:∞),
    // or because it is shaped like one and still cannot happen (26:79, 24:60).
    const m = entry.match(/^(\d{1,2}):(\d{2})$/);
    const impossible = !m || Number(m[1]) > 23 || Number(m[2]) > 59;
    assert.ok(impossible,
      `T07 entry "${entry}" is a perfectly ordinary time — it has to be impossible`);
  }
});

test('R06 sends the browser somewhere the player never typed', () => {
  for (const entry of CH1.flavour.R06) {
    assert.ok(entry.q && entry.label, 'R06 needs a query and a replacement label');
  }
});

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

/* ── Chapter 4: Hồ Vắng, and the four anomalies it introduces ───────────── */

import { T09 } from '../games/tham-tu-mang/js/anomalies/text.js';
import { M06 } from '../games/tham-tu-mang/js/anomalies/motion.js';
import { E03 } from '../games/tham-tu-mang/js/anomalies/element.js';
import { I01, I02, I04 } from '../games/tham-tu-mang/js/anomalies/image.js';
import { R04 } from '../games/tham-tu-mang/js/anomalies/reactive.js';

test('the Hồ Vắng page ships exactly the slots it declares', () => {
  assert.deepStrictEqual(slotCounts(CH4_INDEX.html), CH4.pages[0].slots,
    'chapter 4 markup does not match its declaration');
});

test('chapter 4 rolls 7 to 9 and places every one of them', () => {
  for (const seed of SEEDS) {
    const { count, picks } = plan(CH4, seed);
    assert.ok(count >= 7 && count <= 9, `seed ${seed} rolled ${count}`);
    assert.strictEqual(picks.length, count, `seed ${seed} promised ${count}, placed ${picks.length}`);
  }
});

test('chapter 4 keeps the director within its own rules on every seed', () => {
  for (const seed of SEEDS) {
    const picks = plan(CH4, seed).picks;
    const keys = picks.map((p) => `${p.page}:${p.slot}:${p.nth}`);
    assert.strictEqual(new Set(keys).size, keys.length, `seed ${seed} stacked two on one element`);
    const counts = {};
    for (const p of picks) counts[p.family] = (counts[p.family] || 0) + 1;
    for (const [family, n] of Object.entries(counts)) {
      assert.ok(n <= 2, `seed ${seed} took ${n} from ${family}`);
    }
    assert.ok(new Set(picks.map((p) => p.family)).size >= 3, `seed ${seed} used too few families`);
    for (const p of picks) {
      assert.ok((CH4.pages[0].slots[p.slot] || 0) > p.nth,
        `seed ${seed}: ${p.id} wants ${p.slot}[${p.nth}]`);
      assert.ok(byId(p.id).slots.includes(p.slot), `${p.id} does not accept ${p.slot}`);
    }
  }
});

test('the lễ tân notice is clean content, never an anomaly slot', () => {
  /* T08 measures a signature against the name in this box, exactly the way chapter 2's
     memorial works. If the box could itself be rewritten the director would be moving the
     ruler. On seeds without T08 it is only a sad piece of reception housekeeping — the site
     has to be able to be sad without being wrong. */
  const html = CH4_INDEX.html;
  const box = html.slice(html.indexOf('class="lost"'), html.indexOf('</aside>'));
  assert.ok(box.length > 100, 'the lost-property notice is gone');
  assert.ok(!box.includes('data-slot'), 'the lễ tân notice became an anomaly slot');
  for (const entry of CH4.flavour.T08) {
    assert.ok(box.includes(entry.name),
      `T08 signs "${entry.name}", a name the notice never mentions`);
  }
});

test('T09 starts from the coordinate actually printed on the page and ends somewhere impossible', () => {
  /* Step 0 has to match the markup exactly: the first read must give the player nothing to
     be suspicious about, or the drift afterwards is not a drift, it is just a wrong number. */
  const printed = CH4_INDEX.html.match(/data-coords>([^<]+)</)[1];
  for (const entry of CH4.flavour.T09) {
    assert.ok(Array.isArray(entry.steps) && entry.steps.length >= 3,
      'T09 needs a sequence to walk, not a single value');
    assert.strictEqual(entry.steps[0], printed,
      `T09 opens on "${entry.steps[0]}" but the page prints "${printed}"`);
    /* Bước cuối phải là một chỗ KHÔNG CÓ trên Trái Đất: hoặc vĩ độ vượt 90°, hoặc kinh độ
       vượt 180°, hoặc cụm đó thôi không còn đọc ra là một cặp toạ độ nữa. */
    const last = entry.steps[entry.steps.length - 1];
    const m = last.match(/^(\d+)°(\d+)′(\d+)″[BN]\s*·\s*(\d+)°(\d+)′(\d+)″[ĐTEW]$/);
    const offEarth = !m || Number(m[1]) > 90 || Number(m[4]) > 180;
    assert.ok(offEarth, `T09 ends at "${last}", which is a real place on this planet`);
    assert.notStrictEqual(last, printed, 'T09 ends where it started');
  }
});

test('T09 has a coordinate hook inside the only map on the page', () => {
  const html = CH4_INDEX.html;
  const map = html.slice(html.indexOf('data-slot="map"'), html.indexOf('</div>', html.indexOf('map-facts')));
  assert.match(map, /data-coords/, 'the map slot has no [data-coords] for T09 to rewrite');
  assert.strictEqual(T09.slots.join(), 'map');
});

test('R04 has every hook it needs, and the honest booking answer names the guest count', () => {
  const html = CH4_INDEX.html;
  assert.match(html, /data-guests/, 'no guest field for R04 to read');
  assert.match(html, /max="6"/, 'the guest field has no ceiling, so the honest widget cannot clamp');
  assert.strictEqual(R04.deferred, true, 'R04 is two-stage and must be exempt from reconcile()');

  /* R04 never writes its own sentence — it lets the site answer and then changes one number
     inside it, so the wording is the site's own and the two branches cannot be told apart by
     eye. Both hooks are created by behaviour() at submit time, so they are asserted there. */
  const behaviour = String(CH4_INDEX.behaviour);
  assert.match(behaviour, /data-booking-answer/, 'the answer line carries no hook for R04');
  assert.match(behaviour, /data-guest-count/, 'the guest number is not isolated for R04 to rewrite');
  assert.match(behaviour, /xác nhận đặt phòng cho/, 'the honest answer no longer names the guest count');

  /* And the honest branch must stand down on a flag, not on "is there any [data-anom] in this
     box" — E02 also lands on booking-form, and its extra field carries data-anom, so the old
     test made the form go silent on runs that had E02 and nothing else. A form that swallows
     the player's click and says nothing is an anomaly nobody placed. */
  assert.match(behaviour, /form\.dataset\.handled/,
    'the clean branch stands down on the wrong signal; E02 would silence the form');

  for (const entry of CH4.flavour.R04) {
    assert.ok(Number.isInteger(entry.gap) && entry.gap >= 1 && entry.gap <= 5,
      `R04 gap ${entry.gap} is outside the +1..+5 the chapter advertises`);
  }
  assert.deepStrictEqual(CH4.flavour.R04.map((e) => e.gap), [1, 2, 3, 4, 5],
    'R04 should offer the whole +1..+5 range');
});

test('E03 can only land on a nav that has a link for it to copy', () => {
  /* It clones an existing link so it matches its neighbours exactly. A nav with no <a> would
     leave it marking nothing — placed, counted in BẰNG CHỨNG, and invisible. */
  const MARKUP = { [CH1.id]: [PAGE_INDEX], [CH3.id]: CH3_PAGES, [CH4.id]: CH4_PAGES };
  for (const chapter of CHAPTERS) {
    if (!chapter.pages.some((p) => p.slots.nav)) continue;
    assert.ok(chapter.flavour.E03, `${chapter.id} offers a nav but has no E03 pool`);
    for (const entry of chapter.flavour.E03) {
      assert.ok(entry.label && entry.miss, 'E03 needs a label and a first-person 404');
    }
    for (const page of MARKUP[chapter.id]) {
      if (!/data-slot="nav"/.test(page.html)) continue;
      const nav = page.html.slice(page.html.indexOf('data-slot="nav"'), page.html.indexOf('</nav>'));
      assert.ok((nav.match(/<a /g) || []).length >= 2,
        `${chapter.id}/${page.id}: the nav has nothing for E03 to clone`);
    }
  }
});

test('every I02 replacement is a pinned photograph', () => {
  // An unpinned swap returns a different picture each load, so the anomaly stops being a
  // photograph that changed and becomes a photograph that is simply unstable.
  for (const chapter of CHAPTERS) {
    for (const entry of chapter.flavour.I02 ?? []) {
      assert.ok(isPinned(entry.src), `${chapter.id}: I02 swap "${entry.src}" is not pinned`);
    }
  }
});

test('M06 flies inside the frame and takes its time doing it', () => {
  for (const chapter of CHAPTERS) {
    for (const entry of chapter.flavour.M06 ?? []) {
      for (const p of [entry.from, entry.to]) {
        assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1,
          `${chapter.id}: M06 path leaves the photograph`);
      }
      // Fast enough to be seen head-on, slow enough that a glance cannot be sure — the whole
      // MOTION family lives at that threshold.
      assert.ok(entry.seconds >= 15 && entry.seconds <= 45,
        `${chapter.id}: M06 crosses in ${entry.seconds}s`);
    }
  }
});

test('every slot M06, I01, I02 and I04 can take sits in a figure with an image', () => {
  /* All four reach the photograph with ctx.slot.closest('figure'). A caption slot outside a
     figure, or a figure with no <img>, means the anomaly attaches to nothing — and it would
     be counted in BẰNG CHỨNG before anyone noticed. */
  const IMAGE_SLOTS = new Set([...I01.slots, ...I02.slots, ...I04.slots, ...M06.slots]
    .filter((s) => s !== 'avatar'));
  const ALL = [[CH1.id, [PAGE_INDEX]], [CH2.id, CH2_PAGES], [CH3.id, CH3_PAGES], [CH4.id, CH4_PAGES]];
  for (const [chapterId, pages] of ALL) {
    for (const page of pages) {
      for (const m of page.html.matchAll(/<figcaption[^>]*data-slot="([^"]+)"/g)) {
        if (!IMAGE_SLOTS.has(m[1])) continue;
        const before = page.html.slice(0, m.index);
        const open = before.lastIndexOf('<figure');
        const close = before.lastIndexOf('</figure>');
        assert.ok(open > close, `${chapterId}/${page.id}: a ${m[1]} caption sits outside any figure`);
        assert.match(page.html.slice(open, m.index), /<img/,
          `${chapterId}/${page.id}: the figure around a ${m[1]} has no image`);
      }
    }
  }
});

test('no two photographs on the Hồ Vắng page are the same shot', () => {
  // Seven pinned images, and I01/I02 both depend on the player being able to tell one frame
  // from another. A repeat would read as an anomaly nobody placed.
  const ids = [...CH4_INDEX.html.matchAll(/picsum\.photos\/id\/(\d+)\//g)].map((m) => m[1]);
  assert.ok(ids.length >= 7, `only ${ids.length} photographs on the page`);
  assert.strictEqual(new Set(ids).size, ids.length, 'a photograph is used twice');
});

test('chapter 4 site markup carries no script and no remote stylesheet', () => {
  assert.ok(!/<script/i.test(CH4_INDEX.html), 'the page carries a script');
  assert.ok(!/<link[^>]+href="http/i.test(CH4_INDEX.html), 'the page loads a remote stylesheet');
});

test('chapter 4 unlocks only after chapter 3 is cleared', () => {
  const upToCh2 = (id) => id === CH1.id || id === CH2.id;
  assert.strictEqual(isUnlocked(CH4.id, upToCh2), false);
  assert.strictEqual(isUnlocked(CH4.id, (id) => id !== CH4.id), true);
});
