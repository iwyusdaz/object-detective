/**
 * lamp-rig.js — the inspection lamp as an articulated arm (owner G2 feedback
 * 2026-11-07, §2: "aim at and light the object being inspected").
 *
 * The Poly Haven desk_lamp_arm_01 model (CC0) is one mesh, but its parts are
 * separate mesh islands: the clamp base, the lower arm (two rods, a link rod
 * and springs), the elbow hub with the upper arm, and the head (shade, bulb
 * holder, swivel). splitLamp() groups the islands by where they sit in the
 * model and rebuilds them as a joint chain:
 *   base (clamped to the table edge, turns about its post) → shoulder hinge →
 *   elbow hinge → head (the shade's swivel: turn and tilt)
 * Shoulder and elbow turn about the model's x axis, as on the real lamp.
 *
 * Inverse kinematics: lampPlan() says where the shade mouth should be (at the
 * azimuth and elevation around the target that the raking-light controls set)
 * and clamps the base to the left or right table edge on that side (it is a
 * clamp lamp; the sweep's rise fills the back edge). LampRig.aim() turns the
 * head so the shade axis points at the target, finds the head swivel position
 * that puts the mouth on the light position, turns the base post toward it,
 * and solves the two-link arm (elbow up) to reach it.
 * LampRig eases every joint toward the solution (no snapping, unless reduced
 * motion is on) and puts the spotlight at the shade mouth, aimed at the target.
 *
 * Measured from the model (scripts in tmp/, not shipped): shoulder pin at
 * (y 0.026, z 0), elbow at (0.370, 0.275), head swivel at (0.693, -0.080),
 * shade mouth at (0.610, -0.215) with its axis (y -0.899, z -0.438), all in
 * metres in the model frame (y up, base at y = -0.088 before resting on the floor).
 * @module od/lamp-rig
 */
import * as THREE from 'three';

/** Joint geometry in the model frame, (z, y) in metres. */
export const LAMP = Object.freeze({
  S: [0, 0.026],
  E: [0.275, 0.370],
  H: [-0.080, 0.693],
  M: [-0.215, 0.610],
  AXIS: [-0.438, -0.899],
});
const ang = ([z, y]) => Math.atan2(y, z);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (a) => Math.hypot(a[0], a[1]);
const rot = ([z, y], a) => [z * Math.cos(a) - y * Math.sin(a), z * Math.sin(a) + y * Math.cos(a)];
export const L1 = len(sub(LAMP.E, LAMP.S));
export const L2 = len(sub(LAMP.H, LAMP.E));
const REST = { a1: ang(sub(LAMP.E, LAMP.S)), a2: ang(sub(LAMP.H, LAMP.E)), a3: ang(LAMP.AXIS) };

/** Which joint group a mesh island belongs to, from its bounding box (model frame). */
export function classifyIsland(min, max) {
  const cy = (min[1] + max[1]) / 2, cz = (min[2] + max[2]) / 2;
  if (cy > 0.6 && cz < -0.03) return 'head';
  if (max[1] < 0.11) return 'base';
  if (min[1] < 0.2) return 'lower';
  return 'upper';
}

