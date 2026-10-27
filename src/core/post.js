/**
 * Restrained post pipeline (standards 4.3): SMAA on Medium+, N8AO on High+.
 * No bloom (no physically motivated bright sources in a dim gallery), no DOF
 * outside cinematics. Degrades gracefully to direct rendering.
 * Chain: RenderPass -> N8AOPass (High+) -> EffectPass(SMAA).
 * @module core/post
 */
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, SMAAEffect, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { N8AOPass } from 'n8ao';

const NONE = { composer: null, setSize() {}, dispose() {} };

export function createPost(renderer, scene, camera, presetDef) {
  const wantsSmaa = Array.isArray(presetDef.post) && presetDef.post.includes('smaa');
  if (!wantsSmaa) return NONE;
  try {
    const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    composer.addPass(new RenderPass(scene, camera));
    if (presetDef.aoEnabled) {
      const ao = new N8AOPass(scene, camera, renderer.domElement.width || 512, renderer.domElement.height || 512);
      // Object-scale AO: the scans are 5–40 cm, so the radius is centimetres.
      ao.configuration.aoRadius = 0.06;
      ao.configuration.distanceFalloff = 0.03;
      ao.configuration.intensity = 2.0;
      ao.configuration.aoSamples = 8;
      ao.configuration.denoiseSamples = 4;
      composer.addPass(ao);
    }
    // The composer renders to a half-float target, where three.js skips the
    // renderer's tone mapping; apply ACES Filmic explicitly (standards 4.3).
    composer.addPass(new EffectPass(camera, new SMAAEffect(), new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));
    return { composer, setSize(w, h) { composer.setSize(w, h); }, dispose() { composer.dispose(); } };
  } catch (e) {
    console.warn('post pipeline unavailable, rendering directly:', e);
    return NONE;
  }
}
