/**
 * Magnifier lens: a circular inset that re-renders the scene through a narrow
 * field-of-view camera aimed at the lens centre (scissored viewport), so the
 * learner sees surface detail at 2–8x without moving the main camera. On first
 * use it requests the 4096 px "hi-res" scan (on demand, plan Phase 3).
 * The lens moves with the pointer or the tool-pad lens buttons, and starts on
 * the mark when a point of interest is selected.
 * @module systems/magnifier
 */
import * as THREE from 'three';

export const ZOOM_LEVELS = [2, 4, 8];

export class Magnifier {
  constructor(engine, inspection, overlayHost) {
    this.engine = engine;
    this.inspection = inspection;
    this.on = false;
    this.zoomIndex = 1;
    this.center = { x: 0.5, y: 0.5 }; // normalized canvas coords (0..1, y down)
    this.radiusPx = 110;
    this.cam = new THREE.PerspectiveCamera(10, 1, 0.001, 50);
    this.ray = new THREE.Raycaster();
    this.el = document.createElement('div');
    this.el.className = 'magnifier-lens';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.hidden = true;
    overlayHost.appendChild(this.el);
    engine.addOverlayPass((r) => this._render(r));
  }

  get zoom() { return ZOOM_LEVELS[this.zoomIndex]; }

  setEnabled(on) {
    this.on = on;
    this.el.hidden = !on;
    this._place();
    const id = this.inspection.primary?.id;
    if (on) {
      if (id) {
        this.inspection.hiResWanted = id;
        this.inspection.loadHiRes(id).then((ok) => { this.hiResLoaded = ok; this.onHiRes?.(ok); });
      }
    } else if (id) {
      // The 4096 px model is shown only while the lens is on; the base model returns after.
      this.inspection.restoreBase(id);
    }
  }

  cycleZoom(dir = 1) { this.zoomIndex = (this.zoomIndex + dir + ZOOM_LEVELS.length) % ZOOM_LEVELS.length; return this.zoom; }

  moveTo(nx, ny) { this.center.x = THREE.MathUtils.clamp(nx, 0.05, 0.95); this.center.y = THREE.MathUtils.clamp(ny, 0.05, 0.95); this._place(); }
  nudge(dx, dy) { this.moveTo(this.center.x + dx, this.center.y + dy); }

  _place() {
    const c = this.engine.canvas;
    const rect = c.getBoundingClientRect();
    const host = this.el.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
    const x = rect.left - host.left + this.center.x * rect.width;
    const y = rect.top - host.top + this.center.y * rect.height;
    const r = Math.min(this.radiusPx, rect.width * 0.22, rect.height * 0.3);
    this._r = r;
    Object.assign(this.el.style, { left: `${x - r}px`, top: `${y - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
  }

  /** True when normalized canvas point `pt` lies inside the lens circle. */
  covers(pt) {
    if (!this.on || !pt) return false;
    const rect = this.engine.canvas.getBoundingClientRect();
    const r = this._r || Math.min(this.radiusPx, rect.width * 0.22, rect.height * 0.3);
    const dx = (pt.x - this.center.x) * rect.width;
    const dy = (pt.y - this.center.y) * rect.height;
    return Math.hypot(dx, dy) <= r;
  }

  /** What is under the lens centre (world point on the object), or null. */
  probe() {
    const ndc = new THREE.Vector2(this.center.x * 2 - 1, -(this.center.y * 2 - 1));
    this.ray.setFromCamera(ndc, this.engine.camera);
    const hits = this.ray.intersectObjects(this.inspection.meshes(), false);
    return hits[0] || null;
  }

  _render(renderer) {
    if (!this.on) return;
    const main = this.engine.camera;
    const canvas = renderer.domElement;
    const pr = renderer.getPixelRatio();
    const w = canvas.width / pr; const h = canvas.height / pr;
    const r = this._r || 100;
    // Aim the lens camera from the main camera through the lens centre.
    const ndc = new THREE.Vector3(this.center.x * 2 - 1, -(this.center.y * 2 - 1), 0.5);
    const dir = ndc.unproject(main).sub(main.position).normalize();
    this.cam.position.copy(main.position);
    this.cam.up.copy(main.up);
    this.cam.lookAt(main.position.clone().add(dir));
    // Same pixel density as the main view, magnified by `zoom`.
    const fovRad = (main.fov * Math.PI) / 180;
    const lensFov = 2 * Math.atan(Math.tan(fovRad / 2) * ((2 * r) / h) / this.zoom);
    this.cam.fov = (lensFov * 180) / Math.PI;
    this.cam.aspect = 1;
    this.cam.near = main.near; this.cam.far = main.far;
    this.cam.updateProjectionMatrix();
    const x = this.center.x * w - r;
    const y = (1 - this.center.y) * h - r;
    renderer.setScissorTest(true);
    renderer.setScissor(x, y, 2 * r, 2 * r);
    renderer.setViewport(x, y, 2 * r, 2 * r);
    const prevAuto = renderer.autoClear;
    renderer.autoClear = true;
    renderer.render(this.engine.scene, this.cam);
    renderer.autoClear = prevAuto;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  }
}
