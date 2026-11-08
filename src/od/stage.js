/**
 * stage.js — the inspection table in the v3 scene (replaces the v2
 * scenes/inspection.js camera rig). The case scans (Smithsonian CC0, metres,
 * y up) rest on the photo sweep at true scale; the learner's camera is the
 * template rig, so turning and tilting orbit the object and the mouse wheel
 * zooms. The stage handles what the rig cannot: which object is on the table,
 * turning it over, side-by-side comparison, points of interest (rig views and
 * numbered tags), the true-size view, measurement, the raking light and the
 * magnifier. Views keep the object beside the Now card.
 *
 * Point-of-interest views come from the v2 case data { yaw, elev, zoom, pose,
 * point }: v2 turned the object by `yaw` in front of a fixed camera; v3 keeps
 * the object still and moves the camera to theta = -yaw, the same side.
 * @module od/stage
 */
import * as THREE from 'three';
import { STAGE_POS } from './museum.js';
import { loadGLB } from './kit.js';
import { RakingLight } from '../systems/raking-light.js';
import { Magnifier } from '../systems/magnifier.js';
import { Measure } from '../systems/measure.js';
import { LampRig, lampPlan } from './lamp-rig.js';

const DEG = Math.PI / 180;
export const POSES = { upright: 0, flipped: Math.PI };
/** An object framed whole fills at least this share of the view height (plan 10 §3). */
export const MIN_FRAME_H = 0.35;
export const PRESET_VIEWS = {
  front: { yaw: 0, elev: 14, pose: 'upright', label: 'Front' },
  back: { yaw: 180, elev: 14, pose: 'upright', label: 'Back' },
  left: { yaw: 90, elev: 14, pose: 'upright', label: 'Left side' },
  right: { yaw: -90, elev: 14, pose: 'upright', label: 'Right side' },
  top: { yaw: 0, elev: 80, pose: 'upright', label: 'Top' },
  bottom: { yaw: 0, elev: 70, pose: 'flipped', label: 'Bottom (turned over)' },
};

/** Union of mesh geometry bounding boxes (model-local, metres). */
export function geometryBox(root) {
  const box = new THREE.Box3();
  root.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); } });
  return box;
}

/** Scale that brings `hiBox` to `baseBox`'s size, or 1 when they agree within 5% (the normal case). */
export function normaliseFactor(hiBox, baseBox) {
  const longest = (b) => { const s = b.getSize(new THREE.Vector3()); return Math.max(s.x, s.y, s.z); };
  const h = longest(hiBox); const b = longest(baseBox);
  if (!(h > 0) || !(b > 0)) return 1;
  const r = b / h;
  return Math.abs(r - 1) <= 0.05 ? 1 : r;
}

/** Camera angles (rig theta/phi, radians) for a v2 point-of-interest yaw/elev in degrees. */
export function viewAngles(yawDeg, elevDeg) {
  return { theta: -yawDeg * DEG, phi: THREE.MathUtils.clamp((90 - elevDeg) * DEG, 0.12, 1.5) };
}

/** Effective yaw (degrees, 0..360) the camera sees, from rig theta. */
export function yawFromTheta(theta) { return ((((-theta / DEG) % 360) + 540) % 360) - 180; }

/** Numbered point-of-interest tag (a task cue on the object; labelled for the legend). */
function tagSprite(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,14,8,0.85)';
  g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#f2b25c'; g.lineWidth = 5; g.stroke();
  g.fillStyle = '#fff3dc';
  g.font = '700 34px "Source Sans 3", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false }));
  s.scale.setScalar(0.034);
  s.renderOrder = 50;
  s.raycast = () => {};
  s.userData.marker = { label: 'Point-of-interest tag' };
  s.userData.noOutline = true;
  s.userData.noBake = true;
  return s;
}

