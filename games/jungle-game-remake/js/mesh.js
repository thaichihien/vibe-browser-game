/* THREE glue for voxel grids. Imported first by main.js: it turns colour management off so
   every hex in palette.js is a display value end to end — the post shader snaps to those same
   numbers, and an sRGB round-trip would shift every colour off the palette. */
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

/** Shared clock uniform for water, swaying grass and leaves. main.js advances it per frame. */
export const shared = { uTime: { value: 0 } };

export function geometryFrom(grid, scale, pivot = [0, 0, 0], meshOpts) {
  const m = grid.mesh(meshOpts);
  const pos = m.positions;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (pos[i] - pivot[0]) * scale;
    pos[i + 1] = (pos[i + 1] - pivot[1]) * scale;
    pos[i + 2] = (pos[i + 2] - pivot[2]) * scale;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  geo.setAttribute('sway', new THREE.BufferAttribute(m.sway, 1));
  geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true });
export const STATIC_MAT = lambert();

/** Lambert that bends vertices with the `sway` attribute (0 at the base, 1 at the top). */
export function swayMaterial(amount = 1) {
  const mat = lambert();
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = shared.uTime;
    sh.uniforms.uSway = { value: amount };
    sh.vertexShader = 'attribute float sway;\nuniform float uTime;\nuniform float uSway;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 swayW = modelMatrix * vec4(position, 1.0);
        float swayK = sway * sway * uSway;
        transformed.x += sin(uTime * 1.7 + swayW.x * 1.3 + swayW.z * 0.9) * 0.05 * swayK;
        transformed.z += cos(uTime * 1.3 + swayW.z * 1.1 + swayW.x * 0.4) * 0.035 * swayK;`);
  };
  mat.customProgramCacheKey = () => `sway${amount}`;
  return mat;
}

export function voxelMesh(grid, scale, mat = STATIC_MAT, pivot, meshOpts) {
  const mesh = new THREE.Mesh(geometryFrom(grid, scale, pivot, meshOpts), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
