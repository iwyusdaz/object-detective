/**
 * Two-point measurement on the scanned mesh (true scale: the Smithsonian
 * scans are in metres). Pointer: click two points on the object. Keyboard /
 * text mode: preset point pairs per object (content/objects.json
 * measurePresets) defined in the object's normalized bounding box.
 * Results in centimetres and inches.
 * @module systems/measure
 */
import * as THREE from 'three';

export const CM_PER_INCH = 2.54;

export function formatLength(metres) {
  const cm = metres * 100;
  const inches = cm / CM_PER_INCH;
  return { cm: +cm.toFixed(1), inches: +inches.toFixed(2), text: `${cm.toFixed(1)} cm (${inches.toFixed(2)} in)` };
}

/** Parse "1 7/8 in" / "8 3/8" style mixed fractions into a number (record measurements). */
export function parseInches(s) {
  const parts = String(s).replace(/in\.?/g, '').trim().split(/\s+/);
  let total = 0;
  for (const p of parts) {
    if (p.includes('/')) { const [n, d] = p.split('/').map(Number); total += n / d; } else if (p) total += Number(p);
  }
  return total;
}

/** Relative difference between a measured and a recorded length. */
export function relativeDifference(measuredCm, recordCm) {
  return Math.abs(measuredCm - recordCm) / recordCm;
}

export class Measure {
  constructor(engine, inspection) {
    this.engine = engine;
    this.inspection = inspection;
    this.points = [];
    this.active = false;
    this.group = new THREE.Group();
    this.group.name = 'measure';
    this.group.renderOrder = 20;
    engine.scene.add(this.group);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffd166', depthTest: false });
    this._dotGeo = new THREE.SphereGeometry(0.0025, 16, 12);
    this._dotMat = mat;
    this._lineMat = new THREE.LineBasicMaterial({ color: '#ffd166', depthTest: false });
    this.ray = new THREE.Raycaster();
    this.last = null;
    this.onMeasured = null;
  }

  clear() {
    this.points = [];
    this.group.clear();
    this.last = null;
  }

  _dot(p) {
    const d = new THREE.Mesh(this._dotGeo, this._dotMat);
    d.position.copy(p);
    d.renderOrder = 21;
    // keep the dot readable at any zoom level
    const s = Math.max(1, this.inspection.view.dist / 0.35);
    d.scale.setScalar(s);
    this.group.add(d);
  }

  /** Pointer pick at normalized device coords. Returns the hit point or null. */
  pick(ndcX, ndcY) {
    this.ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.engine.camera);
    const hits = this.ray.intersectObjects(this.inspection.meshes(), false);
    if (!hits.length) return null;
    return this.addPoint(hits[0].point, hits[0].object);
  }

  addPoint(p, mesh = null) {
    if (this.points.length >= 2) this.clear();
    let id = null;
    mesh?.traverseAncestors((a) => { if (a.userData.id && !id) id = a.userData.id; });
    this.points.push({ p: p.clone(), id });
    this._dot(p);
    if (this.points.length === 2) return this._finish('pointer');
    return null;
  }

  /** Preset pair: { id, label, a: [u,v,w], b: [u,v,w] } in the object's normalized local box. */
  preset(objectId, preset) {
    const slot = this.inspection.slots.find((s) => s.id === objectId);
    if (!slot) return null;
    const box = this.inspection.localBox(objectId);
    const toWorld = (n) => {
      const v = new THREE.Vector3(
        THREE.MathUtils.lerp(box.min.x, box.max.x, n[0]),
        THREE.MathUtils.lerp(box.min.y, box.max.y, n[1]),
        THREE.MathUtils.lerp(box.min.z, box.max.z, n[2]),
      );
      slot.model.updateMatrixWorld(true);
      return slot.model.localToWorld(v);
    };
    this.clear();
    this.points.push({ p: toWorld(preset.a), id: objectId }, { p: toWorld(preset.b), id: objectId });
    for (const pt of this.points) this._dot(pt.p);
    return this._finish('preset', preset);
  }

  _finish(method, preset = null) {
    const [a, b] = this.points;
    const geo = new THREE.BufferGeometry().setFromPoints([a.p, b.p]);
    const line = new THREE.Line(geo, this._lineMat);
    line.renderOrder = 21;
    this.group.add(line);
    const metres = a.p.distanceTo(b.p);
    this.last = { metres, ...formatLength(metres), objectId: a.id || b.id, method, presetId: preset?.id || null };
    this.onMeasured?.(this.last);
    return this.last;
  }
}
