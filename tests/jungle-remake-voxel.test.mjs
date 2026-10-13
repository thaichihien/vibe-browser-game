/* Cờ Thú remake — the THREE-free building blocks: voxel mesher, palette, layout maths. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid, hash3 } from '../games/jungle-game-remake/js/voxel.js';
import { C, TEAM, paletteRGBA, hexCss } from '../games/jungle-game-remake/js/palette.js';
import {
  pickScale, lowRes, cellToWorld, worldToCell, resolvePick,
} from '../games/jungle-game-remake/js/layout.js';

const faces = m => m.indices.length / 6;

test('a lone voxel meshes to 6 faces', () => {
  const m = new VoxelGrid().set(0, 0, 0, 0xffffff).mesh();
  assert.equal(faces(m), 6);
  assert.equal(m.positions.length, 6 * 4 * 3);
  assert.equal(m.colors.length, m.positions.length);
  assert.equal(m.sway.length, 24);
});

test('shared faces are culled', () => {
  const two = new VoxelGrid().set(0, 0, 0, 1).set(1, 0, 0, 1).mesh();
  assert.equal(faces(two), 10);
  const cube = new VoxelGrid().box(0, 0, 0, 2, 2, 2, 0x808080);
  assert.equal(cube.size, 27);
  assert.equal(faces(cube.mesh()), 54);
});

test('box colour functions can leave cells empty', () => {
  const g = new VoxelGrid().box(0, 0, 0, 3, 0, 0, x => (x % 2 ? 0xff0000 : null));
  assert.equal(g.size, 2);
  assert.ok(g.has(1, 0, 0) && !g.has(0, 0, 0));
});

test('ellipsoid is symmetric and bounded', () => {
  const g = new VoxelGrid().ellipsoid(0, 0, 0, 2, 2, 2, 1);
  assert.ok(g.has(2, 0, 0) && g.has(-2, 0, 0) && g.has(0, 2, 0) && g.has(0, 0, -2));
  assert.ok(!g.has(2, 2, 0));
});

test('mirrorX reflects around the centre line and merge combines grids', () => {
  const left = new VoxelGrid().set(-3, 1, 2, 5);
  const right = left.mirrorX();
  assert.equal(right.get(2, 1, 2), 5);
  const both = new VoxelGrid().merge(left).merge(right);
  assert.equal(both.size, 2);
});

test('ambient occlusion darkens a crease corner, not an open one', () => {
  // floor voxel with a voxel sitting diagonally above its +x edge
  const m = new VoxelGrid().set(0, 0, 0, 0xffffff).set(1, 1, 0, 0xffffff).mesh({ jitter: 0 });
  const top = [];
  for (let v = 0; v < m.positions.length / 3; v++) {
    const [x, y] = [m.positions[v * 3], m.positions[v * 3 + 1]];
    if (m.normals[v * 3 + 1] === 1 && y === 1 && x <= 1) top.push({ x, r: m.colors[v * 3] });
  }
  assert.equal(top.length, 4);
  assert.ok(top.filter(t => t.x === 1).every(t => t.r < 1), 'crease side is darkened');
  assert.ok(top.filter(t => t.x === 0).every(t => t.r === 1), 'open side stays bright');
});

test('sway runs 0 at the bottom of the grid to 1 at the top', () => {
  const m = new VoxelGrid().box(0, 0, 0, 0, 3, 0, 1).mesh();
  assert.equal(Math.min(...m.sway), 0);
  assert.equal(Math.max(...m.sway), 1);
});

test('hash3 is deterministic and in [0,1)', () => {
  assert.equal(hash3(1, 2, 3, 4), hash3(1, 2, 3, 4));
  assert.notEqual(hash3(1, 2, 3), hash3(3, 2, 1));
  for (let i = 0; i < 200; i++) {
    const h = hash3(i, i * 7, -i, 3);
    assert.ok(h >= 0 && h < 1);
  }
});

test('palette: every key is in the shader palette, shades included, within 256', () => {
  const { data, count } = paletteRGBA();
  assert.ok(count > Object.keys(C).length && count <= 256, `count ${count}`);
  const has = hex => {
    for (let i = 0; i < count; i++) {
      if (data[i * 4] === (hex >> 16 & 255) && data[i * 4 + 1] === (hex >> 8 & 255) && data[i * 4 + 2] === (hex & 255)) return true;
    }
    return false;
  };
  for (const [name, hex] of Object.entries(C)) assert.ok(has(hex), `missing ${name}`);
  assert.equal(TEAM.red.main, C.red);
  assert.equal(hexCss(0x0a0b0c), '#0a0b0c');
});

test('pickScale floors at 2, caps at 4, and stays chunky on desktop', () => {
  assert.equal(pickScale(375, 600), 2);
  assert.equal(pickScale(1280, 720), 2);
  assert.equal(pickScale(1920, 1000), 3);
  assert.equal(pickScale(3840, 2000), 4);
  assert.deepEqual(lowRes(1920, 1000, 3), { w: 640, h: 333 });
  assert.deepEqual(lowRes(1, 1, 3), { w: 1, h: 1 });
});

test('cell ↔ world round-trips for every square, tolerating clicks off-centre', () => {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 7; c++) {
    const { x, z } = cellToWorld(r, c);
    assert.deepEqual(worldToCell(x + 0.45, z - 0.45), { row: r, col: c });
  }
  assert.deepEqual(cellToWorld(4, 3), { x: 0, z: 0 });
});

test('resolvePick prefers the river square the water-level ray lands on', () => {
  const land = { row: 6, col: 1 }, water = { row: 5, col: 1 };
  assert.deepEqual(resolvePick(land, water, true), water);
  assert.deepEqual(resolvePick(land, { row: 6, col: 0 }, false), land);
  assert.deepEqual(resolvePick(null, water, true), water);
  assert.equal(resolvePick(null, null, false), null);
});

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

// `node --check file.js` exits 0 even on a syntax error when the file has no package.json type
// (Node 22's module-syntax detection), so the source goes through stdin as an explicit module.
test('every remake module parses', () => {
  const dir = new URL('../games/jungle-game-remake/js/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 6, `only ${files.length} modules found`);
  for (const f of files) {
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ['--input-type=module', '--check'],
        { input: readFileSync(new URL(f, dir)), stdio: ['pipe', 'pipe', 'pipe'] }),
      `${f} does not parse`);
  }
});
