/**
 * Inspection stage on the gallery table: loads the CC0 Smithsonian scans (true
 * scale, metres, y-up), rests them on the photographic sweep, turntable yaw,
 * flip-over poses, camera elevation/zoom, preset views and detail hotspots.
 * Supports two objects side by side (compare mode) with synchronized rotation.
 * @module scenes/inspection
 */
import * as THREE from 'three';
import { getGLTFLoader, assetURL } from '../core/assets.js';
import { TABLE_Y } from './gallery.js';

/** Poses: how the object rests on the table (rotation about x, applied before yaw). */
export const POSES = { upright: 0, flipped: Math.PI };

export const PRESET_VIEWS = {
  front: { yaw: 0, elev: 12, pose: 'upright', label: 'Front' },
  back: { yaw: 180, elev: 12, pose: 'upright', label: 'Back' },
  left: { yaw: 90, elev: 12, pose: 'upright', label: 'Left side' },
  right: { yaw: -90, elev: 12, pose: 'upright', label: 'Right side' },
  top: { yaw: 0, elev: 82, pose: 'upright', label: 'Top' },
  bottom: { yaw: 0, elev: 70, pose: 'flipped', label: 'Bottom (turned over)' },
};

const DEG = Math.PI / 180;

/** Union of mesh geometry bounding boxes (model-local, metres). */
export function geometryBox(root) {
  const box = new THREE.Box3();
  root.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); } });
  return box;
}

/**
 * Scale factor that brings `hiBox` to `baseBox`'s size, or 1 when they already
 * agree within 5% (the normal case after scripts/prepare-models.mjs).
 */
export function normaliseFactor(hiBox, baseBox) {
  const longest = (b) => { const s = b.getSize(new THREE.Vector3()); return Math.max(s.x, s.y, s.z); };
  const h = longest(hiBox); const b = longest(baseBox);
  if (!(h > 0) || !(b > 0)) return 1;
  const r = b / h;
  return Math.abs(r - 1) <= 0.05 ? 1 : r;
}

export class Inspection {
  constructor(engine, modelsManifest, objectsMeta) {
    this.engine = engine;
    this.manifest = modelsManifest;
    this.meta = objectsMeta; // id -> { frontYaw, hotspots, ... }
    this.loader = getGLTFLoader(engine.renderer);
    this.cache = new Map(); // id -> Promise<THREE.Object3D>
    this.hiRes = new Map();
    this.stage = new THREE.Group();
    this.stage.name = 'inspection-stage';
    this.stage.position.set(0, TABLE_Y, 0);
    engine.scene.add(this.stage);
    this.slots = []; // [{ id, holder, model }]
    this.view = { yaw: 0, elev: 12, dist: 0.6, pose: 'upright', target: new THREE.Vector3(0, 0.05, 0) };
    this._goal = null;
    this.onChange = null;
    engine.onUpdate((dt) => this._tick(dt));
  }

