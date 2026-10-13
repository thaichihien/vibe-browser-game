/* Cờ Thú remake — the HUD module builds against a stub DOM. createHud runs at boot, so a
   function it references but no longer defines (a ReferenceError) blanks the whole game; this
   catches that in Node instead of in the browser console. */
import test from 'node:test';
import assert from 'node:assert/strict';

function stubElement() {
  return {
    textContent: '', innerHTML: '', className: '', title: '', style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, setAttribute() {}, append() {}, appendChild() {}, remove() {},
  };
}
const elements = new Map();
const created = [];
globalThis.document = {
  getElementById: id => { if (!elements.has(id)) elements.set(id, stubElement()); return elements.get(id); },
  createElement: () => { const el = stubElement(); created.push(el); return el; },
  querySelectorAll: () => [],
  addEventListener() {},
  body: stubElement(),
};

const { createHud } = await import('../games/jungle-game-remake/js/hud.js');

test('createHud returns its whole API, and each call works on a stub DOM', () => {
  const hud = createHud({ onRestart() {}, onPlayAgain() {}, onSoundToggle() {}, onMusicVolume() {}, onSfxVolume() {}, onModeButton() {}, onStart() {} });
  for (const name of ['setTurn', 'setCounts', 'toast', 'setCurrent', 'showWin', 'hideWin', 'setSound', 'setVolumes', 'setMode', 'showStart', 'hideStart']) {
    assert.equal(typeof hud[name], 'function', `${name} missing`);
  }
  hud.setTurn('blue');
  hud.setCounts([{ player: 'red' }, { player: 'blue' }, { player: 'blue' }]);
  assert.equal(elements.get('redCount').textContent, '1 quân');
  assert.equal(elements.get('blueCount').textContent, '2 quân');
  created.length = 0;
  hud.setCurrent('red', { type: 'lion', player: 'red' });
  assert.ok(created.some(el => el.textContent === '🦁'), 'selected animal shows its emoji face');
  hud.setCurrent('blue', null);
  hud.setSound(true);
  assert.equal(elements.get('muteBtn').textContent, '🔊 Bật tiếng');
  hud.setVolumes(0.35, 1);
  assert.equal(elements.get('musicVol').value, '35');
  assert.equal(elements.get('musicVolVal').textContent, '35%');
  assert.equal(elements.get('sfxVolVal').textContent, '100%');
  assert.equal(elements.get('soundBtn').textContent, '🔇');
  hud.showWin('red', 'reason');
  hud.hideWin();
  hud.setMode('hard', 'red');
  assert.equal(elements.get('modeBtn').textContent, '🤖');
  assert.equal(elements.get('redCrest').textContent, '🤖');
  assert.equal(elements.get('blueCrest').textContent, '🐾');
  hud.setTurn('red');
  assert.ok(created.some(el => el.textContent === 'Máy đang nghĩ…'), 'the AI side says it is thinking on its turn');
  hud.showWin('red', 'reason');
  assert.equal(elements.get('overTitle').textContent, '🤖 Máy thắng rồi!');
  hud.showWin('blue', 'reason');
  assert.equal(elements.get('overTitle').textContent, '🏆 Bạn đã thắng máy!');
  hud.showStart('hard', false);
  assert.equal(elements.get('startClose').hidden, true, 'the boot start screen cannot be dismissed');
  hud.showStart('hard', true);
  assert.equal(elements.get('startClose').hidden, false);
  hud.hideStart();
  hud.setMode('pvp', 'red');
  assert.equal(elements.get('modeBtn').textContent, '👥');
  assert.equal(elements.get('redCrest').textContent, '🐾');
});