/** Split the lamp mesh's triangles into the four joint groups (by connected islands). */
export function splitIndices(position, index) {
  const n = position.count;
  const key = new Map(); const rep = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(position.getX(i) * 1e4)},${Math.round(position.getY(i) * 1e4)},${Math.round(position.getZ(i) * 1e4)}`;
    if (!key.has(k)) key.set(k, i);
    rep[i] = key.get(k);
  }
  const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const I = index.array;
  for (let t = 0; t < I.length; t += 3) {
    const a = find(rep[I[t]]); par[find(rep[I[t + 1]])] = a; par[find(rep[I[t + 2]])] = a;
  }
  const box = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(rep[i]);
    let b = box.get(r);
    if (!b) box.set(r, (b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
    const v = [position.getX(i), position.getY(i), position.getZ(i)];
    for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], v[k]); b.max[k] = Math.max(b.max[k], v[k]); }
  }
  const group = new Map(); for (const [r, b] of box) group.set(r, classifyIsland(b.min, b.max));
  const out = { base: [], lower: [], upper: [], head: [] };
  for (let t = 0; t < I.length; t += 3) out[group.get(find(rep[I[t]]))].push(I[t], I[t + 1], I[t + 2]);
  return out;
}

/**
 * Inverse kinematics in the arm plane. `t` is the target and `p` the wanted
 * shade-mouth position, both (z, y) in the model frame after the base yaw has
 * put the target in the arm plane. Returns absolute link angles and whether
 * the mouth could be reached exactly.
 */
export function solveArm(p, t) {
  const d = sub(t, p);
  const a3 = ang(d.map((x) => x / (len(d) || 1)));
  // Head swivel position that puts the mouth at p with the shade along a3.
  const h = sub(p, rot(sub(LAMP.M, LAMP.H), a3 - REST.a3));
  const sh = sub(h, LAMP.S);
  let r = len(sh);
  const lo = Math.abs(L1 - L2) + 0.005, hi = L1 + L2 - 0.005;
  const reached = r >= lo && r <= hi;
  r = THREE.MathUtils.clamp(r, lo, hi);
  const base = ang(sh);
  // Elbow on the same side as at rest (above and behind the line shoulder → head).
  const k = Math.acos(THREE.MathUtils.clamp((L1 * L1 + r * r - L2 * L2) / (2 * L1 * r), -1, 1));
  const a1 = base - k;
  const e = [LAMP.S[0] + L1 * Math.cos(a1), LAMP.S[1] + L1 * Math.sin(a1)];
  const hh = [LAMP.S[0] + r * Math.cos(base), LAMP.S[1] + r * Math.sin(base)];
  const a2 = ang(sub(hh, e));
  return { a1, a2, a3, reached };
}

/** Joint rotations (rotation.x of shoulder, elbow, head groups) for absolute link angles. */
export function jointRotations({ a1, a2, a3 }) {
  // rotation.x = a turns a (z, y) direction by -a.
  const d1 = a1 - REST.a1, d2 = a2 - REST.a2, d3 = a3 - REST.a3;
  return { shoulder: -d1, elbow: -(d2 - d1), head: -(d3 - d2) };
}

/**
 * Where the base clamps and where the light should be for an azimuth/elevation
 * around the target (stage-local metres, y up, table top at y = 0). The light
 * sits on the requested side at a working distance; the base clamps to the left
 * table edge for light from the left half (azimuth 180-360°), to the right edge
 * otherwise, level with the light along the edge.
 */
export function lampPlan({ azimuth, elevation }, target, { objectRadius = 0.08, edges } = {}) {
  const a = (azimuth * Math.PI) / 180, e = (elevation * Math.PI) / 180;
  const dir = [Math.sin(a), Math.cos(a)];
  const E = edges || { x: 0.66, minZ: -0.38, maxZ: 0.3 };
  const r = Math.max(0.24, objectRadius * 1.6 + 0.12);
  const light = new THREE.Vector3(target.x + dir[0] * r * Math.cos(e), target.y + r * Math.sin(e), target.z + dir[1] * r * Math.cos(e));
  const side = dir[0] < 0 ? -1 : 1;
  const base = new THREE.Vector3(side * E.x, 0, THREE.MathUtils.clamp(target.z + dir[1] * 0.45, E.minZ, E.maxZ));
  return { base, light, side };
}

export class LampRig {
  /**
   * @param {THREE.Object3D} holder  the lamp as loaded (restOnFloor holder), child of the scene
   * @param {object} o
   * @param {THREE.SpotLight} o.light  the lamp's spotlight
   * @param {() => boolean} [o.reduced] reduced motion on
   */
  constructor(holder, { light, reduced = () => false }) {
    this.holder = holder;
    this.light = light;
    this.reduced = reduced;
    // The model is one mesh with two primitives: the lamp body and the bulb (its own material).
    const meshes = [];
    holder.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const mesh = meshes.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
    const extras = meshes.filter((m) => m !== mesh);
    this.ok = Boolean(mesh?.geometry?.index);
    if (!this.ok) return;
    const geo = mesh.geometry;
    const parts = splitIndices(geo.attributes.position, geo.index);
    const make = (idx, name) => {
      const g = new THREE.BufferGeometry();
      for (const [k, v] of Object.entries(geo.attributes)) g.setAttribute(k, v);
      g.setIndex(idx);
      g.boundingBox = geo.boundingBox; g.boundingSphere = geo.boundingSphere;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mesh.material);
      m.name = `lamp ${name}`;
      m.castShadow = mesh.castShadow; m.receiveShadow = mesh.receiveShadow;
      return m;
    };
    const parent = mesh.parent;
    const arm = new THREE.Group();
    arm.name = 'lamp joints';
    arm.position.copy(mesh.position); arm.quaternion.copy(mesh.quaternion); arm.scale.copy(mesh.scale);
    parent.remove(mesh);
    parent.add(arm);
    const pivot = (zy, parentZy, name) => { const g = new THREE.Group(); g.name = name; g.position.set(0, zy[1] - parentZy[1], zy[0] - parentZy[0]); return g; };
    const at = (m, zy) => { m.position.set(0, -zy[1], -zy[0]); return m; };
    this.shoulder = pivot(LAMP.S, [0, 0], 'lamp shoulder');
    this.elbow = pivot(LAMP.E, LAMP.S, 'lamp elbow');
    this.head = pivot(LAMP.H, LAMP.E, 'lamp head');
    arm.add(make(parts.base, 'base'), this.shoulder);
    this.shoulder.add(at(make(parts.lower, 'lower arm'), LAMP.S), this.elbow);
    this.elbow.add(at(make(parts.upper, 'upper arm'), LAMP.E), this.head);
    this.head.add(at(make(parts.head, 'head'), LAMP.H));
    // Other primitives (the bulb) join the group their box falls in.
    const groups = { base: [arm, [0, 0]], lower: [this.shoulder, LAMP.S], upper: [this.elbow, LAMP.E], head: [this.head, LAMP.H] };
    for (const m of extras) {
      if (m.parent !== parent) continue;
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox;
      const [g, zy] = groups[classifyIsland(b.min.toArray(), b.max.toArray())];
      parent.remove(m);
      g.add(at(m, zy));
    }
    // Light anchor at the shade mouth, looking along the shade axis.
    this.mouth = new THREE.Object3D();
    this.mouth.position.set(0, LAMP.M[1] - LAMP.H[1], LAMP.M[0] - LAMP.H[0]);
    this.head.add(this.mouth);
    this.arm = arm;
    this.cur = null; // eased state { x, z, yaw, shoulder, elbow, head }
    this.goal = null;
    this.target = new THREE.Vector3();
    this.reached = true;
    this._v = new THREE.Vector3();
  }

  /**
   * Aim at `target` (world) from `lightWorld`, with the base clamped at
   * `baseWorld` (both from lampPlan, in world space). Eases there in update().
   */
  aim(target, lightWorld, baseWorld) {
    if (!this.ok) return;
    this.target.copy(target);
    const h = this.holder;
    const parentInv = h.parent ? h.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
    const B = baseWorld.clone().applyMatrix4(parentInv);
    const T = target.clone().applyMatrix4(parentInv), P = lightWorld.clone().applyMatrix4(parentInv);
    // Head: turn (about the vertical) and tilt so the shade axis points from P at T.
    const d = T.clone().sub(P);
    const dh = Math.hypot(d.x, d.z);
    const hyaw = Math.atan2(-d.x, -d.z);
    const htilt = REST.a3 - Math.atan2(d.y, -dh);
    const qHead = new THREE.Quaternion().setFromEuler(new THREE.Euler(htilt, hyaw, 0, 'YXZ'));
    // Head swivel position that puts the mouth on P (model offsets; the arm frame only adds the base yaw).
    const off = new THREE.Vector3(0, LAMP.M[1] - LAMP.H[1], LAMP.M[0] - LAMP.H[0]).applyQuaternion(qHead);
    const H = P.clone().sub(off);
    // Base post turns so the arm plane (model -z) points at the head swivel.
    const yaw = Math.atan2(-(H.x - B.x), -(H.z - B.z));
    // Head swivel in the arm's (z, y) plane: model y has the clamp's 0.088 m below the table top.
    const yOff = this._yOffset();
    const hz = -Math.hypot(H.x - B.x, H.z - B.z), hy = H.y - B.y - yOff;
    const sol = this._solve([hz, hy]);
    this.reached = sol.reached;
    const d1 = sol.a1 - REST.a1, d2 = sol.a2 - REST.a2;
    // The holder's origin is the lamp's box centre; place it so the model origin (the post) is on B.
    const o = this._origin ??= (() => { const w = this.arm.getWorldPosition(new THREE.Vector3()); h.worldToLocal(w); return w; })();
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hx = B.x - (o.x * c + o.z * s), hzp = B.z - (-o.x * s + o.z * c);
    this.goal = { x: hx, z: hzp, yaw, shoulder: -d1, elbow: -(d2 - d1), hyaw, htilt };
    if (!this.cur) this.cur = { x: h.position.x, z: h.position.z, yaw: h.rotation.y, shoulder: 0, elbow: 0, hyaw: h.rotation.y, htilt: 0 };
    this.elbowY = sol.elbowY + B.y + yOff;
  }

  _yOffset() {
    if (this._yOff === undefined) { const w = this.arm.getWorldPosition(new THREE.Vector3()); this.holder.worldToLocal(w); this._yOff = w.y; }
    return this._yOff;
  }

  /** Two-link arm from the shoulder to the head swivel at hs (z, y), elbow up. */
  _solve(hs) {
    const sh = sub(hs, LAMP.S);
    let r = len(sh);
    const lo = Math.abs(L1 - L2) + 0.005, hi = L1 + L2 - 0.005;
    const reached = r >= lo && r <= hi;
    r = THREE.MathUtils.clamp(r, lo, hi);
    const base = ang(sh);
    const k = Math.acos(THREE.MathUtils.clamp((L1 * L1 + r * r - L2 * L2) / (2 * L1 * r), -1, 1));
    const tip = [LAMP.S[0] + r * Math.cos(base), LAMP.S[1] + r * Math.sin(base)];
    // Of the two elbow positions, the higher one (a lamp's elbow never folds under the table).
    const opts = [base - k, base + k].map((a1) => {
      const e = [LAMP.S[0] + L1 * Math.cos(a1), LAMP.S[1] + L1 * Math.sin(a1)];
      return { a1, a2: ang(sub(tip, e)), elbowY: e[1] };
    }).sort((p, q) => q.elbowY - p.elbowY);
    return { ...opts[0], reached };
  }

  /** True while the joints are still easing toward the goal. */
  get moving() {
    if (!this.goal || !this.cur) return false;
    return Object.keys(this.goal).some((k) => Math.abs(this.goal[k] - this.cur[k]) > 1e-4);
  }

  update(dt) {
    if (!this.ok || !this.goal) return;
    const c = this.cur, g = this.goal;
    // Exponential ease, about 0.7 s to settle; a lamp is moved by hand, not snapped.
    const k = this.reduced() ? 1 : 1 - Math.exp(-dt * 5);
    let dy = ((g.yaw - c.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    c.yaw += dy * k;
    let dh = ((g.hyaw - c.hyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    c.hyaw += dh * k;
    for (const key of ['x', 'z', 'shoulder', 'elbow', 'htilt']) c[key] += (g[key] - c[key]) * k;
    for (const key of Object.keys(g)) if (Math.abs(g[key] - c[key]) < 1e-5) c[key] = g[key];
    const h = this.holder;
    h.position.x = c.x; h.position.z = c.z; h.rotation.y = c.yaw;
    this.shoulder.rotation.x = c.shoulder; this.elbow.rotation.x = c.elbow;
    // The head's world orientation is its own (swivel): undo the arm's rotation above it.
    h.updateMatrixWorld(true);
    const parentQ = h.parent ? h.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    const want = parentQ.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(c.htilt, c.hyaw, 0, 'YXZ')));
    this.head.quaternion.copy(this.elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want));
    h.updateMatrixWorld(true);
    if (this.light) {
      this.mouth.getWorldPosition(this.light.position);
      this.light.target.position.copy(this.target);
      this.light.target.updateMatrixWorld();
    }
  }

  /** World direction the shade points (for tests). */
  axisWorld(out = new THREE.Vector3()) {
    const q = this.head.getWorldQuaternion(new THREE.Quaternion());
    return out.set(0, LAMP.AXIS[1], LAMP.AXIS[0]).normalize().applyQuaternion(q);
  }
}
