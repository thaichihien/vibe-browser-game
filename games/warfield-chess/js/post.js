/* Warfield Chess — post-processing: a light bloom so the sun, gold and spells glow, then colour
   grading towards a warm golden-hour film look (cool shadows, warm highlights, a touch more
   saturation and contrast, a soft vignette). The scene renders into a multisampled target so
   edges stay antialiased. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Runs after OutputPass, so it works on display (sRGB) colours, like a grade in an editor.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uAspect: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAspect; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.14);                                         // saturation
      c = (c - 0.5) * 1.07 + 0.5;                                        // contrast
      vec3 shadows = vec3(0.93, 0.97, 1.05), highs = vec3(1.06, 1.0, 0.9);
      c *= mix(shadows, highs, smoothstep(0.05, 0.85, l));               // split tone
      c += vec3(0.018, 0.01, 0.0);                                       // warm lift in the blacks
      vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
      c *= mix(1.0, 0.74, smoothstep(0.35, 0.95, length(d)));            // vignette
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  return {
    render() { composer.render(); },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
      grade.uniforms.uAspect.value = w / h;
    },
  };
}