  load(id) {
    if (!this.cache.has(id)) {
      const entry = this.manifest[id];
      this.cache.set(id, new Promise((resolve, reject) => {
        this.loader.load(assetURL(entry.file), (gltf) => {
          const root = gltf.scene;
          root.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              if (o.material) o.material.envMapIntensity = 1.0;
            }
          });
          root.userData.id = id;
          resolve(root);
        }, undefined, reject);
      }));
    }
    return this.cache.get(id);
  }

  /** Show one object (or two for compare). */
  async show(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    const models = await Promise.all(list.map((id) => this.load(id)));
    for (const s of this.slots) this.stage.remove(s.holder);
    this.slots = list.map((id, i) => {
      const holder = new THREE.Group();
      holder.name = `slot-${id}`;
      const model = models[i];
      holder.add(model);
      this.stage.add(holder);
      return { id, holder, model };
    });
    // A new object starts at its Front preset: a flipped pose or tilted camera
    // from the previous object must not carry over (agent review SP4).
    const front = PRESET_VIEWS.front;
    this.view.hotspot = null;
    Object.assign(this.view, { yaw: front.yaw, elev: front.elev, pose: front.pose });
    this._layout();
    this._applyPose();
    this.fitDistance();
    this._applyCamera();
    this.onChange?.();
    return this.slots;
  }

  get ids() { return this.slots.map((s) => s.id); }
  get primary() { return this.slots[0] || null; }

  /** Lay slots out side by side along x with a gap proportional to their size. */
  _layout() {
    if (this.slots.length === 1) { this.slots[0].holder.position.set(0, 0, 0); return; }
    const widths = this.slots.map((s) => this.localSize(s.id).length() * 0.8);
    const gap = 0.04;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    let x = -total / 2;
    this.slots.forEach((s, i) => { s.holder.position.set(x + widths[i] / 2, 0, 0); x += widths[i] + gap; });
  }

  /** Size (m) of the model's local bounding box in its as-scanned orientation. */
  localSize(id) {
    const slot = this.slots.find((s) => s.id === id);
    const model = slot?.model;
    if (!model) return new THREE.Vector3();
    const box = new THREE.Box3();
    model.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); } });
    return box.getSize(new THREE.Vector3());
  }

  localBox(id) {
    const slot = this.slots.find((s) => s.id === id);
    const box = new THREE.Box3();
    slot?.model.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); } });
    return box;
  }

  _applyPose() {
    for (const s of this.slots) {
      const front = (this.meta[s.id]?.frontYaw || 0) * DEG;
      s.model.rotation.set(POSES[this.view.pose] || 0, 0, 0);
      s.holder.rotation.set(0, this.view.yaw * DEG + front, 0);
      // rest the object on the table: lift so its lowest point is at y = 0
      s.model.position.set(0, 0, 0);
      s.holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(s.model);
      const stageY = this.stage.position.y;
      s.model.position.y = -(box.min.y - stageY) + 0.0005;
    }
    this._recenterTarget();
  }

  _recenterTarget() {
    if (this.view.hotspot) return;
    const box = new THREE.Box3();
    for (const s of this.slots) box.expandByObject(s.model);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    this.view.target.copy(c).sub(this.stage.position);
  }

  fitDistance() {
    const box = new THREE.Box3();
    for (const s of this.slots) box.expandByObject(s.model);
    if (box.isEmpty()) return;
    const r = box.getBoundingSphere(new THREE.Sphere()).radius;
    const fov = this.engine.camera.fov * DEG;
    this.view.dist = THREE.MathUtils.clamp((r / Math.sin(fov / 2)) * 1.15, 0.12, 3);
    this.view.fitDist = this.view.dist;
  }

  _applyCamera() {
    if (this.cameraLocked) return; // a cinematic owns the camera
    const cam = this.engine.camera;
    const t = this.view.target.clone().add(this.stage.position);
    const e = this.view.elev * DEG;
    cam.position.set(t.x, t.y + Math.sin(e) * this.view.dist, t.z + Math.cos(e) * this.view.dist);
    cam.near = Math.max(0.005, this.view.dist / 50);
    cam.far = 60;
    cam.updateProjectionMatrix();
    cam.lookAt(t);
  }

  /* ---------------- learner controls (all have button + key equivalents) -------------- */
  turn(deg) { this.view.yaw = (this.view.yaw + deg + 360) % 360; this._applyPose(); this._applyCamera(); this.onChange?.(); }
  tilt(deg) { this.view.elev = THREE.MathUtils.clamp(this.view.elev + deg, 2, 88); this._applyCamera(); this.onChange?.(); }
  zoom(factor) {
    const fit = this.view.fitDist || 0.6;
    this.view.dist = THREE.MathUtils.clamp(this.view.dist * factor, fit * 0.18, fit * 2.2);
    this._applyCamera();
    this.onChange?.();
  }
  flip() { this.view.pose = this.view.pose === 'upright' ? 'flipped' : 'upright'; this.view.hotspot = null; this._applyPose(); this._applyCamera(); this.onChange?.(); }

  preset(name) {
    const p = PRESET_VIEWS[name];
    if (!p) return;
    this.view.hotspot = null;
    Object.assign(this.view, { yaw: p.yaw, elev: p.elev, pose: p.pose });
    this._applyPose();
    this.fitDistance();
    this._applyCamera();
    this.onChange?.();
    return p.label;
  }

  /**
   * Detail hotspot: { yaw, elev, zoom, point: [u,v,w] } where point is a
   * normalized position inside the object's local bounding box (0..1 per axis).
   */
  hotspot(id, hs) {
    const slot = this.slots.find((s) => s.id === id) || this.primary;
    if (!slot) return;
    Object.assign(this.view, { yaw: hs.yaw ?? 0, elev: hs.elev ?? 20, pose: hs.pose || 'upright' });
    this.view.hotspot = hs.id;
    this.current = { id: slot.id, hs };
    this._applyPose();
    const world = this.hotspotWorld(slot.id, hs);
    this.view.target.copy(world).sub(this.stage.position);
    this.fitDistance();
    this.view.dist = (this.view.fitDist || 0.5) / (hs.zoom || 2.5);
    this._applyCamera();
    this.onChange?.();
  }

  /** World position of a hotspot's mark on the object as it is currently posed. */
  hotspotWorld(id, hs) {
    const slot = this.slots.find((s) => s.id === id);
    if (!slot) return null;
    const box = this.localBox(id);
    const local = new THREE.Vector3(
      THREE.MathUtils.lerp(box.min.x, box.max.x, hs.point[0]),
      THREE.MathUtils.lerp(box.min.y, box.max.y, hs.point[1]),
      THREE.MathUtils.lerp(box.min.z, box.max.z, hs.point[2]),
    );
    slot.model.updateMatrixWorld(true);
    return slot.model.localToWorld(local);
  }

  /** Normalized canvas position (0..1, y down) of a hotspot's mark, or null if behind the camera. */
  hotspotScreen(id, hs) {
    const w = this.hotspotWorld(id, hs);
    if (!w) return null;
    const p = w.project(this.engine.camera);
    if (p.z > 1 || p.z < -1) return null;
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  }

  /** True when the current view is close to the hotspot's (same pose, yaw within 50°). */
  viewMatches(hs) {
    const dYaw = Math.abs(((this.view.yaw - (hs.yaw ?? 0) + 540) % 360) - 180);
    return this.view.pose === (hs.pose || 'upright') && dYaw <= 50;
  }

  /** Drag-to-rotate (pointer); small steps keep the object resting on the table. */
  drag(dx, dy) {
    this.view.yaw = (this.view.yaw + dx * 0.4 + 360) % 360;
    this.view.elev = THREE.MathUtils.clamp(this.view.elev + dy * 0.25, 2, 88);
    this._applyPose();
    this._applyCamera();
  }

  /** All meshes currently on the table (for raycasting). */
  meshes() {
    const out = [];
    for (const s of this.slots) s.model.traverse((o) => { if (o.isMesh) out.push(o); });
    return out;
  }

  /**
   * On-demand high-resolution texture (4096 px) for the magnifier: swaps the
   * object's base-colour map for the 4096 px map extracted from the
   * Smithsonian "150k-4096" package (same UV layout as the 2048 px map in the
   * std package is NOT guaranteed, so the full hi-res mesh replaces the model).
   */
  async loadHiRes(id) {
    const entry = this.manifest[id];
    if (!entry?.hiRes) return false;
    if (!this.hiRes.has(id)) {
      this.hiRes.set(id, new Promise((resolve) => {
        this.loader.load(assetURL(entry.hiRes), (gltf) => {
          const root = gltf.scene;
          root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          root.userData.id = id;
          root.userData.hiRes = true;
          resolve(root);
        }, undefined, () => resolve(null));
      }));
    }
    const hi = await this.hiRes.get(id);
    if (!hi) return false;
    const base = await this.load(id);
    // Safety net: the hi-res files are rescaled to metres at the source
    // (scripts/prepare-models.mjs). If a file ever arrives in other units,
    // match it to the base model's bounding box before it is shown.
    const f = normaliseFactor(geometryBox(hi), geometryBox(base));
    if (f !== 1) hi.traverse((o) => { if (o.isMesh) { o.geometry.scale(f, f, f); o.geometry.computeBoundingBox(); } });
    const slot = this.slots.find((s) => s.id === id);
    // Only swap while the magnifier still wants it; the base model stays cached.
    if (slot && this.hiResWanted === id && slot.model !== hi) this._swapModel(slot, hi);
    return true;
  }

  /** Put the cached base (2048 px) model back after the magnifier is turned off. */
  async restoreBase(id) {
    this.hiResWanted = null;
    const slot = this.slots.find((s) => s.id === id && s.model.userData.hiRes);
    if (!slot) return;
    const base = await this.load(id);
    this._swapModel(slot, base);
  }

  _swapModel(slot, model) {
    slot.holder.remove(slot.model);
    slot.model = model;
    slot.holder.add(model);
    this._applyPose();
    this._applyCamera();
    this.onChange?.();
  }

  _tick() { /* camera is applied on input; no decorative motion during tasks */ }

  setVisible(v) { this.stage.visible = v; }
}
