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
globalThis.document = {
  getElementById: id => { if (!elements.has(id)) elements.set(id, stubElement()); return elements.get(id); },
  createElement: () => stubElement(),
  querySelectorAll: () => [],
  addEventListener() {},
  body: stubElement(),
};

const { createHud } = await import('../games/jungle-game-remake/js/hud.js');

test('createHud returns its whole API, and each call works on a stub DOM', () => {
  const hud = createHud({ onRestart() {}, onSoundToggle() {} });
  for (const name of ['setTurn', 'setCounts', 'toast', 'setPortraits', 'setCurrent', 'showWin', 'hideWin', 'setSound']) {
    assert.equal(typeof hud[name], 'function', `${name} missing`);
  }
  hud.setPortraits({ 'lion:red': 'data:,' });
  hud.setTurn('blue');
  hud.setCounts([{ player: 'red' }, { player: 'blue' }, { player: 'blue' }]);
  assert.equal(elements.get('redCount').textContent, '1 quân');
  assert.equal(elements.get('blueCount').textContent, '2 quân');
  hud.setCurrent('red', { type: 'lion', player: 'red' });
  hud.setCurrent('blue', null);
  hud.setSound(true);
  assert.equal(elements.get('soundBtn').textContent, '🔇');
  hud.showWin('red', 'reason');
  hud.hideWin();
});