export class Stage {
  /**
   * @param {object} app     v3 app (engine, rig, inspect, shell)
   * @param {import('./museum.js').Museum} museum
   * @param {object} o
   * @param {object} o.records  id -> verbatim record (content/records.json)
   * @param {object} o.models   content/models.json (base and hi-res scan files)
   */
  constructor(app, museum, { records, models }) {
    this.app = app;
    this.engine = app.engine;
    this.museum = museum;
    this.records = records;
    this.models = models;
    this.root = new THREE.Group();
    this.root.name = 'inspection stage';
    this.root.position.copy(STAGE_POS);
    this.engine.scene.add(this.root);
    this.slots = []; // [{ id, holder, model }]
    this.hiRes = new Map();
    this.pose = 'upright';
    this.view = { dist: 0.4 }; // Measure scales its dots by this
    this.tags = new THREE.Group();
    this.tags.name = 'point-of-interest tags';
    this.engine.scene.add(this.tags);
    this.current = null; // { id, hs }
    this.trueSize = false;
    this.compareId = null;
    this.rake = new RakingLight(this.engine.scene, museum, STAGE_POS.clone().add(new THREE.Vector3(0, 0.05, 0)));
    this.magnifier = new Magnifier({ engine: this.engine, stage: this });
    this.measure = new Measure(this.engine, this);
    this._token = 0;
    // Shadow maps are re-rendered only when something that casts or lights them
    // changes (the table objects, the references, the key or the raking light):
    // re-drawing a 0.8 M-triangle scan into the shadow map every frame cost GPU
    // time for a picture that had not changed.
    this.engine.renderer.shadowMap.autoUpdate = false;
    this.engine.renderer.shadowMap.needsUpdate = true;
    this._shadowSig = '';
  }

  /** A cheap signature of everything the shadow maps depend on. */
  _shadowSignature() {
    const parts = [];
    const add = (o) => { if (!o) { parts.push('-'); return; } o.updateMatrixWorld(); const e = o.matrixWorld.elements; parts.push(o.visible ? 1 : 0, e[0].toFixed(4), e[1].toFixed(4), e[2].toFixed(4), e[4].toFixed(4), e[12].toFixed(4), e[13].toFixed(4), e[14].toFixed(4)); };
    for (const h of this.root.children) { add(h); for (const c of h.children) { parts.push(c.id); add(c); } }
    const M = this.museum;
    for (const o of [M.scaleCard, M.quarter, M.ruler, M.magnifierProp, M.rakeLamp, M.draftCard, M._labelStand]) add(o);
    const L = this.rake.light;
    parts.push(L.castShadow ? 1 : 0, L.intensity.toFixed(3), L.position.x.toFixed(4), L.position.y.toFixed(4), L.position.z.toFixed(4), M.key.intensity.toFixed(3), M.key.castShadow ? 1 : 0);
    return parts.join(',');
  }

  get primary() { return this.slots[0] || null; }
  get ids() { return this.slots.map((s) => s.id); }

  /** Put one object (or two, for compare) on the table. Its vitrine shows a placard meanwhile. */
  async show(ids) {
    const list = [ids].flat().filter(Boolean);
    const token = ++this._token;
    const scans = await Promise.all(list.map((id) => this.museum.scan(id)));
    if (token !== this._token) return this.slots; // a newer request won
    for (const s of this.slots) { this._unregister(s); this.root.remove(s.holder); }
    this.measure.clear();
    this.slots = list.map((id, i) => {
      const holder = new THREE.Group();
      holder.name = `${id} (on the inspection table)`;
      holder.userData.scaleFrame = 'local';
      const model = scans[i].clone(true);
      holder.add(model);
      this.root.add(holder);
      this.museum._lateRegister(id, holder);
      return { id, holder, model };
    });
    this.museum.setAway(list);
    this.pose = 'upright';
    this.current = null;
    this._layout();
    this._applyPose();
    this.setTags([]);
    if (this.trueSize) this._layoutTrueSize();
    this.onChange?.();
    return this.slots;
  }

