/* Two keysets on one keyboard → one intent object per player per frame.
 *
 * Directions are tracked as an ordered list of held keys rather than four
 * booleans, because §2.1 requires that a diagonal combo resolves to the most
 * recently pressed axis. With a list that rule is "the newest key still down
 * wins", which is one line and has no ambiguous cases. Each press carries a
 * global sequence number so "newest" is still answerable when a solo player is
 * driving both keysets at once.
 */

export const KEYS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    place: 'Space', act0: 'KeyQ', act1: 'KeyE' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    place: 'Enter', act0: 'Comma', act1: 'Period' },
];

/* What the HUD prints. Solo shows the arrows only — they are the half people
 * reach for alone, and naming both sets here wraps the card header. WASD and
 * Enter still work; the rules screen is where that is spelled out. */
export const KEYCAPS = [
  { move: 'WASD', place: 'Space', acts: ['Q', 'E'] },
  { move: '↑↓←→', place: 'Enter', acts: [',', '.'] },
];
export const SOLO_KEYCAP = { move: '↑↓←→', place: 'Space', acts: [',', '.'] };

const DIR_VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function createInput(target = window) {
  const held = [new Set(), new Set()];
  const order = [[], []];          // { action, seq }, oldest → newest
  const edges = [{}, {}];          // one-shot presses, drained by read()
  let enabled = true;
  let solo = false;
  let seq = 0;

  const seatsFor = (code) => {
    const out = [];
    KEYS.forEach((map, seat) => {
      for (const action in map) if (map[action] === code) out.push({ seat, action });
    });
    return out;
  };

  function onDown(e) {
    const hits = seatsFor(e.code);
    if (!hits.length) return;
    /* Space and the arrows scroll the page; Enter re-fires focused buttons. */
    e.preventDefault();
    if (!enabled || e.repeat) return;
    for (const { seat, action } of hits) {
      if (held[seat].has(action)) continue;
      held[seat].add(action);
      if (DIR_VECTORS[action]) {
        order[seat].push({ action, seq: seq++ });
        edges[seat].mashed = true;     // any direction press counts as a struggle
      } else {
        edges[seat][action] = true;
      }
    }
  }

  function onUp(e) {
    const hits = seatsFor(e.code);
    if (!hits.length) return;
    for (const { seat, action } of hits) {
      held[seat].delete(action);
      const i = order[seat].findIndex(d => d.action === action);
      if (i >= 0) order[seat].splice(i, 1);
    }
  }

  function onBlur() {
    for (let s = 0; s < 2; s++) { held[s].clear(); order[s].length = 0; }
  }

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);

  const newest = (list) => list.reduce((a, b) => (!a || b.seq > a.seq ? b : a), null);

  return {
    /* Drain one frame's worth of intent. Edge-triggered flags are cleared here,
     * so exactly one simulation step sees each press.
     *
     * Alone, the single player answers to *both* keysets at once — arrows and
     * Space are the natural reach, but WASD and Enter keep working, so there is
     * no wrong half of the keyboard to have picked. */
    read(seat) {
      const seats = solo && seat === 0 ? [0, 1] : [seat];
      const dir = newest(seats.flatMap(s => order[s]));
      const [dx, dy] = dir ? DIR_VECTORS[dir.action] : [0, 0];

      const e = {};
      for (const s of seats) {
        for (const k in edges[s]) e[k] = e[k] || edges[s][k];
        edges[s] = {};
      }
      return { dx, dy, place: !!e.place, act0: !!e.act0, act1: !!e.act1, mashed: !!e.mashed };
    },
    setSolo(v) { solo = !!v; },
    setEnabled(v) { enabled = v; if (!v) onBlur(); },
    isDown: (seat, action) => held[seat].has(action),
    destroy() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
