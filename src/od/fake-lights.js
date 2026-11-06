/**
 * fake-lights.js — cheap analytic spot and point lights for the Lantern Museum.
 *
 * Why: the gallery has a dozen display lights (one track spot per case, the
 * bench cases, the painting, the archive, the guard's torch, the chandelier).
 * As three.js lights, every lit fragment ran three's full physical BRDF a dozen
 * times. A headed M1 trace (2026-11-06) measured 55 ms of GPU time per frame
 * in the gallery with those lights and 8 ms without them (budget 12 ms); part
 * of that was a transmission pass that drew the lit scene twice (fixed in
 * kit.js noTransmission). With both changes the gallery view measured 10 ms
 * at the 50th and 11.3 ms at the 95th percentile. Here the same lights (same positions, cones, colours,
 * inverse-square falloff and range cutoff as three's SpotLight/PointLight)
 * are added to each material's direct light with a Lambert diffuse term and a
 * normalised Blinn-Phong highlight, in one loop over uniform arrays. The
 * lighting model is simpler; where light falls, how bright and what colour is
 * the same. Only the studio key over the inspection table (it casts the
 * shadows the raking-light lesson needs), the moonlight and the hemisphere
 * fill stay real three.js lights.
 *
 * Usage: lights are ordinary THREE.SpotLight / THREE.PointLight objects that
 * are NOT added to the scene graph (their parent group may be, for placement);
 * register them with add(), call patch(material) on every lit material
 * (patchScene does it for a subtree) and update(camera) once per frame.
 * @module od/fake-lights
 */
import * as THREE from 'three';

export const MAX_FAKE_LIGHTS = 16;

export class FakeLights {
  constructor() {
    this.lights = [];
    this.uniforms = {
      fkCount: { value: 0 },
      fkPos: { value: Array.from({ length: MAX_FAKE_LIGHTS }, () => new THREE.Vector3()) },
      fkDir: { value: Array.from({ length: MAX_FAKE_LIGHTS }, () => new THREE.Vector3(0, -1, 0)) },
      fkColor: { value: Array.from({ length: MAX_FAKE_LIGHTS }, () => new THREE.Vector3()) },
      // x: cos(outer angle), y: cos(inner angle), z: range cutoff (0 = none), w: decay exponent
      fkCone: { value: Array.from({ length: MAX_FAKE_LIGHTS }, () => new THREE.Vector4(-2, -1, 0, 2)) },
    };
    this._patched = new WeakSet();
    this._v = new THREE.Vector3();
    this._t = new THREE.Vector3();
  }

  /** Register a SpotLight or PointLight (kept out of the scene's light list). */
  add(light) {
    if (this.lights.length >= MAX_FAKE_LIGHTS) throw new Error(`fake-lights: more than ${MAX_FAKE_LIGHTS} lights`);
    this.lights.push(light);
    return light;
  }

  /** Add the light loop to a MeshStandardMaterial / MeshPhysicalMaterial (idempotent). */
  patch(material) {
    if (!material || this._patched.has(material) || !(material.isMeshStandardMaterial)) return;
    this._patched.add(material);
    const u = this.uniforms;
    const glass = material.transparent && material.opacity <= 0.3 && !material.map;
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prev?.call(material, shader, renderer);
      Object.assign(shader.uniforms, u);
      // Thin clear glass reflects; it has next to no diffuse reflectance.
      if (glass) shader.fragmentShader = `#define FK_GLASS\n${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
#define FK_MAX ${MAX_FAKE_LIGHTS}
uniform int fkCount;
uniform vec3 fkPos[FK_MAX];
uniform vec3 fkDir[FK_MAX];
uniform vec3 fkColor[FK_MAX];
uniform vec4 fkCone[FK_MAX];`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{
  float fkShin = clamp(2.0 / max(pow(material.roughness, 4.0), 1e-4) - 2.0, 1.0, 2048.0);
  for (int i = 0; i < FK_MAX; i++) {
    if (i >= fkCount) break;
    vec4 cone = fkCone[i];
    vec3 Lv = fkPos[i] - geometryPosition;
    float d2 = dot(Lv, Lv);
    if (cone.z > 0.0 && d2 > cone.z * cone.z) continue; // beyond the light's range
    float d = sqrt(d2);
    vec3 L = Lv / max(d, 1e-4);
    float cs = dot(-L, fkDir[i]);
    if (cs <= cone.x) continue; // outside the cone
    float nl = dot(geometryNormal, L);
    if (nl <= 0.0) continue;
    float spot = smoothstep(cone.x, cone.y, cs);
    float att = 1.0 / max(pow(d, cone.w), 0.01);
    if (cone.z > 0.0) att *= pow2(saturate(1.0 - pow4(d / cone.z)));
    vec3 irr = fkColor[i] * (nl * spot * att);
    #ifndef FK_GLASS
    reflectedLight.directDiffuse += irr * BRDF_Lambert(material.diffuseContribution);
    #endif
    vec3 H = normalize(L + geometryViewDir);
    float sp = pow(saturate(dot(geometryNormal, H)), fkShin) * (fkShin + 8.0) / 25.1327;
    reflectedLight.directSpecular += irr * material.specularColorBlended * sp;
  }
}`);
    };
    const key = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => `${key ? key() : ''}|fk${MAX_FAKE_LIGHTS}${glass ? 'g' : ''}`;
    material.needsUpdate = true;
  }

  /** Patch every lit material under `root`. */
  patchScene(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [o.material].flat()) this.patch(m);
    });
  }

  /**
   * World matrix of a light (or its target) that is not in the scene graph:
   * its own transform, carried by `userData.fkParent` (a scene object it moves with) when set.
   */
  _world(o, parent = o.userData.fkParent) {
    o.updateMatrix();
    if (parent) o.matrixWorld.multiplyMatrices(parent.matrixWorld, o.matrix);
    else o.matrixWorld.copy(o.matrix);
  }

  /** Per frame: lights to view space (three's lit fragments work in view space). */
  update(camera) {
    const u = this.uniforms;
    const view = camera.matrixWorldInverse;
    let n = 0;
    for (const l of this.lights) {
      if (!l.visible || l.intensity <= 0) continue;
      this._world(l);
      u.fkPos.value[n].setFromMatrixPosition(l.matrixWorld).applyMatrix4(view);
      if (l.isSpotLight) {
        this._world(l.target, l.userData.fkParent);
        this._v.setFromMatrixPosition(l.matrixWorld);
        this._t.setFromMatrixPosition(l.target.matrixWorld);
        u.fkDir.value[n].subVectors(this._t, this._v).normalize().transformDirection(view);
        u.fkCone.value[n].set(Math.cos(l.angle), Math.cos(l.angle * (1 - l.penumbra)), l.distance, l.decay);
      } else {
        u.fkDir.value[n].set(0, -1, 0);
        u.fkCone.value[n].set(-2, -1.5, l.distance, l.decay);
      }
      const c = l.color;
      u.fkColor.value[n].set(c.r * l.intensity, c.g * l.intensity, c.b * l.intensity);
      n++;
    }
    u.fkCount.value = n;
  }
}
