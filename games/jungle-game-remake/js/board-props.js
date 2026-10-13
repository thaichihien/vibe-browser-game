/* Traps and dens on their board squares. Each prop is parented to its square's tile-top mesh
   (local y 0.25 = the tile's top face) so it rises with the hover lift. */
import { TRAPS } from './rules.js';
import { buildTrap, buildDen } from './models.js';

export function addBoardProps(world) {
  for (const [r, c] of TRAPS) {
    const trap = buildTrap();
    trap.group.position.y = 0.25;
    world.tiles[r][c].add(trap.group);
    world.traps.set(`${r},${c}`, trap);
  }
  for (const [r, c] of [[0, 3], [8, 3]]) {
    const den = buildDen(r === 0 ? 'red' : 'blue');
    den.group.position.y = 0.25;
    world.tiles[r][c].add(den.group);
    world.dens.set(`${r},${c}`, den);
  }
}
