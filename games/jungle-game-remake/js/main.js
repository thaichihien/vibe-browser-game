/* Boot: renderer, scene, camera, HUD and the frame loop. Pieces arrive in Task 6, input in 7. */
import * as THREE from 'three';
import { shared } from './mesh.js';
import { createPixelRenderer } from './pixel.js';
import { buildWorld, createCamera, fitCamera } from './scene.js';
import { Sound } from './audio.js';
import { createHud } from './hud.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('view');

let pixel;
try {
  pixel = createPixelRenderer(canvas);
} catch (err) {
  window.__bootFail('webgl');
  throw err;
}

const scene = new THREE.Scene();
const camera = createCamera();
buildWorld(scene);

const hud = createHud({
  onRestart: () => {},
  onSoundToggle: () => { Sound.toggle(); hud.setSound(Sound.muted); },
});
hud.setSound(Sound.muted);
hud.setTurn('red');

function resize() {
  const r = stage.getBoundingClientRect();
  const s = pixel.resize(r.width, r.height);
  fitCamera(camera, s.w, s.h);
}
new ResizeObserver(resize).observe(stage);
resize();

function frame(now) {
  shared.uTime.value = now / 1000;
  pixel.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__booted = true;
