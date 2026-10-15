/* Pixel-art pipeline, after reference/artstyle01–02: chunky pixels, cel-shaded bands, a dark ink
   line around every silhouette, and a white outline around whatever is highlighted.
     pass 1  scene → low-res colour + depth target (toon materials give the banded shading)
     pass 2  highlighted objects only (camera layer 1) → mask target
     pass 3  fullscreen: ink rim where depth jumps, white ring around the mask, posterize.
   The canvas is drawn at the low resolution; CSS scales it up with image-rendering: pixelated. */
import * as THREE from 'three';
import { LOOK } from './look.js';

THREE.ColorManagement.enabled = false;     // every hex in palette.js is a display value

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = `
uniform sampler2D tColor, tDepth, tMask;
uniform vec2 uRes;
uniform vec3 uInk;
uniform float uLevels;
uniform float uSat, uBright, uContrast, uDither, uInkMix, uEdge;
varying vec2 vUv;
float depthAt(vec2 p){ return texture2D(tDepth, (p + 0.5) / uRes).r; }
float maskAt(vec2 p){ return texture2D(tMask, (p + 0.5) / uRes).r; }
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main(){
  vec2 p = floor(vUv * uRes);
  vec3 col = texture2D(tColor, (p + 0.5) / uRes).rgb;
  float d = depthAt(p);
  float m = maskAt(p);
  float rim = 0.0, ring = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 o = i == 0 ? vec2(1,0) : i == 1 ? vec2(-1,0) : i == 2 ? vec2(0,1) : i == 3 ? vec2(0,-1)
           : i == 4 ? vec2(1,1) : i == 5 ? vec2(-1,1) : i == 6 ? vec2(1,-1) : vec2(-1,-1);
    if (i < 4) rim = max(rim, step(uEdge, depthAt(p + o) - d));
    ring = max(ring, maskAt(p + o));
  }
  col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0) * uBright;
  // push saturation: the references are candy-bright, never muddy
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(lum), col, uSat), 0.0, 1.0);
  // quantise each channel with a light ordered dither: the flat colour fields of pixel art
  col = floor(col * uLevels + bayer4(p) * uDither + 0.5 - uDither * 0.5) / uLevels;
  if (rim > 0.0) col = mix(col, uInk, uInkMix);
  if (m < 0.5 && ring > 0.5) col = vec3(1.0, 0.98, 0.93);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createPixel(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
  const colorRT = new THREE.WebGLRenderTarget(1, 1, { ...nearest, depthTexture: new THREE.DepthTexture(1, 1) });
  const maskRT = new THREE.WebGLRenderTarget(1, 1, nearest);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: colorRT.texture }, tDepth: { value: colorRT.depthTexture }, tMask: { value: maskRT.texture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uInk: { value: new THREE.Color(0x2a1f3d) },
      uLevels: { value: 14 },
      uSat: { value: 1.3 }, uBright: { value: 1 }, uContrast: { value: 1 }, uDither: { value: 0.6 },
      uInkMix: { value: 0.78 }, uEdge: { value: 0.006 },
    },
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Scene();
  quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const size = { w: 1, h: 1, scale: 3 };

  function resize(cssW, cssH) {
    // aim for LOOK.pixelRows rendered rows: big chunky pixels, as in the references
    size.scale = Math.max(1, Math.min(6, Math.round(cssH / LOOK.pixelRows)));
    size.w = Math.max(1, Math.floor(cssW / size.scale));
    size.h = Math.max(1, Math.floor(cssH / size.scale));
    renderer.setSize(size.w, size.h, false);
    colorRT.setSize(size.w, size.h);
    maskRT.setSize(size.w, size.h);
    post.uniforms.uRes.value.set(size.w, size.h);
    canvas.style.width = `${size.w * size.scale}px`;
    canvas.style.height = `${size.h * size.scale}px`;
    return size;
  }

  function render(scene, camera) {
    const u = post.uniforms;
    u.uSat.value = LOOK.saturation; u.uBright.value = LOOK.brightness; u.uContrast.value = LOOK.contrast;
    u.uLevels.value = LOOK.colorLevels; u.uDither.value = LOOK.dither; u.uInkMix.value = LOOK.outline;
    u.uEdge.value = LOOK.outlineDepth;
    renderer.shadowMap.autoUpdate = true;
    renderer.setRenderTarget(colorRT);
    renderer.render(scene, camera);

    renderer.shadowMap.autoUpdate = false;
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = white;
    camera.layers.set(1);
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(maskRT);
    renderer.clear();
    renderer.render(scene, camera);
    camera.layers.set(0);
    scene.overrideMaterial = null;
    scene.background = bg;

    renderer.setRenderTarget(null);
    renderer.render(quad, quadCam);
  }

  return { renderer, size, resize, render };
}
