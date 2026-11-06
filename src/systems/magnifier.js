/**
 * Magnifier lens (v3, fixes SP-03): the scene under the lens is rendered into
 * a render target through a narrow field-of-view camera aimed through the lens
 * centre, then composited into the main view as a circle (a shader quad in
 * front of the camera that discards everything outside the lens and draws a
 * brass rim). There is no square behind the lens any more: the v2 scissored
 * viewport is gone. The composite goes through the same render chain as the
 * scene, so the lens shows the same grade.
 * On first use the 4096 px "hi-res" scan is requested (on demand, D-07).
 * The lens follows the mouse, sits where a touch taps, and starts on the mark
 * when a point of interest is chosen.
 * @module systems/magnifier
 */
import * as THREE from 'three';

export const ZOOM_LEVELS = [2, 4, 8];

const LENS_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const LENS_FS = `uniform sampler2D tLens; varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  vec3 c = texture2D(tLens, vUv).rgb;
  // Brass rim (outer 7%) with a soft inner shadow; slight vignette inside the glass.
  float rim = smoothstep(0.90, 0.93, r);
  vec3 brass = mix(vec3(0.42, 0.30, 0.13), vec3(0.95, 0.78, 0.45), 0.5 + 0.5 * p.y);
  c *= mix(1.0, 0.72, smoothstep(0.6, 0.9, r));
  gl_FragColor = vec4(mix(c, brass * 1.4, rim), 1.0);
}`;

export class Magnifier {
  /**
   * @param {object} o
   * @param {object} o.engine     v3 engine (renderer, scene, camera, canvas via renderer.domElement)
   * @param {object} o.stage      inspection stage (primary, meshes(), loadHiRes, restoreBase)
   */
  constructor({ engine, stage }) {
    this.engine = engine;
    this.stage = stage;
    this.on = false;
    this.zoomIndex = 1;
    this.center = { x: 0.62, y: 0.45 }; // normalized canvas coords (0..1, y down)
    this.radiusPx = 120;
    this.cam = new THREE.PerspectiveCamera(10, 1, 0.01, 50);
    this.ray = new THREE.Raycaster();
    this.rt = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, samples: 0 });
    this.mat = new THREE.ShaderMaterial({ uniforms: { tLens: { value: this.rt.texture } }, vertexShader: LENS_VS, fragmentShader: LENS_FS, depthTest: false, depthWrite: false, transparent: true });
    this.lens = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.lens.renderOrder = 999;
    this.lens.frustumCulled = false;
    this.lens.visible = false;
    this.lens.raycast = () => {};
    this.lens.userData.noOutline = true;
    this.lens.userData.noBake = true;
    this.lens.userData.marker = { label: 'Magnifier lens' };
    this.lens.name = 'magnifier lens';
    // The lens lives in front of the main camera.
    engine.camera.add(this.lens);
    if (!engine.camera.parent) engine.scene.add(engine.camera);
  }

  get zoom() { return ZOOM_LEVELS[this.zoomIndex]; }

  setEnabled(on) {
    this.on = Boolean(on);
    this.lens.visible = this.on;
    const id = this.stage.primary?.id;
    if (this.on) {
      if (id) {
        this.stage.hiResWanted = id;
        this.stage.loadHiRes(id).then((ok) => { this.hiResLoaded = ok; this.onHiRes?.(ok); });
      }
    } else if (id) {
      // The 4096 px model is shown only while the lens is on; the base model returns after.
      this.stage.restoreBase(id);
    }
  }

  cycleZoom(dir = 1) { this.zoomIndex = (this.zoomIndex + dir + ZOOM_LEVELS.length) % ZOOM_LEVELS.length; return this.zoom; }
  moveTo(nx, ny) { this.center.x = THREE.MathUtils.clamp(nx, 0.06, 0.94); this.center.y = THREE.MathUtils.clamp(ny, 0.08, 0.92); }
  nudge(dx, dy) { this.moveTo(this.center.x + dx, this.center.y + dy); }

  /** Lens radius in CSS px for the current canvas. */
  radius() {
    const r = this.engine.renderer.domElement.getBoundingClientRect();
    return Math.max(48, Math.min(this.radiusPx, r.width * 0.2, r.height * 0.26));
  }

  /** True when normalized canvas point `pt` lies inside the lens circle. */
  covers(pt) {
    if (!this.on || !pt) return false;
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    const dx = (pt.x - this.center.x) * rect.width;
    const dy = (pt.y - this.center.y) * rect.height;
    return Math.hypot(dx, dy) <= this.radius();
  }

  /** What is under the lens centre (world point on the object), or null. */
  probe() {
    const ndc = new THREE.Vector2(this.center.x * 2 - 1, -(this.center.y * 2 - 1));
    this.ray.setFromCamera(ndc, this.engine.camera);
    const hits = this.ray.intersectObjects(this.stage.meshes(), false);
    return hits[0] || null;
  }

  /** Per frame (after the camera moved, before the main render): render the lens view and place the lens quad. */
  update() {
    if (!this.on) return;
    const main = this.engine.camera;
    const renderer = this.engine.renderer;
    const rect = renderer.domElement.getBoundingClientRect();
    const r = this.radius();
    const dpr = renderer.getPixelRatio();
    const px = Math.min(1024, THREE.MathUtils.ceilPowerOfTwo(Math.round(2 * r * dpr)));
    if (this.rt.width !== px) this.rt.setSize(px, px);
    // Aim the lens camera from the main camera through the lens centre.
    main.updateMatrixWorld();
    const ndc = new THREE.Vector3(this.center.x * 2 - 1, -(this.center.y * 2 - 1), 0.5);
    const dir = ndc.clone().unproject(main).sub(main.getWorldPosition(new THREE.Vector3())).normalize();
    const eye = main.getWorldPosition(new THREE.Vector3());
    this.cam.position.copy(eye);
    this.cam.up.set(0, 1, 0).applyQuaternion(main.getWorldQuaternion(new THREE.Quaternion()));
    this.cam.lookAt(eye.clone().add(dir));
    const fovRad = (main.fov * Math.PI) / 180;
    const lensFov = 2 * Math.atan(Math.tan(fovRad / 2) * ((2 * r) / rect.height) / this.zoom);
    this.cam.fov = (lensFov * 180) / Math.PI;
    this.cam.aspect = 1;
    this.cam.near = Math.max(0.01, main.near * 0.5);
    this.cam.far = main.far;
    this.cam.updateProjectionMatrix();
    this.lens.visible = false;
    const prevRT = renderer.getRenderTarget();
    const autoShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false; // the main pass renders the shadow maps once per frame
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.engine.scene, this.cam);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.autoUpdate = autoShadow;
    this.lens.visible = true;
    // Place the quad just beyond the near plane, sized to r CSS px, at the lens centre.
    const d = main.near * 1.6;
    const halfH = d * Math.tan(fovRad / 2);
    const halfW = halfH * main.aspect;
    const s = (r / (rect.height / 2)) * halfH * 2;
    this.lens.position.set(ndc.x * halfW, ndc.y * halfH, -d);
    this.lens.scale.set(s, s, 1);
    this.lens.quaternion.identity();
  }

  dispose() { this.rt.dispose(); this.mat.dispose(); this.lens.geometry.dispose(); this.lens.parent?.remove(this.lens); }
}