  /** Clear the table (every object back in its case). */
  clear() {
    ++this._token;
    for (const s of this.slots) this._unregister(s);
    for (const s of this.slots) this.root.remove(s.holder);
    this.slots = [];
    this.current = null;
    this.museum.setAway([]);
    this.setTags([]);
    this.setTrueSize(false);
    this.measure.clear();
    if (this.magnifier.on) this.magnifier.setEnabled(false);
    if (this.rake.on) this.rake.setEnabled(false);
  }

  _unregister(slot) {
    const it = this.app.inspect?.items.get(slot.id);
    if (!it) return;
    it.roots = it.roots.filter((r) => r !== slot.holder);
    this.app.inspect.roots = this.app.inspect.roots.filter((r) => r !== slot.holder);
    if (it.active === slot.holder) it.active = it.roots[0];
  }

  /** Side by side along x with a gap proportional to their size. */
  _layout() {
    if (this.slots.length === 1) { this.slots[0].holder.position.set(0, 0, 0); return; }
    const widths = this.slots.map((s) => { const b = geometryBox(s.model).getSize(new THREE.Vector3()); return Math.max(b.x, b.z) * 1.05; });
    const gap = 0.05;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    let x = -total / 2;
    this.slots.forEach((s, i) => { s.holder.position.set(x + widths[i] / 2, 0, 0); x += widths[i] + gap; });
  }

  _applyPose() {
    for (const s of this.slots) {
      s.model.rotation.set(POSES[this.pose] || 0, 0, 0);
      s.model.position.set(0, 0, 0);
      s.holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(s.model);
      const c = box.getCenter(new THREE.Vector3());
      const local = s.holder.worldToLocal(c.clone());
      // Rest on the sweep (y = 0 of the stage), centred on the holder.
      s.model.position.set(-local.x, -(box.min.y - this.root.position.y) + 0.0005, -local.z);
    }
    this.root.updateMatrixWorld(true);
  }

  localBox(id) { const s = this.slots.find((x) => x.id === id); return s ? geometryBox(s.model) : new THREE.Box3(); }
  localSize(id) { return this.localBox(id).getSize(new THREE.Vector3()); }
  meshes() { const out = []; for (const s of this.slots) s.model.traverse((o) => { if (o.isMesh) out.push(o); }); return out; }
  worldBox() { const b = new THREE.Box3(); for (const s of this.slots) b.expandByObject(s.model); return b; }

  /** Turn the object(s) over (or back upright). */
  flip() {
    this.pose = this.pose === 'upright' ? 'flipped' : 'upright';
    this._applyPose();
    this.measure.clear();
    if (this.current) this._placeTags();
    if (this.trueSize) this._layoutTrueSize();
    this.onChange?.();
    return this.pose;
  }

  // ------------------------------------------------------------------ views
  /** Offset so the object sits beside the Now card (NDC). */
  _offset() {
    const lay = this.app.shell.layout;
    return lay === 'phone-portrait' ? { x: 0, y: 0.32 } : lay === 'phone-landscape' ? { x: 0.3, y: 0 } : { x: 0.28, y: 0.04 };
  }

  /** A rig view of `center` from the angles of a v2 yaw/elev, at `radius`, shifted beside the card. */
  viewOf(center, radius, yawDeg, elevDeg) {
    const { theta, phi } = viewAngles(yawDeg, elevDeg);
    const cam = this.engine.camera;
    const back = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
    const up = back.clone().cross(right).normalize();
    const off = this._offset();
    const th = Math.tan((cam.fov * DEG) / 2);
    const target = center.clone().addScaledVector(right, -off.x * radius * th * cam.aspect).addScaledVector(up, -off.y * radius * th);
    return { target: target.toArray(), radius, theta, phi };
  }

  /** Distance that fits a box at `frac` of the view height (and the narrower width on phones). */
  fitRadius(box, frac = 0.55) {
    const cam = this.engine.camera;
    const r = box.getBoundingSphere(new THREE.Sphere()).radius;
    const th = Math.tan((cam.fov * DEG) / 2);
    const fitH = r / (th * frac);
    const fitW = r / (th * Math.max(0.35, cam.aspect) * 0.62);
    return THREE.MathUtils.clamp(Math.max(fitH, fitW), 0.09, 3);
  }

