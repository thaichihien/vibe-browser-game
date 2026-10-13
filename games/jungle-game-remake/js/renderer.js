/* The pixel-art pipeline. The scene renders at low resolution into a colour+depth target and a
   view-space-normal target; one fullscreen pass then
     1. darkens the rim pixel of every silhouette (depth jump to a farther neighbour),
     2. lightens the upward side of creases (block tops, as in color.png),
     3. adds 4×4 Bayer dither, and
     4. snaps every pixel to the palette.
   The canvas is drawn at that low resolution and CSS scales it by an integer with
   image-rendering: pixelated. */
import * as THREE from 'three';
import { paletteRGBA } from './palette.js';
import { pickScale, lowRes } from './layout.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */`
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform sampler2D tPalette;
uniform int uCount;
uniform vec2 uRes;
uniform float uDither;
uniform float uEdge;
varying vec2 vUv;

float depthAt(vec2 p) { return texture2D(tDepth, (p + 0.5) / uRes).r; }
vec3 normalAt(vec2 p) { return texture2D(tNormal, (p + 0.5) / uRes).rgb * 2.0 - 1.0; }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec2 p = floor(vUv * uRes);
  vec3 col = texture2D(tColor, (p + 0.5) / uRes).rgb;
  float d = depthAt(p);
  vec3 n = normalAt(p);

  float rim = 0.0;
  float crease = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
    float dq = depthAt(p + o);
    vec3 nq = normalAt(p + o);
    rim = max(rim, step(uEdge, dq - d));
    float turn = 1.0 - dot(n, nq);
    crease = max(crease, step(0.35, turn) * step(abs(dq - d), uEdge) * step(nq.y + 0.2, n.y));
  }
  if (rim > 0.0) col *= 0.55;
  else if (crease > 0.0) col = min(col * 1.22 + 0.04, vec3(1.0));

  col += (bayer4(p) - 0.5) * uDither;

  vec3 best = col;
  float bestD = 1e9;
  for (int i = 0; i < 256; i++) {
    if (i >= uCount) break;
    vec3 c = texture2D(tPalette, vec2((float(i) + 0.5) / float(uCount), 0.5)).rgb;
    vec3 e = col - c;
    float dist = dot(e * e, vec3(2.0, 4.0, 3.0));
    if (dist < bestD) { bestD = dist; best = c; }
  }
  gl_FragColor = vec4(best, 1.0);
}`;

export function createPixelRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // hexes are display values (mesh.js)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;            // hard-edged shadows read as pixel art

  const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
  const colorRT = new THREE.WebGLRenderTarget(1, 1, { ...nearest, depthTexture: new THREE.DepthTexture(1, 1) });
  const normalRT = new THREE.WebGLRenderTarget(1, 1, nearest);
  const normalMat = new THREE.MeshNormalMaterial();

  const pal = paletteRGBA();
  const palTex = new THREE.DataTexture(pal.data, pal.count, 1, THREE.RGBAFormat);
  palTex.minFilter = palTex.magFilter = THREE.NearestFilter;
  palTex.needsUpdate = true;

  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: colorRT.texture },
      tDepth: { value: colorRT.depthTexture },
      tNormal: { value: normalRT.texture },
      tPalette: { value: palTex },
      uCount: { value: pal.count },
      uRes: { value: new THREE.Vector2(1, 1) },
      uDither: { value: 0.04 },
      uEdge: { value: 0.0025 },        // ≈ 0.2 world units with near 1 / far 80
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quadScene = new THREE.Scene();
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const size = { w: 1, h: 1, scale: 2 };
  let scaleOverride = null;               // debug panel: force a pixel scale

  function setTargets(w, h) {
    renderer.setSize(w, h, false);
    colorRT.setSize(w, h);
    normalRT.setSize(w, h);
    post.uniforms.uRes.value.set(w, h);
  }

  function resize(cssW, cssH) {
    size.scale = scaleOverride ?? pickScale(cssW, cssH);
    Object.assign(size, lowRes(cssW, cssH, size.scale));
    setTargets(size.w, size.h);
    canvas.style.width = `${size.w * size.scale}px`;
    canvas.style.height = `${size.h * size.scale}px`;
    return size;
  }

  function render(scene, camera) {
    renderer.shadowMap.autoUpdate = true;
    renderer.setRenderTarget(colorRT);
    renderer.render(scene, camera);

    // normals pass reuses this frame's shadow map
    renderer.shadowMap.autoUpdate = false;
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = normalMat;
    renderer.setClearColor(0x8080ff, 1);   // encodes the normal (0, 0, 1)
    renderer.setRenderTarget(normalRT);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = bg;

    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  }

  const setScaleOverride = s => { scaleOverride = s; };
  return { renderer, size, resize, render, setScaleOverride };
}
