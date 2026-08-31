/* The camera is the whole vision system in this game — there is no minimap and
   no fog, so what the camera holds is exactly what the player knows. It rides
   the king, leans slightly toward where he is aiming, and never leaves the map. */

import { CAMERA, WORLD_PX, clamp, lerp } from './config.js';

export function makeCamera() {
  return { x: WORLD_PX / 2, y: WORLD_PX / 2, w: 0, h: 0, zoom: CAMERA.zoom, shake: 0, sx: 0, sy: 0 };
}

export function resizeCamera(cam, w, h) { cam.w = w; cam.h = h; }

export function snapCamera(cam, target) { cam.x = target.x; cam.y = target.y; }

export function updateCamera(cam, target, dt, aim = null) {
  let tx = target.x, ty = target.y;
  if (aim) { tx += aim.dx * CAMERA.lookAhead; ty += aim.dy * CAMERA.lookAhead; }

  const k = 1 - Math.exp(-CAMERA.ease * dt);   // frame-rate independent easing
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);

  const halfW = cam.w / (2 * cam.zoom), halfH = cam.h / (2 * cam.zoom);
  cam.x = clamp(cam.x, halfW, WORLD_PX - halfW);
  cam.y = clamp(cam.y, halfH, WORLD_PX - halfH);

  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * (cam.shake > 8 ? 34 : 18));
    cam.sx = (Math.random() * 2 - 1) * cam.shake;
    cam.sy = (Math.random() * 2 - 1) * cam.shake;
  } else { cam.sx = 0; cam.sy = 0; }
}

export function shakeCamera(cam, amount) { cam.shake = Math.min(24, cam.shake + amount); }

/* Is this world point on screen? Everything that happens outside the answer to
   this question is what the courier system exists for. */
export function onScreen(cam, x, y, margin = 0) {
  const halfW = cam.w / (2 * cam.zoom) + margin, halfH = cam.h / (2 * cam.zoom) + margin;
  return Math.abs(x - cam.x) <= halfW && Math.abs(y - cam.y) <= halfH;
}