  /**
   * Fraction of the canvas height and width a world box covers when the camera
   * stands at rig view `v` (plan 10 §3: an inspected object fills >= 35% of the
   * viewport height). Uses a copy of the camera, so it can be asked before flying.
   */
  coverage(box, v) {
    const cam = this.engine.camera.clone();
    const back = new THREE.Vector3(Math.sin(v.phi) * Math.sin(v.theta), Math.cos(v.phi), Math.sin(v.phi) * Math.cos(v.theta));
    const t = new THREE.Vector3().fromArray(v.target);
    cam.position.copy(t).addScaledVector(back, v.radius);
    cam.lookAt(t);
    cam.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { h: (y1 - y0) / 2, w: (x1 - x0) / 2, x0, x1, y0, y1 };
  }
  /** Room for the object beside the Now card: wanted height and the widest it may be (fractions of the canvas). */
  _frameRoom() {
    const lay = this.app.shell.layout;
    if (lay === 'phone-portrait') return { h: 0.4, w: 0.88 };
    if (lay === 'phone-landscape') return { h: 0.55, w: 0.56 };
    return { h: 0.45, w: 0.62 };
  }
  /**
   * The radius at which a box fills the wanted share of the view height from
   * this side, without growing wider than the room beside the card.
   */
  fitView(box, yaw, elev, room = this._frameRoom()) {
    const center = box.getCenter(new THREE.Vector3());
    const at = (e, y) => {
      let radius = this.fitRadius(box);
      for (let i = 0; i < 4; i++) {
        const c = this.coverage(box, this.viewOf(center, radius, y, e));
        if (!(c.h > 0) || !(c.w > 0)) break;
        // Projected size scales about as 1 / distance.
        radius *= Math.max(c.h / room.h, c.w / room.w);
        radius = THREE.MathUtils.clamp(radius, 0.09, 3);
      }
      return this.viewOf(center, radius, y, e);
    };
    const first = at(elev, yaw);
    if (this.coverage(box, first).h >= MIN_FRAME_H) return first;
    // A long, low object in a tall view (the key on a phone held upright) hits the
    // width limit before it fills 35% of the height: look down more steeply (up to
    // 50°), then also along its length, so its depth adds to its height on screen.
    let best = first, bestH = this.coverage(box, first).h;
    for (const y of [yaw, yaw + 90]) {
      for (let e = elev; e <= 50; e += 8) {
        const v = at(e, y); const h = this.coverage(box, v).h;
        if (h >= MIN_FRAME_H) return v;
        if (h > bestH) { best = v; bestH = h; }
      }
    }
    return best;
  }
  /** The whole object (or pair) from a preset side, framed by fitView. */
  frameAll(yaw = 0, elev = 14, duration = 1.0) {
    const box = this.worldBox();
    if (box.isEmpty()) return null;
    const v = this.fitView(box, yaw, elev);
    this.view.dist = v.radius;
    this.app.rig.flyTo(v, duration);
    return v;
  }

  preset(name) {
    const p = PRESET_VIEWS[name];
    if (!p) return null;
    if ((p.pose === 'flipped') !== (this.pose === 'flipped')) this.flip();
    this.frameAll(p.yaw, p.elev);
    return p.label;
  }

  /** The yaw (degrees) the camera currently sees the object from. */
  currentYaw() { return yawFromTheta(this.app.rig.state.theta); }

  /** True when the view shows the hotspot's side: same pose, camera within 50° of its yaw. */
  viewMatches(hs) {
    const dYaw = Math.abs(((this.currentYaw() - (hs.yaw ?? 0) + 540) % 360) - 180);
    return this.pose === (hs.pose || 'upright') && dYaw <= 50;
  }

