/* Boot: renderer, scene, camera, HUD, pieces and the frame loop. Input arrives in Task 7. */
import * as THREE from 'three';
import { shared } from './mesh.js';
import { createPixelRenderer } from './pixel.js';
import { buildWorld, createCamera, fitCamera } from './scene.js';
import { addBoardProps } from './board-props.js';
import { createViews, makePortraits } from './views.js';
import { createGame } from './rules.js';
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
const world = buildWorld(scene);
addBoardProps(world);

const getPixel = () => ({ ppu: (camera.top - camera.bottom) / camera.zoom / pixel.size.h });
const views = createViews({ scene, camera, world, getPixel });
const game = createGame();

const hud = createHud({
  onRestart: () => {},
  onSoundToggle: () => { Sound.toggle(); hud.setSound(Sound.muted); },
});
hud.setSound(Sound.muted);
hud.setTurn('red');
hud.setPortraits(makePortraits(pixel));

function resize() {
  const r = stage.getBoundingClientRect();
  const s = pixel.resize(r.width, r.height);
  fitCamera(camera, s.w, s.h);
}
new ResizeObserver(resize).observe(stage);
resize();

game.pieces.forEach(p => views.add(p));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  shared.uTime.value = t;
  camera.updateMatrixWorld();
  views.update(dt, t);
  pixel.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__booted = true;
