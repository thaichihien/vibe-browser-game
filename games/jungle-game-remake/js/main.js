/* Boot stub: proves the import map, Three.js and the HUD load. Replaced in Task 5. */
import * as THREE from 'three';
import { Sound } from './audio.js';
import { createHud } from './hud.js';

const hud = createHud({
  onRestart: () => hud.toast('Bàn cờ đã được đặt lại 🌿', 'info'),
  onSoundToggle: () => { Sound.toggle(); hud.setSound(Sound.muted); },
});
hud.setSound(Sound.muted);
hud.setTurn('red');
console.info('Three.js', THREE.REVISION);
window.__booted = true;