  /** World position of a hotspot's mark (normalized point in the object's local box, as posed). */
  hotspotWorld(id, hs) {
    const slot = this.slots.find((s) => s.id === id);
    if (!slot) return null;
    const box = geometryBox(slot.model);
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

  /** Go to a point of interest: pose the object, move the camera to the side and distance it names. */
  async gotoHotspot(id, hs, duration = 1.0) {
    if (this.primary?.id !== id || this.slots.length !== 1) await this.show(id);
    if ((hs.pose || 'upright') !== this.pose) { this.pose = hs.pose || 'upright'; this._applyPose(); }
    this.current = { id, hs };
    const box = this.worldBox();
    const fit = this.fitRadius(box);
    const radius = Math.max(0.09, fit / (hs.zoom || 2.5));
    this.view.dist = radius;
    const point = this.hotspotWorld(id, hs);
    // Zoomed views aim at the mark; whole-object views (zoom ~1) at the centre.
    const center = (hs.zoom || 2.5) <= 1.05 ? box.getCenter(new THREE.Vector3()) : point;
    const fly = this.app.rig.flyTo(this.viewOf(center, radius, hs.yaw ?? 0, hs.elev ?? 20), duration);
    this._placeTags();
    this.measure.clear();
    await fly;
    if (this.magnifier.on) this.lensToHotspot();
  }

  /** Numbered tags for the current object's points of interest (shown during the inspect step). */
  setTags(list) {
    this._tagList = list || [];
    this._placeTags();
  }

  _placeTags() {
    for (const c of [...this.tags.children]) { this.tags.remove(c); c.material.map.dispose(); c.material.dispose(); }
    const pid = this.primary?.id;
    (this._tagList || []).forEach((t, i) => {
      if (t.objectId !== pid || (t.hs.pose || 'upright') !== this.pose) return;
      const w = this.hotspotWorld(t.objectId, t.hs);
      if (!w) return;
      const s = tagSprite(t.n ?? i + 1);
      s.position.copy(w);
      s.userData.findingId = t.id;
      this.tags.add(s);
    });
  }

  lensToHotspot({ follow = true } = {}) {
    const cur = this.current;
    // Until the learner moves the lens, it stays on the mark while the camera settles.
    if (follow) this.lensFollow = true;
    if (!this.magnifier.on || !cur || this.primary?.id !== cur.id) return;
    const pt = this.hotspotScreen(cur.id, cur.hs);
    if (pt) this.magnifier.moveTo(pt.x, pt.y);
  }

  // ------------------------------------------------------------------ compare, true size
  async setCompare(id) {
    const primary = this.primary?.id;
    if (!primary) return;
    this.compareId = id || null;
    await this.show(id ? [primary, id] : primary);
    this.frameAll(0, 18);
  }

  setTrueSize(on) {
    this.trueSize = Boolean(on) && this.slots.length > 0;
    if (!this.trueSize) { this.museum.placeScaleRefs(null); return false; }
    this._layoutTrueSize();
    // Frame the object and the three references, so the coin and card are in shot.
    const box = this.worldBox();
    for (const r of [this.museum.scaleCard, this.museum.quarter, this.museum.ruler]) box.expandByObject(r);
    // Comparison view: from 55° above, the object and the card, coin and ruler at one scale, filling the room beside the card.
    const v = this.fitView(box, 0, 55, { ...this._frameRoom(), h: 0.6 });
    this.view.dist = v.radius;
    this.app.rig.flyTo(v, 1.0);
    return true;
  }

  _layoutTrueSize() { this.museum.placeScaleRefs(this.worldBox()); }

  // ------------------------------------------------------------------ hi-res scans for the magnifier
  async loadHiRes(id) {
    const entry = this.models[id];
    if (!entry?.hiRes) return false;
    if (!this.hiRes.has(id)) {
      this.hiRes.set(id, loadGLB(this.engine.renderer, entry.hiRes).then((g) => {
        const root = g.scene;
        root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        root.userData.hiRes = true;
        return root;
      }).catch(() => null));
    }
    const hi = await this.hiRes.get(id);
    if (!hi) return false;
    const base = await this.museum.scan(id);
    const f = normaliseFactor(geometryBox(hi), geometryBox(base));
    if (f !== 1) hi.traverse((o) => { if (o.isMesh) { o.geometry.scale(f, f, f); o.geometry.computeBoundingBox(); } });
    const slot = this.slots.find((s) => s.id === id);
    if (slot && this.hiResWanted === id && slot.model !== hi) this._swapModel(slot, hi);
    return true;
  }

  async restoreBase(id) {
    this.hiResWanted = null;
    const slot = this.slots.find((s) => s.id === id && s.model.userData.hiRes);
    if (!slot) return;
    const base = await this.museum.scan(id);
    this._swapModel(slot, base.clone(true));
  }

  _swapModel(slot, model) {
    slot.holder.remove(slot.model);
    slot.model = model;
    slot.holder.add(model);
    this._applyPose();
    if (this.current) this._placeTags();
    this.onChange?.();
  }

  // ------------------------------------------------------------------ the inspection lamp
  /** What the lamp lights: the chosen spot's mark, else the selected (primary) object's centre. */
  lampTarget() {
    if (this.current) { const p = this.hotspotWorld(this.current.id, this.current.hs); if (p) return p; }
    const slot = this.primary;
    if (slot) return new THREE.Box3().setFromObject(slot.model).getCenter(new THREE.Vector3());
    return STAGE_POS.clone().add(new THREE.Vector3(0, 0.04, 0));
  }
  /** The lamp aims at and lights the object on the table; it parks over the empty sweep. */
  _lampUpdate(dt) {
    const M = this.museum;
    if (!this.lamp && M.rakeLamp) {
      // Size check uses the rest pose: the articulated lamp's live box changes as it moves.
      // Measured in the lamp's own axes (its yaw on the table would inflate a world box).
      const yaw = M.rakeLamp.quaternion.clone();
      M.rakeLamp.quaternion.identity();
      M.rakeLamp.updateMatrixWorld(true);
      M.rakeLamp.userData.restSize = new THREE.Box3().setFromObject(M.rakeLamp).getSize(new THREE.Vector3()).toArray();
      M.rakeLamp.quaternion.copy(yaw);
      M.rakeLamp.updateMatrixWorld(true);
      delete M.rakeLamp.userData.scaleFrame;
      this.lamp = new LampRig(M.rakeLamp, { light: this.rake.light, reduced: () => document.documentElement.dataset.motion === 'reduced' });
    }
    if (!this.lamp?.ok) return;
    const lit = this.slots.length > 0;
    const target = this.lampTarget();
    const box = this.primary ? new THREE.Box3().setFromObject(this.primary.model) : null;
    const objectRadius = box ? Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2 : 0.08;
    const st = this.rake.state;
    const sig = [target.x, target.y, target.z, objectRadius].map((v) => v.toFixed(4)).join(',') + `|${st.azimuth}|${this.rake.elevationNow}`;
    if (sig !== this._lampSig) {
      this._lampSig = sig;
      const local = this.root.worldToLocal(target.clone());
      const plan = lampPlan({ azimuth: st.azimuth, elevation: this.rake.elevationNow }, local, { objectRadius });
      const base = this.root.localToWorld(plan.base.clone());
      base.y = this.root.getWorldPosition(new THREE.Vector3()).y;
      this.lamp.aim(target, this.root.localToWorld(plan.light.clone()), base);
    }
    this.lamp.update(dt);
    this.rake.ambientLevel = lit ? 1.6 : 0;
    this.rake.light.castShadow = lit;
    this.rake.syncIntensity();
  }

  /** Per frame: the lamp, then the lens (after the rig has moved the camera). */
  update() {
    const now = performance.now();
    const dt = Math.min(0.1, ((now - (this._t || now)) / 1000));
    this._t = now;
    this._lampUpdate(dt);
    const sig = this._shadowSignature();
    if (sig !== this._shadowSig) { this._shadowSig = sig; this.engine.renderer.shadowMap.needsUpdate = true; }
    if (this.lensFollow && this.magnifier.on) this.lensToHotspot({ follow: false });
    this.magnifier.update();
  }
}
