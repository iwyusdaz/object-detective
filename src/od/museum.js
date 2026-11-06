/**
 * museum.js — the Lantern Museum (fictional) after hours, v3 (plan 10 §6.2).
 *
 * A 12 x 12 m gallery (x -6..6, z -8..4, 4.2 m ceiling), 1 unit = 1 m:
 *  - north wall: two tall rain-streaked windows onto a wet street and the lit
 *    building opposite, curtains, a security camera in the corner;
 *  - nine display cases: the six Smithsonian CC0 scans of the case in tall
 *    vitrines, three CC0 "neighbouring exhibits" in low bench cases, each with
 *    a printed label card and a track spotlight;
 *  - west wall: Samuel Morse's "The Muse" (Met, CC0) with a bench facing it,
 *    Elliott's portrait of Mathew Brady, the grandfather clock;
 *  - south wall: the entrance with its exit sign and the reception desk;
 *  - east wall: the evidence board and the doorway to the archive corner
 *    (drawer cabinet, reference shelves) where the night guard's torch passes;
 *  - the inspection table with its photo sweep, the draft label card, the
 *    magnifier, the raking-light lamp and the scale card.
 * Every catalog object is registered with the inspect system at real size.
 * Detail that is not needed before the first interaction (scans, props, the
 * 2048 px paintings) streams afterwards (plan §7 download gate).
 * @module od/museum
 */
import * as THREE from 'three';
import { Parts, box, cyl, pbr, lazyTexture, loadGLB, cardTexture, contactShadow, restOnFloor, shadows, pendingTextures, V } from './kit.js';

export const ROOM = { minX: -6, maxX: 6, minZ: -8, maxZ: 4, H: 4.2 };
export const TABLE = { x: 0, z: 0.45, top: 0.9, w: 1.4, d: 0.8 };
/** Where an object rests on the inspection table (the stage origin). */
export const STAGE_POS = new THREE.Vector3(0, TABLE.top, 0.5);
const DEG = Math.PI / 180;

/** Case objects in the tall vitrines (record ids) and the neighbouring exhibits in bench cases. */
export const VITRINES = [
  { id: 'morse-vail-key', x: -2.4, z: -6.1, label: ['TELEGRAPH KEY', 'Alfred Vail, 1844', 'Wood and brass'] },
  { id: 'chester-relay', x: 0, z: -6.1, label: ['TELEGRAPH RELAY', 'Charles T. Chester, about 1860', 'Brass, marble, copper'] },
  { id: 'davenport-motor', x: 2.4, z: -6.1, label: ['ELECTRIC MOTOR', 'Thomas Davenport, about 1837', 'Patent model, US 132'] },
  { id: 'henry-trough-battery', x: -3.6, z: -3.5, label: ['TROUGH BATTERY', 'Dated 1832', 'Maker not recorded'] },
  { id: 'tangent-galvanometer', x: 0, z: -3.3, label: ['TANGENT GALVANOMETER', 'Western Electric, about 1870'] },
  { id: 'page-induction-coil', x: 3.6, z: -3.5, label: ['INDUCTION COIL', 'Charles G. Page, about 1868', 'Patent model, US 76654'] },
];
export const BENCH_CASES = [
  { id: 'mattey-stereoscope', x: 1.9, z: 3.05, w: 0.7, label: ['STEREOSCOPE', 'A. Mattey, Paris, 1905–1920'] },
  { id: 'elkins-refrigerator-patent-model', x: 3.05, z: 3.05, w: 0.7, label: ['REFRIGERATOR PATENT MODEL', 'Thomas Elkins, 1879'] },
  { id: 'lincoln-patent-model', x: 4.45, z: 3.05, w: 0.95, label: ['PATENT MODEL', 'Abraham Lincoln, 1849', 'Lifting boats over shoals'] },
];

export class Museum {
  /**
   * @param {object} app  the v3 app (engine, inspect, motion, shell)
   * @param {object} o
   * @param {object} o.assets    content/assets-v3.json
   * @param {object} o.textures  content/textures.json (v2 floor/plaster/fabric sets)
   * @param {object} o.models    content/models.json (case scans)
   * @param {object} o.props     public/assets/models/manifest.json (v2 Poly Haven props)
   * @param {string} o.hdri
   */
  constructor(app, o) {
    this.app = app;
    this.o = o;
    this.renderer = app.engine.renderer;
    this.scene = app.engine.scene;
    this.root = new THREE.Group();
    this.root.name = 'lantern-museum';
    this.scene.add(this.root);
    this.colliders = [];
    this.registered = new Map(); // id -> roots[]
    this.updaters = [];
    this.caseHolders = new Map(); // record id -> { holder, placard, scan }
    this.scans = new Map(); // record id -> Promise<Object3D> (base scan, shared with the stage)
    this.mode = 'gallery';
    this._mats();
  }

  // ------------------------------------------------------------------ materials
  _mats() {
    const R = this.renderer, A = this.o.assets.textures, T = this.o.textures;
    const set = (k) => A[k].maps ? Object.fromEntries(Object.entries(A[k].maps).map(([m, v]) => [m, v.file])) : null;
    const v2 = (k) => ({ Color: T[`${k}_Color`], NormalGL: T[`${k}_NormalGL`], Roughness: T[`${k}_Roughness`] });
    this.sets = { wood: set('Wood051'), marble: set('Marble012'), cork: set('Cork002'), metal: set('Metal048A'), fabric: set('Fabric085'), paper: set('Paper004'), smudge: set('Fingerprints002') };
    const M = (o) => Object.assign(o, { name: o.name });
    this.M = {
      floor: pbr(R, v2('WoodFloor043'), { repeat: [6, 6], roughness: 0.55, name: 'parquet' }),
      plaster: pbr(R, v2('Plaster001'), { repeat: [4, 2], color: new THREE.Color('#c9c2b2'), name: 'plaster' }),
      plasterArchive: pbr(R, v2('Plaster001'), { repeat: [3, 2], color: new THREE.Color('#5f7a66'), name: 'archive-plaster' }),
      ceiling: pbr(R, v2('Plaster001'), { repeat: [5, 5], color: new THREE.Color('#5a5650'), roughness: 0.95, name: 'ceiling' }),
      felt: pbr(R, v2('Fabric026'), { repeat: [1, 1], color: new THREE.Color('#3b4250'), name: 'felt' }),
      wood: pbr(R, this.sets.wood, { repeat: [1, 1], color: new THREE.Color('#6b4a33'), roughness: 0.6, name: 'wood' }),
      woodDark: pbr(R, this.sets.wood, { repeat: [2, 1], color: new THREE.Color('#3a2418'), roughness: 0.5, name: 'wood-dark' }),
      wainscot: pbr(R, this.sets.wood, { repeat: [6, 1], color: new THREE.Color('#5b2a22'), roughness: 0.48, name: 'wainscot' }),
      marble: pbr(R, this.sets.marble, { repeat: [1, 1], roughness: 0.35, name: 'marble' }),
      brass: pbr(R, this.sets.metal, { repeat: [1, 1], color: new THREE.Color('#c9a466'), metalness: 1, roughness: 0.32, name: 'brass' }),
      gilt: pbr(R, this.sets.metal, { repeat: [2, 2], color: new THREE.Color('#b8893f'), metalness: 1, roughness: 0.38, name: 'gilt' }),
      steel: pbr(R, this.sets.metal, { repeat: [1, 1], color: new THREE.Color('#40434a'), metalness: 0.9, roughness: 0.42, name: 'steel' }),
      blackMetal: pbr(R, this.sets.metal, { repeat: [1, 1], color: new THREE.Color('#15161a'), metalness: 0.7, roughness: 0.5, name: 'black-metal' }),
      curtain: pbr(R, this.sets.fabric, { repeat: [2, 4], color: new THREE.Color('#6e1f26'), roughness: 0.9, side: THREE.DoubleSide, name: 'curtain' }),
      cork: pbr(R, this.sets.cork, { repeat: [2, 1.5], roughness: 0.95, name: 'cork' }),
      paper: pbr(R, this.sets.paper, { repeat: [1, 1], color: new THREE.Color('#efe7d6'), roughness: 0.9, name: 'paper' }),
      sweep: pbr(R, this.sets.paper, { repeat: [2, 2], color: new THREE.Color('#8a8b8d'), roughness: 0.95, side: THREE.DoubleSide, name: 'sweep' }),
    };
    // Display-case glass: thin, reflective, with faint fingerprints in its roughness.
    const smudge = lazyTexture(R, this.sets.smudge.Roughness, { srgb: false, repeat: [1, 1] });
    this.M.glass = new THREE.MeshPhysicalMaterial({ name: 'case-glass', color: '#ffffff', metalness: 0, roughness: 0.06, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
    smudge.ready.then((t) => { if (t) { this.M.glass.roughnessMap = t; this.M.glass.needsUpdate = true; } });
    this.M.windowGlass = new THREE.MeshPhysicalMaterial({ name: 'window-glass', color: '#b9c8d8', roughness: 0.05, transparent: true, opacity: 0.12, envMapIntensity: 1.2, depthWrite: false });
    void M;
  }

  // ------------------------------------------------------------------ build
  /**
   * First tier: everything a visitor sees before the first interaction: the
   * room, cases, paintings (1024 px) and the light props. Phones load fewer
   * props first (8 MB budget); scans and the rest stream after the first input.
   */
  async build({ phone = false } = {}) {
    this.phone = phone;
    this.scene.background = new THREE.Color('#05070b');
    this._room();
    this._windowsAndStreet();
    this._curtains();
    this._wainscot();
    this._cases();
    this._table();
    this._paintings();
    this._reception();
    this._entrance();
    this._evidenceBoard();
    this._archive();
    this._lights();
    this._trackFixtures();
    this._dust();
    this._torch();
    this._registerAll();
    this.setMode('gallery');
    const first = this.phone ? ['clock', 'bookshelf', 'magnifier', 'camera', 'bench', 'lamp'] : ['clock', 'bookshelf', 'magnifier', 'camera', 'bench', 'lamp', 'chandelier', 'cabinet'];
    this._firstProps = this._props(first);
    if (!this.phone) for (const b of BENCH_CASES.slice(0, 2)) this._dressBenchCase(b);
    // Reflections come from the gallery itself (a cube render of this room), not a downloaded HDRI.
    Promise.allSettled([...this._texReady(), this._firstProps]).then(() => this.bakeEnvironment());
    return this;
  }

  /** Second tier (after the first click or key): scans, the other props, sharper paintings. */
  streamDetail() {
    if (this._streaming) return this._streaming;
    const jobs = [];
    // Case scans in their vitrines (shared with the inspection stage, so no file loads twice).
    for (const v of VITRINES) jobs.push(this._dressVitrine(v));
    for (const b of BENCH_CASES) jobs.push(this._dressBenchCase(b));
    jobs.push(this._props());
    for (const k of ['morse-the-muse', 'elliott-mathew-brady']) jobs.push(this._sharpPainting(k));
    this._streaming = Promise.allSettled(jobs).then(() => { this.detailLoaded = true; this.bakeEnvironment(); });
    return this._streaming;
  }

  _texReady() { return pendingTextures.slice(); }

  /** Environment light and reflections from a cube render of the gallery (PMREM). */
  bakeEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const vis = [];
    // Leave the see-through effects and lens out of the bake.
    this.scene.traverse((o) => { if (o.visible && (o.isPoints || o.material?.blending === THREE.AdditiveBlending || o.userData.noBake)) { vis.push(o); o.visible = false; } });
    const prev = this.scene.environment;
    this.scene.environment = null;
    const rt = pmrem.fromScene(this.scene, 0.03, 0.1, 40, { size: 128, position: new THREE.Vector3(0, 1.7, -1.5) });
    for (const o of vis) o.visible = true;
    this.scene.environment = rt.texture;
    if (this._envRT) this._envRT.dispose(); else prev?.dispose?.();
    this._envRT = rt;
    pmrem.dispose();
    this.setMode(this.mode);
  }

  _add(obj) { this.root.add(obj); obj.updateMatrixWorld(true); return obj; }

  _register(id, roots, opts) {
    const list = [roots].flat();
    const prev = this.registered.get(id) || [];
    this.registered.set(id, [...prev, ...list]);
    if (opts) (this._regOpts ||= new Map()).set(id, opts);
  }

  _registerAll() {
    const inspect = this.app.inspect;
    for (const [id, roots] of this.registered) {
      if (!this.app.catalog.get(id)) continue;
      inspect.register(id, roots, { ...this._frameOpts(id), ...(this._regOpts?.get(id) || {}) });
    }
  }

  /**
   * Small objects get an authored close view (the template's box framing keeps
   * at least 0.4 m of distance, so a 10 cm object would fill only ~15% of the
   * view height; plan §4.3 asks for >= 35%). Template issue logged.
   */
  _frameOpts(id) {
    const e = this.app.catalog.get(id);
    const size = Array.isArray(e?.realSize) ? Math.max(...e.realSize) : (typeof e?.realSize === 'number' ? e.realSize : null);
    if (size === null || size > 1.0) return {};
    return { frame: { view: () => this._closeView(id) } };
  }

  _closeView(id) {
    const it = this.app.inspect.items.get(id);
    const root = it?.active || it?.roots[0];
    const b = new THREE.Box3().setFromObject(root);
    const center = b.getCenter(new THREE.Vector3());
    const sz = b.getSize(new THREE.Vector3());
    const cam = this.app.engine.camera;
    const th = Math.tan(((this.app.rig.baseFov ?? cam.fov) * Math.PI) / 360);
    const phone = this.app.shell.layout !== 'desktop';
    // Height: fill ~45% of the view; width: stay inside the half of the view beside the card.
    const dist = Math.max(sz.y / 2 / th / 0.45, Math.max(sz.x, sz.z) / 2 / (th * cam.aspect) / (phone ? 0.7 : 0.4), 0.12);
    const dir = cam.position.clone().sub(center);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    // Wall-mounted objects are seen from the room side.
    const wall = this._wallNormal(center);
    if (wall && dir.dot(wall) < 0.3) dir.copy(wall);
    dir.multiplyScalar(Math.cos(0.32)).setY(Math.sin(0.32)).normalize();
    const eye = center.clone().addScaledVector(dir, dist);
    // Stay inside the rooms (the gallery and the archive corner).
    const inArchive = center.x > ROOM.maxX + 0.05;
    eye.x = THREE.MathUtils.clamp(eye.x, inArchive ? ROOM.maxX + 0.3 : ROOM.minX + 0.25, inArchive ? 9.35 : ROOM.maxX - 0.25);
    eye.z = THREE.MathUtils.clamp(eye.z, inArchive ? -4.15 : ROOM.minZ + 0.25, inArchive ? 0.15 : ROOM.maxZ - 0.25);
    eye.y = THREE.MathUtils.clamp(eye.y, 0.5, ROOM.H - 0.3);
    return { eye: eye.toArray(), center: center.toArray() };
  }

  /** Inward normal of the wall an object hangs on (null for free-standing objects). */
  _wallNormal(p) {
    if (p.y < 1.2 && !(p.x > ROOM.maxX - 0.3)) return null;
    if (p.z < ROOM.minZ + 0.4) return V(0, 0, 1);
    if (p.z > ROOM.maxZ - 0.4) return V(0, 0, -1);
    if (p.x < ROOM.minX + 0.4) return V(1, 0, 0);
    if (p.x > ROOM.maxX - 0.4 && p.x < ROOM.maxX + 0.3) return V(-1, 0, 0);
    return null;
  }

  /** Late registration (streamed objects) adds roots to an existing card or registers a new one. */
  _lateRegister(id, root, opts = {}) {
    const inspect = this.app.inspect;
    const it = inspect.items.get(id);
    root.userData.objectId = id;
    if (it) {
      // Another root for an existing card: drop the built outline hulls so they are rebuilt over every root.
      if (it.hulls) { for (const h of it.hulls) h.parent?.remove(h); it.hulls = null; it.hullMat?.dispose(); it.hullMat = null; }
      it.roots.push(root);
      inspect.roots.push(root);
      if (inspect._keep(id)) inspect._setHulls(it, true);
      inspect._emit('change');
      return;
    }
    if (!this.app.catalog.get(id)) return;
    inspect.register(id, root, { ...this._frameOpts(id), ...opts });
  }

  // ------------------------------------------------------------------ room shell
  _room() {
    const { minX, maxX, minZ, maxZ, H } = ROOM;
    const W = maxX - minX, D = maxZ - minZ;
    const shell = new Parts();
    // Parquet floor and a coffered ceiling.
    shell.add(new THREE.PlaneGeometry(W, D), this.M.floor, { pos: [0, 0, (minZ + maxZ) / 2], rot: [-Math.PI / 2, 0, 0] });
    shell.add(new THREE.PlaneGeometry(W, D), this.M.ceiling, { pos: [0, H, (minZ + maxZ) / 2], rot: [Math.PI / 2, 0, 0], uv: [3, 3] });
    const beams = new Parts();
    for (const x of [-3, 0, 3]) beams.add(box(0.22, 0.26, D), this.M.woodDark, { pos: [x, H - 0.13, (minZ + maxZ) / 2], uv: [1, 6] });
    for (const z of [-5, -2, 1]) beams.add(box(W, 0.2, 0.18), this.M.woodDark, { pos: [0, H - 0.1, z], uv: [6, 1] });
    beams.add(box(W, 0.18, 0.12), this.M.woodDark, { pos: [0, H - 0.09, minZ + 0.06] });
    beams.add(box(W, 0.18, 0.12), this.M.woodDark, { pos: [0, H - 0.09, maxZ - 0.06] });
    this._add(beams.build('ceiling beams', { cast: false }));
    // Walls with real openings (uv scaled to ~1.5 m tiles).
    const wall = (w, h, x, y, z, ry) => shell.add(new THREE.PlaneGeometry(w, h), this.M.plaster, { pos: [x, y, z], rot: [0, ry, 0], uv: [w / 1.5, h / 1.5] });
    // North (z = minZ): windows x in [-4.0,-2.8] and [2.8,4.0], y in [1.0,3.6].
    const wy0 = 1.0, wy1 = 3.6;
    for (const [a, b] of [[-6, -4.0], [-2.8, 2.8], [4.0, 6]]) wall(b - a, H, (a + b) / 2, H / 2, minZ, 0);
    for (const [a, b] of [[-4.0, -2.8], [2.8, 4.0]]) { wall(b - a, wy0, (a + b) / 2, wy0 / 2, minZ, 0); wall(b - a, H - wy1, (a + b) / 2, (H + wy1) / 2, minZ, 0); }
    // South (z = maxZ): entrance x in [-0.9, 0.9], y in [0, 2.6].
    for (const [a, b] of [[-6, -0.9], [0.9, 6]]) wall(b - a, H, (a + b) / 2, H / 2, maxZ, Math.PI);
    wall(1.8, H - 2.6, 0, (H + 2.6) / 2, maxZ, Math.PI);
    // West (x = minX).
    wall(D, H, minX, H / 2, (minZ + maxZ) / 2, Math.PI / 2);
    // East (x = maxX): archive doorway z in [-3.2, -0.8], y in [0, 2.5].
    wall(maxZ + 0.8, H, maxX, H / 2, (maxZ - 0.8) / 2, -Math.PI / 2);
    wall(-3.2 - minZ, H, maxX, H / 2, (-3.2 + minZ) / 2, -Math.PI / 2);
    wall(2.4, H - 2.5, maxX, (H + 2.5) / 2, -2, -Math.PI / 2);
    const s = shell.build('gallery shell', { cast: false });
    this._add(s);
    this.shell = s;
    // Colliders: the outer walls and the ceiling (the camera never leaves the rooms).
    const C = (x0, y0, z0, x1, y1, z1) => this.colliders.push(new THREE.Box3(V(x0, y0, z0), V(x1, y1, z1)));
    C(minX - 1, -1, minZ - 1, maxX + 1, H + 3, minZ);           // north
    C(minX - 1, -1, maxZ, maxX + 1, H + 3, maxZ + 1);           // south
    C(minX - 1, -1, minZ, minX, H + 3, maxZ);                   // west
    C(maxX, -1, -0.8, maxX + 0.2, H + 3, maxZ);                 // east, south of the doorway
    C(maxX, -1, minZ, maxX + 0.2, H + 3, -3.2);                 // east, north of the doorway
    C(minX - 1, H, minZ - 1, 10, H + 3, maxZ + 1);              // ceiling
  }

  /** Oxblood panelling with raised mouldings, dado and brass picture rail. */
  _wainscot() {
    const { minX, maxX, minZ, maxZ, H } = ROOM;
    const p = new Parts();
    const rail = new Parts();
    const run = (len, cx, cz, ry, gaps = []) => {
      // Along the wall's local x from -len/2..len/2, skipping door gaps.
      const segs = [];
      let a = -len / 2;
      for (const [g0, g1] of gaps) { segs.push([a, g0]); a = g1; }
      segs.push([a, len / 2]);
      const rot = new THREE.Matrix4().makeRotationY(ry);
      for (const [s0, s1] of segs) {
        const w = s1 - s0; if (w <= 0.05) continue;
        const mid = (s0 + s1) / 2;
        const at = (lx, y, lz) => V(lx, y, lz).applyMatrix4(rot).add(V(cx, 0, cz)).toArray();
        p.add(box(w, 0.95, 0.02), this.M.wainscot, { pos: at(mid, 0.55, 0.01), rot: [0, ry, 0], uv: [w / 2, 0.5] });
        // Raised panels every ~0.9 m.
        const n = Math.max(1, Math.round(w / 0.9));
        for (let i = 0; i < n; i++) {
          const pw = w / n - 0.14;
          p.add(box(pw, 0.62, 0.025), this.M.wainscot, { pos: at(s0 + (i + 0.5) * (w / n), 0.56, 0.03), rot: [0, ry, 0], uv: [pw / 2, 0.4] });
        }
        p.add(box(w, 0.06, 0.05), this.M.woodDark, { pos: at(mid, 1.04, 0.025), rot: [0, ry, 0], uv: [w / 2, 0.1] });
        p.add(box(w, 0.14, 0.03), this.M.woodDark, { pos: at(mid, 0.07, 0.015), rot: [0, ry, 0], uv: [w / 2, 0.1] });
        rail.add(box(w, 0.035, 0.035), this.M.brass, { pos: at(mid, 3.55, 0.02), rot: [0, ry, 0] });
      }
    };
    run(maxX - minX, 0, minZ + 0.001, 0, [[-4.0, -2.8], [2.8, 4.0]].map(([a, b]) => [a, b]));
    run(maxX - minX, 0, maxZ - 0.001, Math.PI, [[-0.9, 0.9]]);
    run(maxZ - minZ, minX + 0.001, (minZ + maxZ) / 2, Math.PI / 2);
    // East wall local x runs from z = maxZ (left, looking at it from inside) to minZ.
    run(maxZ - minZ, maxX - 0.001, (minZ + maxZ) / 2, -Math.PI / 2, [[-((-0.8) - (minZ + maxZ) / 2), -((-3.2) - (minZ + maxZ) / 2)]]);
    const g = new THREE.Group();
    g.name = 'wainscoting';
    g.add(p.build('wainscoting panels', { cast: false }), rail.build('picture rail', { cast: false }));
    this._add(g);
    this._register('wainscoting', g);
    void H;
  }

  // ------------------------------------------------------------------ windows, rain, the street
  _windowsAndStreet() {
    const { minZ } = ROOM;
    this.windows = [];
    this.rainMats = [];
    for (const x of [-3.4, 3.4]) {
      const g = new THREE.Group();
      g.name = 'window';
      g.position.set(x, 0, minZ);
      const f = new Parts();
      // Frame 1.2 x 2.6 x 0.1: outer frame, a mullion and two transoms, and a sill.
      for (const [w, h, px, py] of [[1.2, 0.08, 0, 1.04], [1.2, 0.08, 0, 3.56], [0.08, 2.6, -0.56, 2.3], [0.08, 2.6, 0.56, 2.3], [0.05, 2.5, 0, 2.3], [1.1, 0.04, 0, 2.0], [1.1, 0.04, 0, 2.9]]) {
        f.add(box(w, h, 0.1), this.M.woodDark, { pos: [px, py, 0], uv: [w, h] });
      }
      g.add(f.build('window frame', { cast: false }));
      const sill = new THREE.Mesh(box(1.2, 0.04, 0.1), this.M.marble);
      sill.position.set(0, 0.98, 0.05);
      g.add(sill);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.5), this.M.windowGlass);
      glass.position.set(0, 2.3, -0.01);
      glass.renderOrder = 8;
      glass.raycast = () => {};
      g.add(glass);
      // Rain on the glass: streaks and drops that grow, join and run down (procedural shader, illustrative).
      const rainMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uSeed: { value: x } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uTime; uniform float uSeed; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
          void main(){
            vec2 uv = vUv * vec2(18.0, 6.0);
            float a = 0.0;
            for (int L = 0; L < 2; L++) {
              float fl = float(L);
              vec2 g = uv * (1.0 + fl * 0.8) + vec2(fl * 3.1, 0.0);
              vec2 id = floor(g);
              float r = h(id);
              float speed = 0.25 + r * 0.6;
              float y = fract(g.y + uTime * speed * (r > 0.55 ? 1.0 : 0.04) + r * 7.0);
              vec2 f = fract(g) - 0.5;
              f.x += (h(id + 3.7) - 0.5) * 0.6 + sin(g.y * 6.0 + r * 9.0) * 0.04;
              float drop = smoothstep(0.08, 0.0, length(vec2(f.x, (y - 0.5) * 0.7)));
              float trail = smoothstep(0.03, 0.0, abs(f.x)) * smoothstep(0.5, 1.0, y) * step(0.55, r) * 0.5;
              a += (drop + trail) * (0.55 - fl * 0.2);
            }
            float mist = 0.04 + 0.03 * h(floor(vUv * 90.0));
            gl_FragColor = vec4(vec3(0.78, 0.84, 0.92), clamp(a * 0.5 + mist, 0.0, 0.55));
          }`,
      });
      const rain = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.5), rainMat);
      rain.position.set(0, 2.3, -0.005);
      rain.renderOrder = 9;
      rain.raycast = () => {};
      g.add(rain);
      this.rainMats.push(rainMat);
      this._add(g);
      this.windows.push(g);
    }
    this._register('windows-rain', this.windows);
    // Outside: a wet street, the pavement, lamps, the building across the street and a cloudy night sky.
    const out = new THREE.Group();
    out.name = 'street outside';
    const road = cardTexture([], { w: 512, h: 256, bg: '#0d0f12', border: null, paper: false });
    {
      const c = road.image; const g = c.getContext('2d');
      let s = 3; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${120 + rnd() * 60},${120 + rnd() * 60},${130 + rnd() * 60},${0.04 + rnd() * 0.06})`; g.fillRect(rnd() * 512, rnd() * 256, 2, 2); }
      g.fillStyle = 'rgba(220,210,170,0.55)';
      for (let x = 0; x < 512; x += 64) g.fillRect(x, 124, 34, 6);
      road.needsUpdate = true;
      road.wrapS = THREE.RepeatWrapping; road.repeat.set(3, 1);
    }
    const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), new THREE.MeshStandardMaterial({ map: road, roughness: 0.12, metalness: 0.2, name: 'wet-road' }));
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, -0.05, minZ - 7);
    const kerb = new THREE.Mesh(box(40, 0.15, 2.2), this.M.marble);
    kerb.position.set(0, 0, minZ - 1.6);
    out.add(roadMesh, kerb);
    const facade = lazyTexture(this.renderer, this.o.assets.own['night-facade'].file, { repeat: [2, 1] });
    const facadeMat = new THREE.MeshStandardMaterial({ map: facade.placeholder, emissive: '#ffffff', emissiveIntensity: 0.0, roughness: 0.9, name: 'facade' });
    facade.ready.then((t) => { if (t) { facadeMat.map = t; facadeMat.emissiveMap = t; facadeMat.emissiveIntensity = 0.35; facadeMat.needsUpdate = true; } });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), facadeMat);
    front.position.set(0, 6.5, minZ - 11.5);
    out.add(front);
    // Lit windows that switch on and off over time (overlay, illustrative).
    const lit = document.createElement('canvas');
    lit.width = 256; lit.height = 128;
    this.litWindows = { canvas: lit, tex: new THREE.CanvasTexture(lit), state: [], t: 0 };
    this.litWindows.tex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 48; i++) this.litWindows.state.push(i % 5 === 1 || i % 7 === 3);
    this._drawLit();
    const litMesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), new THREE.MeshBasicMaterial({ map: this.litWindows.tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, name: 'lit-windows' }));
    litMesh.position.set(0, 6.6, minZ - 11.4);
    out.add(litMesh);
    // Street lamps (cast iron posts, warm heads).
    const lamps = new Parts();
    const lampGlow = new THREE.MeshStandardMaterial({ color: '#3a2a10', emissive: '#ffcf8a', emissiveIntensity: 2.4, name: 'lamp-glow' });
    for (const lx of [-8, 0, 8]) {
      lamps.add(cyl(0.06, 0.09, 4.2, 10), this.M.blackMetal, { pos: [lx, 2.1, minZ - 2.4] });
      lamps.add(cyl(0.22, 0.12, 0.42, 8), this.M.blackMetal, { pos: [lx, 4.35, minZ - 2.4] });
      lamps.add(cyl(0.16, 0.16, 0.26, 8), lampGlow, { pos: [lx, 4.12, minZ - 2.4] });
    }
    out.add(lamps.build('street lamps', { cast: false }));
    // Night sky with drifting clouds (procedural shader, illustrative).
    this.skyMat = new THREE.ShaderMaterial({
      depthWrite: false, uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++){ a += w * n(p); p *= 2.03; w *= 0.5; } return a; }
        void main(){
          vec2 p = vUv * vec2(6.0, 3.0) + vec2(uTime * 0.012, 0.0);
          float c = smoothstep(0.42, 0.78, fbm(p));
          vec3 sky = mix(vec3(0.035, 0.05, 0.085), vec3(0.09, 0.1, 0.13), vUv.y);
          vec3 cloud = vec3(0.16, 0.15, 0.16) + vec3(0.12, 0.09, 0.05) * (1.0 - vUv.y);
          gl_FragColor = vec4(mix(sky, cloud, c * 0.85), 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(70, 30), this.skyMat);
    sky.position.set(0, 18, minZ - 14);
    out.add(sky);
    // A car passing now and then: dark body, headlights and tail lights.
    const car = new THREE.Group();
    car.name = 'passing car';
    const body = new Parts();
    const paint = new THREE.MeshStandardMaterial({ color: '#1c2430', roughness: 0.25, metalness: 0.6, name: 'car-paint' });
    paint.userData.surfaceDetail = true;
    body.add(box(4.2, 0.7, 1.8), paint, { pos: [0, 0.55, 0] });
    body.add(box(2.3, 0.55, 1.6), paint, { pos: [-0.2, 1.15, 0] });
    for (const [wx, wz] of [[-1.35, 0.9], [1.35, 0.9], [-1.35, -0.9], [1.35, -0.9]]) body.add(cyl(0.33, 0.33, 0.22, 14), this.M.blackMetal, { pos: [wx, 0.33, wz], rot: [Math.PI / 2, 0, 0] });
    car.add(body.build('car body', { cast: false }));
    const lightsMat = new THREE.MeshStandardMaterial({ color: '#222', emissive: '#fff4d8', emissiveIntensity: 6, name: 'headlights' });
    const tailMat = new THREE.MeshStandardMaterial({ color: '#220000', emissive: '#ff2a1a', emissiveIntensity: 3, name: 'tail-lights' });
    const hl = new Parts();
    hl.add(box(0.05, 0.16, 0.36), lightsMat, { pos: [2.12, 0.62, 0.55] });
    hl.add(box(0.05, 0.16, 0.36), lightsMat, { pos: [2.12, 0.62, -0.55] });
    car.add(hl.build('headlights', { cast: false }));
    const tl = new Parts();
    tl.add(box(0.05, 0.12, 0.3), tailMat, { pos: [-2.12, 0.66, 0.6] });
    tl.add(box(0.05, 0.12, 0.3), tailMat, { pos: [-2.12, 0.66, -0.6] });
    car.add(tl.build('tail lights', { cast: false }));
    car.position.set(-30, 0, minZ - 6.2);
    out.add(car);
    this.car = car;
    this._add(out);
    // Headlight sweep: soft light crossing the ceiling inside as a car passes (illustrative).
    const sweepTex = this._softDisc('rgba(255,236,200,1)');
    this.headSweep = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), new THREE.MeshBasicMaterial({ map: sweepTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, name: 'headlight-sweep' }));
    this.headSweep.rotation.x = Math.PI / 2;
    this.headSweep.position.set(0, ROOM.H - 0.3, minZ + 1.5);
    this.headSweep.raycast = () => {};
    this._add(this.headSweep);
  }

  _drawLit() {
    const L = this.litWindows; const g = L.canvas.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    // 12 x 4 window grid on the building across the street; warm and cool interiors.
    for (let i = 0; i < 48; i++) {
      if (!L.state[i]) continue;
      const cx = (i % 12) * 21 + 6, cy = Math.floor(i / 12) * 30 + 8;
      g.fillStyle = i % 3 === 0 ? 'rgba(170,190,255,0.55)' : 'rgba(255,196,120,0.7)';
      g.fillRect(cx, cy, 11, 17);
    }
    L.tex.needsUpdate = true;
  }

  _softDisc(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** Heavy curtains beside each window, swaying a little in a draught (CPU-animated folds). */
  _curtains() {
    const { minZ } = ROOM;
    this.curtains = [];
    const rods = new Parts();
    for (const wx of [-3.4, 3.4]) {
      rods.add(cyl(0.018, 0.018, 2.4, 10), this.M.brass, { pos: [wx, 3.78, minZ + 0.14], rot: [0, 0, Math.PI / 2] });
      for (const side of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(0.5, 2.8, 10, 18);
        const base = Float32Array.from(geo.attributes.position.array);
        const mesh = new THREE.Mesh(geo, this.M.curtain);
        mesh.position.set(wx + side * 0.82, 2.36, minZ + 0.14);
        mesh.castShadow = false; mesh.receiveShadow = true;
        mesh.name = 'curtain';
        mesh.userData.base = base;
        mesh.userData.phase = wx * 0.7 + side;
        this._foldCurtain(mesh, 0);
        this._add(mesh);
        this.curtains.push(mesh);
      }
    }
    this._add(rods.build('curtain rods', { cast: false }));
    this._register('curtains', this.curtains);
  }

  _foldCurtain(mesh, t) {
    const pos = mesh.geometry.attributes.position;
    const b = mesh.userData.base, ph = mesh.userData.phase;
    for (let i = 0; i < pos.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1];
      const drop = (1.4 - y) / 2.8; // 0 at the rod, 1 at the hem
      const fold = Math.sin((x + 0.25) * Math.PI * 9) * 0.035;
      const sway = drop * drop * 0.035 * Math.sin(t * 0.9 + ph + x * 3.0) + drop * 0.012 * Math.sin(t * 2.3 + ph * 2.0);
      pos.setZ(i, fold + sway + 0.04);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  // ------------------------------------------------------------------ display cases
  _labelCard(lines, w = 0.22, h = 0.14) {
    const tex = cardTexture([
      { text: lines[0], size: 34, font: 'display', weight: 700, align: 'center', gap: 14 },
      ...lines.slice(1).map((t) => ({ text: t, size: 26, align: 'center', gap: 4 })),
      { text: 'Lantern Museum (fictional)', size: 20, italic: true, align: 'center', color: '#5a4a35' },
    ], { w: 512, h: Math.round(512 * h / w), pad: 34 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, name: 'label-card' }));
    m.userData.noOutline = true;
    return m;
  }

  _cases() {
    const plinths = new Parts();
    const decks = new Parts();
    const frames = new Parts();
    const glass = new Parts();
    this.vitrineRoots = [];
    const W = 0.6, PH = 0.95, HH = 0.65;
    for (const v of VITRINES) {
      const g = new THREE.Group();
      g.name = `vitrine ${v.id}`;
      g.position.set(v.x, 0, v.z);
      // Each vitrine is one root for the vitrine card: plinth, felt deck, brass frame, glass hood.
      const p = new Parts();
      p.add(box(W, PH - 0.08, W), this.M.woodDark, { pos: [0, (PH - 0.08) / 2 + 0.06, 0], uv: [0.6, 1] });
      p.add(box(W + 0.04, 0.06, W + 0.04), this.M.woodDark, { pos: [0, 0.03, 0] });
      p.add(box(W + 0.02, 0.025, W + 0.02), this.M.marble, { pos: [0, PH - 0.0125, 0] });
      const fr = new Parts();
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fr.add(box(0.018, HH, 0.018), this.M.brass, { pos: [sx * (W / 2 - 0.01), PH + HH / 2, sz * (W / 2 - 0.01)] });
      for (const sz of [-1, 1]) fr.add(box(W, 0.018, 0.018), this.M.brass, { pos: [0, PH + HH - 0.009, sz * (W / 2 - 0.01)] });
      for (const sx of [-1, 1]) fr.add(box(0.018, 0.018, W), this.M.brass, { pos: [sx * (W / 2 - 0.01), PH + HH - 0.009, 0] });
      const d = new Parts();
      d.add(box(W - 0.04, 0.012, W - 0.04), this.M.felt, { pos: [0, PH + 0.006, 0] });
      const gl = new Parts();
      gl.add(box(W - 0.01, HH, W - 0.01), this.M.glass, { pos: [0, PH + HH / 2, 0] });
      g.add(p.build('plinth'), fr.build('frame', { cast: false }), d.build('deck', { cast: false }));
      const hood = gl.build('glass hood', { cast: false, receive: false });
      hood.children.forEach((m) => { m.renderOrder = 10; });
      g.add(hood);
      const card = this._labelCard(v.label);
      card.position.set(0, PH - 0.2, W / 2 + 0.002);
      g.add(card);
      g.add(contactShadow(W + 0.3, W + 0.3, 0.5));
      this._add(g);
      this.vitrineRoots.push(g);
      // The object sits on its deck; filled by streamDetail().
      const holder = new THREE.Group();
      holder.position.set(v.x, PH + 0.012, v.z);
      holder.name = `case display ${v.id}`;
      this._add(holder);
      const placard = this._labelCard(['ON THE INSPECTION TABLE', 'This object is being examined.'], 0.2, 0.1);
      placard.rotation.x = -0.6;
      placard.position.set(v.x, PH + 0.06, v.z + 0.1);
      placard.visible = false;
      this._add(placard);
      this.caseHolders.set(v.id, { holder, placard, scan: null, v });
    }
    void plinths; void decks; void frames; void glass;
    // Bench cases: low wooden cases with a sloped glass lid for the neighbouring exhibits.
    this.benchRoots = [];
    for (const b of BENCH_CASES) {
      const g = new THREE.Group();
      g.name = `bench case ${b.id}`;
      g.position.set(b.x, 0, b.z);
      const p = new Parts();
      const D = 0.5, top = 0.82;
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.add(box(0.05, top - 0.12, 0.05), this.M.woodDark, { pos: [lx * (b.w / 2 - 0.04), (top - 0.12) / 2, lz * (D / 2 - 0.04)] });
      p.add(box(b.w, 0.12, D), this.M.woodDark, { pos: [0, top - 0.06, 0], uv: [b.w, 0.3] });
      p.add(box(b.w - 0.04, 0.01, D - 0.04), this.M.felt, { pos: [0, top + 0.004, 0] });
      const fr = new Parts();
      for (const sx of [-1, 1]) fr.add(box(0.02, 0.2, D), this.M.brass, { pos: [sx * (b.w / 2 - 0.01), top + 0.1, 0] });
      g.add(p.build('bench case'), fr.build('bench frame', { cast: false }));
      const lid = new THREE.Mesh(box(b.w - 0.03, 0.2, D - 0.02), this.M.glass);
      lid.position.y = top + 0.1;
      lid.renderOrder = 10;
      g.add(lid);
      const card = this._labelCard(b.label, 0.2, 0.11);
      card.position.set(0, top - 0.06, D / 2 + 0.002);
      g.add(card);
      g.add(contactShadow(b.w + 0.3, D + 0.3, 0.45));
      this._add(g);
      this.benchRoots.push(g);
    }
    this._register('vitrine', [...this.vitrineRoots, ...this.benchRoots]);
  }

  /** Load a case scan once (shared by the vitrine copy and the inspection stage). */
  scan(id) {
    if (!this.scans.has(id)) {
      const entry = this.o.models[id] || this.o.assets.exhibits[id];
      this.scans.set(id, loadGLB(this.renderer, entry.file).then((gltf) => {
        const root = gltf.scene;
        root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = 1; } });
        root.userData.recordId = id;
        root.userData.id = id;
        return root;
      }));
    }
    return this.scans.get(id);
  }

  async _dressVitrine(v) {
    const scan = await this.scan(v.id).catch(() => null);
    const slot = this.caseHolders.get(v.id);
    if (!scan || !slot) return;
    const copy = scan.clone(true);
    const holder = restOnFloor(copy);
    holder.name = `${v.id} (in its case)`;
    holder.userData.scaleFrame = 'local';
    slot.holder.add(holder);
    slot.scan = holder;
    holder.visible = !slot.away;
    this._lateRegister(v.id, holder);
  }

  async _dressBenchCase(b) {
    const scan = await this.scan(b.id).catch(() => null);
    if (!scan) return;
    const holder = restOnFloor(scan.clone(true));
    holder.position.set(b.x, 0.83, b.z);
    // The Lincoln model is long along its z axis: turn it to lie along the case.
    if (b.id === 'lincoln-patent-model') holder.rotation.y = Math.PI / 2;
    holder.userData.scaleFrame = 'local';
    holder.name = b.id;
    this._add(holder);
    this._lateRegister(b.id, holder);
  }

  /** The inspection table shows the object, so its vitrine shows a placard instead. */
  setAway(ids) {
    const set = new Set(ids);
    for (const [id, slot] of this.caseHolders) {
      slot.away = set.has(id);
      if (slot.scan) slot.scan.visible = !slot.away;
      slot.placard.visible = slot.away;
    }
  }

  /** Shot S2: the learner's label on a small stand inside a vitrine (null clears it). */
  showLabelInCase(id, text = '') {
    if (this._labelStand) { this._labelStand.parent?.remove(this._labelStand); this._labelStand = null; }
    const slot = id && this.caseHolders.get(id);
    if (!slot) return;
    const g = new THREE.Group();
    const lines = String(text || '').trim();
    const tex = cardTexture([{ text: 'YOUR LABEL', size: 30, font: 'display', weight: 700, gap: 12 }, { text: lines.slice(0, 420), size: 22, leading: 1.25 }], { w: 512, h: 640, pad: 30 });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    plaque.position.set(0.17, 0.12, 0.17);
    plaque.rotation.set(-0.35, -0.5, 0);
    const stand = new THREE.Mesh(box(0.02, 0.1, 0.02), this.M.brass);
    stand.position.set(0.17, 0.05, 0.15);
    g.add(plaque, stand);
    g.position.copy(slot.holder.position);
    this._add(g);
    this._labelStand = g;
  }

  // ------------------------------------------------------------------ inspection table
  _table() {
    const t = new THREE.Group();
    t.name = 'inspection table';
    t.position.set(TABLE.x, 0, TABLE.z);
    const p = new Parts();
    p.add(box(TABLE.w, 0.04, TABLE.d), this.M.wood, { pos: [0, TABLE.top - 0.02, 0], uv: [1.4, 0.8] });
    p.add(box(TABLE.w - 0.1, 0.1, TABLE.d - 0.1), this.M.wood, { pos: [0, TABLE.top - 0.09, 0] });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.add(box(0.05, TABLE.top - 0.04, 0.05), this.M.wood, { pos: [x * (TABLE.w / 2 - 0.05), (TABLE.top - 0.04) / 2, z * (TABLE.d / 2 - 0.05)] });
    p.add(box(TABLE.w - 0.12, 0.03, 0.04), this.M.wood, { pos: [0, 0.18, TABLE.d / 2 - 0.05] });
    p.add(box(TABLE.w - 0.12, 0.03, 0.04), this.M.wood, { pos: [0, 0.18, -TABLE.d / 2 + 0.05] });
    const tbl = p.build('table');
    t.add(tbl);
    // Photographic sweep: flat floor, a quarter-circle bend and a rise at the back (-z).
    const sweep = new THREE.Mesh(makeSweep(1.3, 0.42, 0.18, 0.48), this.M.sweep);
    sweep.position.set(0, TABLE.top + 0.001, STAGE_POS.z - TABLE.z + 0.2);
    sweep.receiveShadow = true;
    sweep.userData.surfaceDetail = true;
    t.add(sweep);
    this.sweep = sweep;
    t.add(contactShadow(1.8, 1.2, 0.5));
    this._add(t);
    this.table = t;
    this._register('inspection-table', t);
    // Draft label card lying on the table (catalog: draft-label, fictional).
    const tex = cardTexture([
      { text: 'DRAFT LABEL', size: 46, font: 'display', weight: 700, gap: 14 },
      { text: 'Check every claim before this card goes on the wall.', size: 26, gap: 10 },
      { text: 'Lantern Museum (fictional)', size: 22, italic: true, color: '#5a4a35' },
    ], { w: 512, h: 340 });
    const card = new THREE.Mesh(box(0.15, 0.002, 0.1), [null, null, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), null, null, null].map((m) => m || this.M.paper));
    card.position.set(0.47, TABLE.top + 0.001, TABLE.z + 0.22);
    card.rotation.y = 0;
    card.castShadow = true;
    card.name = 'draft label card';
    this._add(card);
    this.draftCard = card;
    this._register('draft-label', card);
    // Scale card (bank-card size, 0.76 mm) and a US quarter: the true-size references.
    const cardTex = cardTexture([{ text: 'SCALE CARD', size: 40, weight: 700, gap: 10 }, { text: '85.60 × 53.98 mm', size: 30 }, { text: 'bank-card size', size: 26, color: '#4a4a4a' }], { w: 512, h: 323, bg: '#e8e2d2', border: '#2e5d8f' });
    const scaleCard = new THREE.Mesh(box(0.0856, 0.00076, 0.05398), [null, null, new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.5 }), null, null, null].map((m) => m || new THREE.MeshStandardMaterial({ color: '#2e5d8f', roughness: 0.4, map: cardTex })));
    scaleCard.name = 'scale card';
    scaleCard.castShadow = true;
    const quarterTex = cardTexture([{ text: 'LIBERTY  ·  1999', size: 40, align: 'center' }], { w: 256, h: 256, bg: '#c9ccd1', border: '#9aa0a8', paper: false });
    const quarter = new THREE.Mesh(cyl(0.02426 / 2, 0.02426 / 2, 0.00175, 40), new THREE.MeshStandardMaterial({ color: '#d8dbe0', metalness: 1, roughness: 0.32, map: quarterTex }));
    quarter.name = 'US quarter';
    quarter.castShadow = true;
    this.scaleCard = scaleCard;
    this.quarter = quarter;
    this.placeScaleRefs(null);
    this._add(scaleCard); this._add(quarter);
    this._register('scale-card', [scaleCard, quarter]);
    // Ruler (only on the table while the true-size view is on).
    this.ruler = makeRuler();
    this.ruler.visible = false;
    this._add(this.ruler);
  }

  /** Scale card and quarter on the table: at rest beside the sweep, or in front of the object (true size). */
  placeScaleRefs(objBox) {
    const y = TABLE.top;
    if (!objBox) {
      this.scaleCard.position.set(0.52, y + 0.0004, TABLE.z - 0.05);
      this.quarter.position.set(0.52, y + 0.000875, TABLE.z + 0.04);
      if (this.ruler) this.ruler.visible = false;
      return;
    }
    const front = objBox.max.z + 0.03;
    const cx = (objBox.min.x + objBox.max.x) / 2;
    this.scaleCard.position.set(objBox.max.x + 0.07, y + 0.0004, (objBox.min.z + objBox.max.z) / 2);
    this.quarter.position.set(objBox.min.x - 0.04, y + 0.000875, (objBox.min.z + objBox.max.z) / 2);
    this.ruler.position.set(cx, y + 0.001, front + 0.018);
    this.ruler.visible = true;
  }

  // ------------------------------------------------------------------ paintings
  _paintings() {
    const P = this.o.assets.paintings;
    this.paintings = {};
    const hang = (key, id, x, z, ry, bottom) => {
      const p = P[key];
      const [fw, fh, fd] = p.framedMetres;
      const [cw, ch] = p.canvasMetres;
      const g = new THREE.Group();
      g.name = id;
      g.position.set(x, bottom, z);
      g.rotation.y = ry;
      // Gilt frame: four moulded rails around the canvas, real framed size.
      const f = new Parts();
      const rw = (fw - cw) / 2, rh = (fh - ch) / 2;
      f.add(box(fw, rh, fd), this.M.gilt, { pos: [0, rh / 2, fd / 2] });
      f.add(box(fw, rh, fd), this.M.gilt, { pos: [0, fh - rh / 2, fd / 2] });
      f.add(box(rw, ch, fd), this.M.gilt, { pos: [-fw / 2 + rw / 2, fh / 2, fd / 2] });
      f.add(box(rw, ch, fd), this.M.gilt, { pos: [fw / 2 - rw / 2, fh / 2, fd / 2] });
      // Inner lip (darker, stepped) so the frame has depth.
      f.add(box(cw + 0.04, 0.02, 0.03), this.M.woodDark, { pos: [0, rh - 0.01, fd - 0.03] });
      f.add(box(cw + 0.04, 0.02, 0.03), this.M.woodDark, { pos: [0, fh - rh + 0.01, fd - 0.03] });
      g.add(f.build('frame'));
      const t = lazyTexture(this.renderer, p.files['1024'].file, { anisotropy: 8 });
      const mat = new THREE.MeshStandardMaterial({ map: t.placeholder, roughness: 0.62, name: `painting ${key}` });
      t.ready.then((tx) => { if (tx) { mat.map = tx; mat.needsUpdate = true; } });
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), mat);
      canvas.position.set(0, fh / 2, fd - 0.04);
      g.add(canvas);
      // Brass picture light above the frame.
      const pl = new Parts();
      pl.add(cyl(0.025, 0.025, Math.min(0.9, fw * 0.55), 12), this.M.brass, { pos: [0, fh + 0.1, fd + 0.12], rot: [0, 0, Math.PI / 2] });
      pl.add(box(0.03, 0.14, 0.03), this.M.brass, { pos: [0, fh + 0.04, fd + 0.04] });
      g.add(pl.build('picture light', { cast: false }));
      // Small museum label beside the painting.
      const label = this._labelCard([p.title.toUpperCase(), `${p.artist}, ${p.date}`, `${p.medium}. The Met, ${p.accessionNumber} (CC0)`], 0.2, 0.13);
      label.position.set(fw / 2 + 0.2, 0.55, 0.003);
      g.add(label);
      this._add(g);
      this.paintings[key] = { group: g, mat };
      this._register(id, g);
    };
    // The Muse: centred on the west wall, bottom 0.9 m. Brady: west wall near the north corner.
    hang('morse-the-muse', 'wall-painting', ROOM.minX + 0.001, -2.6, Math.PI / 2, 0.95);
    hang('elliott-mathew-brady', 'portrait-brady', ROOM.minX + 0.001, -6.3, Math.PI / 2, 1.35);
  }

  async _sharpPainting(key) {
    const p = this.o.assets.paintings[key];
    const { ready } = lazyTexture(this.renderer, p.files['2048'].file, { anisotropy: 8 });
    const t = await ready;
    if (t && this.paintings[key]) { this.paintings[key].mat.map = t; this.paintings[key].mat.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ reception, entrance, exit sign
  _reception() {
    const g = new THREE.Group();
    g.name = 'reception desk';
    g.position.set(-3.6, 0, 2.95);
    const p = new Parts();
    // 2.0 x 1.1 x 0.7: a panelled front, a raised counter and a lower work top behind.
    p.add(box(2.0, 1.0, 0.06), this.M.woodDark, { pos: [0, 0.5, -0.32], uv: [2, 1] });
    for (let i = 0; i < 4; i++) p.add(box(0.4, 0.6, 0.02), this.M.woodDark, { pos: [-0.72 + i * 0.48, 0.5, -0.36] });
    p.add(box(0.06, 1.0, 0.64), this.M.woodDark, { pos: [-0.97, 0.5, 0] });
    p.add(box(0.06, 1.0, 0.64), this.M.woodDark, { pos: [0.97, 0.5, 0] });
    p.add(box(2.0, 0.04, 0.26), this.M.marble, { pos: [0, 1.08, -0.22] });
    p.add(box(1.9, 0.03, 0.4), this.M.wood, { pos: [0, 0.76, 0.12] });
    g.add(p.build('desk'));
    // Visitor book (open), leaflets, a bell, a brass lamp and a sign.
    const book = cardTexture([
      { text: 'VISITORS', size: 30, font: 'display', weight: 700, gap: 10 },
      { text: 'Thursday 30 October', size: 22, gap: 18 },
      { text: 'Name · From · Comments', size: 18, color: '#6a5a45', gap: 22 },
      { text: 'Closed at 6 pm. No visitors tonight.', size: 20, italic: true, color: '#5a4a35' },
    ], { w: 512, h: 360, bg: '#f3ecdc', border: null });
    const bk = new THREE.Mesh(box(0.38, 0.03, 0.26), [null, null, new THREE.MeshStandardMaterial({ map: book, roughness: 0.9 }), null, null, null].map((m) => m || this.M.woodDark));
    bk.position.set(-0.45, 1.115, -0.22);
    bk.rotation.y = 0.12;
    g.add(bk);
    const leaf = cardTexture([{ text: 'SPARKS OF THE TELEGRAPH AGE', size: 30, font: 'display', weight: 700, gap: 12 }, { text: 'Gallery guide', size: 24 }], { w: 256, h: 360, bg: '#2f4a3a', border: '#b08d57' });
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(box(0.1, 0.006, 0.15), [null, null, new THREE.MeshStandardMaterial({ map: leaf, roughness: 0.8 }), null, null, null].map((m) => m || this.M.paper));
      l.position.set(0.3 + i * 0.12, 1.103, -0.22);
      l.rotation.y = -0.1 + i * 0.08;
      g.add(l);
    }
    const lamp = new Parts();
    lamp.add(cyl(0.07, 0.08, 0.02, 16), this.M.brass, { pos: [0.75, 1.11, -0.22] });
    lamp.add(cyl(0.01, 0.01, 0.34, 8), this.M.brass, { pos: [0.75, 1.28, -0.22] });
    lamp.add(cyl(0.05, 0.11, 0.12, 16, true), new THREE.MeshStandardMaterial({ color: '#2f4a3a', roughness: 0.4, side: THREE.DoubleSide, emissive: '#ffcf8a', emissiveIntensity: 0.15, name: 'lamp-shade' }), { pos: [0.75, 1.45, -0.22] });
    g.add(lamp.build('desk lamp', { cast: false }));
    const sign = cardTexture([{ text: 'RECEPTION', size: 64, font: 'display', weight: 700, align: 'center' }], { w: 512, h: 128, bg: '#2a1d16', border: '#b08d57', paper: false });
    const signM = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.5, name: 'reception-sign' }));
    signM.position.set(0, 0.82, -0.353);
    signM.rotation.y = Math.PI;
    g.add(signM);
    g.rotation.y = Math.PI; // the visitor side faces the gallery (north)
    g.add(contactShadow(2.4, 1.0, 0.45));
    this._add(g);
    this._register('reception-desk', g);
  }

  _entrance() {
    const { maxZ } = ROOM;
    const g = new THREE.Group();
    g.name = 'entrance';
    const p = new Parts();
    // Architrave and a pair of panelled doors with glazed tops (closed for the night).
    p.add(box(0.12, 2.7, 0.18), this.M.woodDark, { pos: [-0.96, 1.35, maxZ - 0.05] });
    p.add(box(0.12, 2.7, 0.18), this.M.woodDark, { pos: [0.96, 1.35, maxZ - 0.05] });
    p.add(box(2.04, 0.14, 0.18), this.M.woodDark, { pos: [0, 2.67, maxZ - 0.05] });
    for (const s of [-1, 1]) {
      p.add(box(0.88, 2.55, 0.05), this.M.wood, { pos: [s * 0.45, 1.28, maxZ - 0.02], uv: [0.9, 2.5] });
      p.add(box(0.6, 0.7, 0.02), this.M.woodDark, { pos: [s * 0.45, 0.6, maxZ - 0.05] });
    }
    p.add(cyl(0.012, 0.012, 0.3, 8), this.M.brass, { pos: [-0.06, 1.1, maxZ - 0.08] });
    p.add(cyl(0.012, 0.012, 0.3, 8), this.M.brass, { pos: [0.06, 1.1, maxZ - 0.08] });
    g.add(p.build('doors', { cast: false }));
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), this.M.windowGlass);
    gl.position.set(0, 2.0, maxZ - 0.06);
    gl.rotation.y = Math.PI;
    g.add(gl);
    this._add(g);
    // Exit sign over the door: 0.35 x 0.15 x 0.05 box, own-work face texture, glowing.
    const t = lazyTexture(this.renderer, this.o.assets.own['exit-sign'].file, { anisotropy: 4 });
    this.exitMat = new THREE.MeshStandardMaterial({ map: t.placeholder, emissive: '#ffffff', emissiveMap: t.placeholder, emissiveIntensity: 1.6, roughness: 0.4, name: 'exit-face' });
    t.ready.then((tx) => { if (tx) { this.exitMat.map = tx; this.exitMat.emissiveMap = tx; this.exitMat.needsUpdate = true; } });
    const sign = new THREE.Mesh(box(0.35, 0.15, 0.05), [this.M.blackMetal, this.M.blackMetal, this.M.blackMetal, this.M.blackMetal, this.M.blackMetal, this.exitMat]);
    sign.position.set(0, 2.92, maxZ - 0.045);
    sign.rotation.y = Math.PI;
    sign.name = 'exit sign';
    this._add(sign);
    this.exitSign = sign;
    this._register('exit-sign', sign);
  }

  // ------------------------------------------------------------------ evidence board
  _evidenceBoard() {
    const g = new THREE.Group();
    g.name = 'evidence board';
    g.position.set(ROOM.maxX - 0.001, 1.15, 1.7);
    g.rotation.y = -Math.PI / 2;
    // 1.2 x 0.9 x 0.03: frame, cork, pinned cards with flat pins and red string.
    const f = new Parts();
    f.add(box(1.2, 0.04, 0.026), this.M.woodDark, { pos: [0, 0.43, 0.013] });
    f.add(box(1.2, 0.04, 0.026), this.M.woodDark, { pos: [0, -0.43, 0.013] });
    f.add(box(0.04, 0.82, 0.026), this.M.woodDark, { pos: [-0.58, 0, 0.013] });
    f.add(box(0.04, 0.82, 0.026), this.M.woodDark, { pos: [0.58, 0, 0.013] });
    f.add(box(1.12, 0.82, 0.012), this.M.cork, { pos: [0, 0, 0.006] });
    g.add(f.build('board'));
    this.boardCards = new THREE.Group();
    g.add(this.boardCards);
    this.board = g;
    this._add(g);
    this._register('evidence-board', g);
    this.setBoardCards([]);
  }

  /** Pin one card per recorded finding and opened record (the case file, in the world). */
  setBoardCards(items) {
    const grp = this.boardCards;
    for (const c of [...grp.children]) { grp.remove(c); c.geometry?.dispose(); }
    const list = items.slice(0, 9);
    const pins = new Parts();
    const pinMat = this._pinMat ||= new THREE.MeshStandardMaterial({ color: '#8c2d35', roughness: 0.4, name: 'pin' });
    pinMat.userData.surfaceDetail = true;
    const pts = [];
    list.forEach((it, i) => {
      const cx = -0.4 + (i % 3) * 0.4, cy = 0.24 - Math.floor(i / 3) * 0.26;
      const tex = cardTexture([{ text: it.kind, size: 24, weight: 700, color: it.kind === 'FICTIONAL' ? '#8c2d35' : '#2f4a3a', gap: 6 }, { text: it.title, size: 26 }], { w: 320, h: 220, bg: it.kind === 'OBSERVATION' ? '#f4efe4' : '#efe2c8' });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
      card.position.set(cx, cy, 0.0135);
      card.rotation.z = Math.sin(i * 2.3) * 0.05;
      grp.add(card);
      pins.add(cyl(0.008, 0.008, 0.003, 10), pinMat, { pos: [cx, cy + 0.075, 0.0155], rot: [Math.PI / 2, 0, 0] });
      pts.push(V(cx, cy + 0.075, 0.016));
    });
    if (!pins.empty) grp.add(pins.build('pins', { cast: false }));
    if (pts.length > 1) grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8c2d35' })));
    if (!list.length) {
      const tex = cardTexture([{ text: 'EVIDENCE BOARD', size: 36, font: 'display', weight: 700, gap: 10 }, { text: 'Your findings are pinned here as you record them.', size: 26 }], { w: 512, h: 220 });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
      card.position.set(0, 0.12, 0.0135);
      grp.add(card);
    }
  }

  // ------------------------------------------------------------------ archive corner
  _archive() {
    const H = 2.9;
    const p = new Parts();
    // Alcove x 6..9.6, z -4.4..0.4 with green plaster, a ceiling and skirting.
    p.add(new THREE.PlaneGeometry(3.6, H), this.M.plasterArchive, { pos: [7.8, H / 2, -4.4], uv: [2.4, 2] });
    p.add(new THREE.PlaneGeometry(3.6, H), this.M.plasterArchive, { pos: [7.8, H / 2, 0.4], rot: [0, Math.PI, 0], uv: [2.4, 2] });
    p.add(new THREE.PlaneGeometry(4.8, H), this.M.plasterArchive, { pos: [9.6, H / 2, -2], rot: [0, -Math.PI / 2, 0], uv: [3, 2] });
    p.add(new THREE.PlaneGeometry(3.6, 4.8), this.M.ceiling, { pos: [7.8, H, -2], rot: [Math.PI / 2, 0, 0] });
    p.add(new THREE.PlaneGeometry(3.6, 4.8), this.M.floor, { pos: [7.8, 0.001, -2], rot: [-Math.PI / 2, 0, 0] });
    p.add(new THREE.PlaneGeometry(1.8, H), this.M.plasterArchive, { pos: [6.001, H / 2, -3.8], rot: [0, Math.PI / 2, 0] });
    p.add(new THREE.PlaneGeometry(1.2, H), this.M.plasterArchive, { pos: [6.001, H / 2, -0.2], rot: [0, Math.PI / 2, 0] });
    p.add(new THREE.PlaneGeometry(2.4, H - 2.5), this.M.plasterArchive, { pos: [6.001, (H + 2.5) / 2, -2], rot: [0, Math.PI / 2, 0] });
    for (const [w, x, z, ry] of [[3.6, 7.8, -4.38, 0], [3.6, 7.8, 0.38, Math.PI], [4.8, 9.58, -2, -Math.PI / 2]]) p.add(box(w, 0.12, 0.03), this.M.woodDark, { pos: [x, 0.06, z], rot: [0, ry, 0] });
    this._add(p.build('archive room', { cast: false }));
    // Door frame and the door standing open into the archive.
    const d = new Parts();
    d.add(box(0.3, 2.56, 0.12), this.M.woodDark, { pos: [6, 1.28, -3.26] });
    d.add(box(0.3, 2.56, 0.12), this.M.woodDark, { pos: [6, 1.28, -0.74] });
    d.add(box(0.3, 0.12, 2.64), this.M.woodDark, { pos: [6, 2.56, -2] });
    this._add(d.build('archive doorway', { cast: false }));
    const door = new THREE.Mesh(box(0.05, 2.4, 1.1), this.M.wood);
    door.position.set(6.42, 1.2, -0.45);
    door.rotation.y = -1.2;
    this._add(door);
    this.colliders.push(new THREE.Box3(V(9.6, -1, -5), V(11, 5, 1)), new THREE.Box3(V(6, -1, -5.4), V(9.6, 5, -4.4)), new THREE.Box3(V(6, -1, 0.4), V(9.6, 5, 1.4)), new THREE.Box3(V(6, H, -4.4), V(9.6, 5, 0.4)));
  }

  // ------------------------------------------------------------------ props
  /**
   * Poly Haven CC0 props. `names` picks which ones (the first tier loads the
   * light ones before the first interaction, the rest stream after it).
   */
  async _props(names = null) {
    const P = this.o.props, A = this.o.assets.props;
    const load = (file) => loadGLB(this.renderer, file).then((g) => shadows(g.scene)).catch(() => null);
    this._propsDone ||= new Set();
    const want = (n) => (!names || names.includes(n)) && !this._propsDone.has(n) && this._propsDone.add(n);
    const jobs = [
      want('clock') && load(P.vintage_grandfather_clock_01.file).then((m) => {
        if (!m) return;
        const g = restOnFloor(m);
        g.position.set(ROOM.minX + 0.25, 0, 1.6);
        g.rotation.y = Math.PI / 2;
        g.name = 'grandfather clock';
        this._add(g);
        this.clock = { group: g, hour: m.getObjectByName('vintage_grandfather_clock_01_HourHand'), minute: m.getObjectByName('vintage_grandfather_clock_01_MinuteHand') };
        // Seconds pendulum behind the trunk glass (just under 1 m long).
        const pend = new THREE.Group();
        const pp = new Parts();
        pp.add(cyl(0.006, 0.006, 0.82, 8), this.M.brass, { pos: [0, -0.41, 0] });
        pp.add(cyl(0.07, 0.07, 0.016, 24), this.M.brass, { pos: [0, -0.84, 0], rot: [Math.PI / 2, 0, 0] });
        pend.add(pp.build('pendulum', { cast: false }));
        pend.position.set(0, 1.5, 0.12);
        g.add(pend);
        this.clock.pendulum = pend;
        this._lateRegister('grandfather-clock', g);
      }),
      want('chandelier') && load(P.Chandelier_01.file).then((m) => {
        if (!m) return;
        m.traverse((c) => { if (c.isMesh && c.material && 'emissiveIntensity' in c.material && /lamp/i.test(c.material.name)) { c.material.emissive = new THREE.Color('#ffcf8a'); c.material.emissiveIntensity = 1.2; this.chandelierGlass = c.material; } c.castShadow = false; });
        const g = restOnFloor(m);
        g.position.set(0, ROOM.H - 0.95, -2.2);
        g.name = 'chandelier';
        const chain = new THREE.Mesh(cyl(0.008, 0.008, 0.2, 6), this.M.brass);
        chain.position.y = 0.88;
        g.add(chain);
        this._add(g);
        this._lateRegister('chandelier', g);
      }),
      want('cabinet') && load(P.drawer_cabinet.file).then((m) => {
        if (!m) return;
        const g = restOnFloor(m);
        g.position.set(9.3, 0, -1.6);
        g.rotation.y = -Math.PI / 2;
        g.name = 'archive drawer cabinet';
        // Index cards in the drawer fronts' brass frames (fictional documents).
        this._add(g);
        this._lateRegister('archive-cabinet', g);
      }),
      want('bookshelf') && load(P.wooden_bookshelf_worn.file).then((m) => {
        if (!m) return;
        const g = restOnFloor(m);
        g.position.set(9.3, 0, -3.6);
        g.rotation.y = -Math.PI / 2;
        g.name = 'reference shelves';
        this._add(g);
        this._lateRegister('bookshelf', g);
      }),
      want('lamp') && load(P.desk_lamp_arm_01.file).then((m) => {
        if (!m) return;
        const g = restOnFloor(m);
        g.position.set(-0.55, TABLE.top, TABLE.z - 0.18);
        g.rotation.y = 0.9;
        g.name = 'raking light lamp';
        this._add(g);
        this.rakeLamp = g;
        this._lateRegister('raking-light', g);
      }),
      want('bench') && load(A.Ottoman_01.file).then((m) => {
        if (!m) return;
        const g = restOnFloor(m);
        g.position.set(-4.3, 0, -2.6);
        g.rotation.y = Math.PI / 2;
        g.name = 'gallery bench';
        this._add(g);
        this._lateRegister('bench', g);
      }),
      want('camera') && load(A.security_camera_01.file).then((m) => {
        if (!m) return;
        const holder = new THREE.Group();
        holder.position.set(5.55, 3.75, -7.55);
        // The camera hangs from its wall bracket and pans about its vertical axis.
        m.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(m);
        const c = b.getCenter(new THREE.Vector3());
        m.position.set(-c.x, -b.max.y, -c.z);
        const pan = new THREE.Group();
        pan.add(m);
        holder.add(pan);
        holder.userData.scaleFrame = 'local';
        holder.name = 'security camera';
        this._add(holder);
        this.secCam = { holder, pan, base: Math.PI * 0.75 };
        pan.rotation.y = this.secCam.base;
        this._lateRegister('security-camera', holder);
      }),
      want('magnifier') && load(A.magnifying_glass_01.file).then((m) => {
        if (!m) return;
        const g = new THREE.Group();
        m.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(m);
        const c = b.getCenter(new THREE.Vector3());
        m.position.sub(c);
        g.add(m);
        // Lying flat on the table: the 2.7 cm thickness is now the height.
        g.rotation.set(-Math.PI / 2, 0, 0.5);
        g.position.set(-0.42, TABLE.top + 0.0134, TABLE.z + 0.25);
        g.userData.scaleFrame = 'local';
        g.name = 'magnifier';
        this._add(g);
        this.magnifierProp = g;
        this._lateRegister('magnifier', g);
      }),
    ].filter(Boolean);
    await Promise.allSettled(jobs);
  }

  // ------------------------------------------------------------------ lights
  _lights() {
    const L = new THREE.Group();
    L.name = 'lights';
    this.hemi = new THREE.HemisphereLight('#b9c6dc', '#2a2118', 0.3);
    L.add(this.hemi);
    this.moon = new THREE.DirectionalLight('#9db4d8', 0.5);
    this.moon.position.set(-1.5, 5, -14);
    this.moon.target.position.set(0.5, 0, -3);
    L.add(this.moon, this.moon.target);
    this.chandelierLight = new THREE.PointLight('#ffd9a0', 7, 9, 2);
    this.chandelierLight.position.set(0, ROOM.H - 0.85, -2.2);
    L.add(this.chandelierLight);
    // Track spots: one per tall vitrine; the bench cases share two.
    this.trackLights = [];
    const spot = (x, z, tx, tz, ty, power = 16, angle = 0.3) => {
      const s = new THREE.SpotLight('#ffd7a8', power, 6, angle, 0.55, 2);
      s.position.set(x, ROOM.H - 0.35, z);
      s.target.position.set(tx, ty, tz);
      L.add(s, s.target);
      this.trackLights.push(s);
      return s;
    };
    for (const v of VITRINES) spot(v.x, v.z + 1.0, v.x, v.z, 1.05);
    spot(2.6, 1.6, 2.5, 3.05, 0.85, 14, 0.42);
    spot(4.4, 1.6, 4.45, 3.05, 0.85, 12, 0.36);
    // The Muse gets its own picture light.
    this.museLight = new THREE.SpotLight('#ffe2b8', 14, 6, 0.5, 0.7, 2);
    this.museLight.position.set(ROOM.minX + 1.4, ROOM.H - 0.3, -2.6);
    this.museLight.target.position.set(ROOM.minX, 2.0, -2.6);
    L.add(this.museLight, this.museLight.target);
    // Studio key over the inspection table (the only shadow-casting gallery light).
    this.key = new THREE.SpotLight('#fff4e8', 7, 4.5, 0.55, 0.9, 2);
    this.key.position.set(-0.6, TABLE.top + 1.5, STAGE_POS.z + 1.0);
    this.key.target.position.copy(STAGE_POS);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.01;
    this.key.shadow.camera.near = 0.3;
    this.key.shadow.camera.far = 4;
    L.add(this.key, this.key.target);
    // Archive picture light.
    this.archiveLight = new THREE.SpotLight('#ffd7a8', 6, 4.5, 0.6, 0.7, 2);
    this.archiveLight.position.set(8.4, 2.75, -2.0);
    this.archiveLight.target.position.set(9.4, 1.0, -2.4);
    L.add(this.archiveLight, this.archiveLight.target);
    this._add(L);
  }

  /** Ceiling track and spot cans (catalog: picture-lights), with visible beams. */
  _trackFixtures() {
    const fixtures = [];
    const track = new Parts();
    for (const z of [-5.1, -2.5, 1.6]) track.add(box(9.2, 0.03, 0.05), this.M.blackMetal, { pos: [0, ROOM.H - 0.2, z] });
    this._add(track.build('lighting track', { cast: false }));
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0.07 }, uColor: { value: new THREE.Color('#ffdcae') } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uOpacity; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(abs(dot(vN, vV)), 1.5); gl_FragColor = vec4(uColor, uOpacity * rim * smoothstep(0.0, 0.35, vY) * (0.4 + 0.6 * vY)); }',
    });
    this.beamMat = beamMat;
    for (const s of this.trackLights) {
      const g = new THREE.Group();
      g.position.copy(s.position);
      g.lookAt(s.target.position);
      const can = new Parts();
      can.add(cyl(0.045, 0.05, 0.2, 16), this.M.blackMetal, { pos: [0, 0, 0.06], rot: [Math.PI / 2, 0, 0] });
      can.add(box(0.012, 0.12, 0.012), this.M.blackMetal, { pos: [0, 0.1, 0] });
      can.add(cyl(0.04, 0.04, 0.006, 16), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffe0b0', emissiveIntensity: 3, name: 'spot-lens' }), { pos: [0, 0, 0.162], rot: [Math.PI / 2, 0, 0] });
      const fx = can.build('track spotlight', { cast: false });
      g.add(fx);
      const len = s.position.distanceTo(s.target.position);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, Math.tan(s.angle) * len * 0.8, len, 24, 1, true), beamMat);
      beam.rotation.x = -Math.PI / 2;
      beam.position.z = len / 2 + 0.16;
      beam.raycast = () => {};
      beam.userData.noOutline = true;
      g.add(beam);
      this._add(g);
      fixtures.push(fx);
    }
    this._register('picture-lights', fixtures);
  }

  /** Dust motes drifting through the spotlight beams (illustrative). */
  _dust() {
    const n = 420;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    const beams = this.trackLights.slice(0, 6);
    for (let i = 0; i < n; i++) {
      const s = beams[i % beams.length];
      const k = Math.random();
      const p = s.position.clone().lerp(s.target.position, 0.15 + k * 0.8);
      const r = 0.05 + Math.tan(s.angle) * s.position.distanceTo(s.target.position) * 0.6 * k;
      p.x += (Math.random() - 0.5) * r * 2; p.z += (Math.random() - 0.5) * r * 2;
      pos.set([p.x, p.y, p.z], i * 3);
      seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float seed; uniform float uTime; uniform float uPx; varying float vA;
        void main(){ vec3 p = position + vec3(sin(uTime*0.11+seed)*0.12, sin(uTime*0.07+seed*1.7)*0.18, cos(uTime*0.09+seed*0.6)*0.12);
          vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = clamp(uPx * 6.0 / -mv.z, 1.0, 6.0);
          vA = 0.45 + 0.35 * sin(uTime*0.6 + seed*3.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 0.92, 0.78, vA * smoothstep(0.5, 0.0, d)); }',
    });
    const pts = new THREE.Points(geo, this.dustMat);
    pts.frustumCulled = false;
    pts.raycast = () => {};
    pts.name = 'dust motes';
    this._add(pts);
  }

  /** Night guard's torch: a beam and its pool of light passing the archive now and then (the guard is never shown). */
  _torch() {
    const g = new THREE.Group();
    g.name = 'night guard torch';
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.5, 2.2, 20, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0.0 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uOpacity; varying float vY; void main(){ gl_FragColor = vec4(1.0, 0.84, 0.56, uOpacity * (0.25 + 0.75 * vY)); }',
    }));
    blade.rotation.z = Math.PI / 2 - 0.35;
    blade.position.set(-0.9, -0.35, 0);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshBasicMaterial({ map: this._softDisc('rgba(255,214,150,1)'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-1.6, -1.42, 0);
    g.add(blade, pool);
    g.position.set(8.9, 1.45, -3.6);
    this.torchBeam = new THREE.SpotLight('#ffc47e', 0, 6, 0.42, 0.7, 2);
    this.torchBeam.position.set(0, 0, 0);
    g.add(this.torchBeam);
    this.torchBeam.target.position.set(-1.8, -1.4, 0);
    g.add(this.torchBeam.target);
    this._add(g);
    this.torch = { group: g, blade, pool };
    this._register('night-guard', g);
  }

  // ------------------------------------------------------------------ modes and motion
  /** 'gallery' (after-hours room), 'inspect' (studio key on the table) or 'raking' (only the raking light). */
  setMode(mode) {
    this.mode = mode;
    const env = { gallery: 1.0, inspect: 0.9, raking: 0.05 }[mode];
    this.scene.environmentIntensity = env;
    const warm = { gallery: 1, inspect: 0.6, raking: 0.05 }[mode];
    this.hemi.intensity = { gallery: 0.3, inspect: 0.16, raking: 0.0 }[mode];
    this.key.intensity = { gallery: 3, inspect: 7, raking: 0 }[mode];
    for (const s of this.trackLights) s.intensity = 16 * warm;
    this.museLight.intensity = 14 * warm;
    this.archiveLight.intensity = 6 * warm;
    this.moon.intensity = 0.5 * Math.max(0.15, warm);
    this._warm = warm;
    if (this.beamMat) this.beamMat.uniforms.uOpacity.value = 0.07 * warm;
  }

  /** Motion systems (plan §5): >= 8 over the four layers, each accurate or labelled on its card. */
  addMotion(motion) {
    const M = this;
    motion.add({ id: 'night-clouds', layer: 'sky', label: 'illustrative', objects: ['windows-rain'], description: 'Clouds drift across the night sky above the street.',
      update: (dt, t) => { M.skyMat.uniforms.uTime.value = t; } });
    motion.add({ id: 'rain-on-glass', layer: 'environment', label: 'illustrative', objects: ['windows-rain'], holdWithCard: false, description: 'Rain drops grow, join and run down the window glass.',
      update: (dt, t) => { for (const m of M.rainMats) m.uniforms.uTime.value = t; } });
    motion.add({ id: 'dust-motes', layer: 'environment', label: 'illustrative', objects: ['picture-lights'], holdWithCard: false, description: 'Dust motes drift and catch the light in the spotlight beams.',
      update: (dt, t) => { M.dustMat.uniforms.uTime.value = t; } });
    motion.add({ id: 'curtain-draught', layer: 'environment', label: 'illustrative', objects: ['curtains'], holdWithCard: false, description: 'The curtains stir in a draught from the old windows.',
      update: (dt, t) => { for (const c of M.curtains) M._foldCurtain(c, t); } });
    motion.add({ id: 'guard-torch', layer: 'agents', label: 'illustrative', objects: ['night-guard'], description: 'The night guard walks past the archive about every 25 seconds; only the torch beam is seen.',
      update: (dt, t) => {
        const period = 25, k = (t % period) / period;
        const on = k < 0.3 ? Math.sin((k / 0.3) * Math.PI) : 0;
        M.torch.group.position.z = THREE.MathUtils.lerp(-4.1, 0.0, k);
        M.torch.group.rotation.y = Math.sin(t * 1.3) * 0.25;
        M.torch.blade.material.uniforms.uOpacity.value = on * 0.22;
        M.torch.pool.material.opacity = on * 0.6;
        M.torchBeam.intensity = on * 22;
      } });
    motion.add({ id: 'passing-cars', layer: 'agents', label: 'illustrative', objects: ['windows-rain'], description: 'Now and then a car passes on the wet street; its headlights sweep across the ceiling.',
      update: (dt, t) => {
        const period = 16, k = (t % period) / period;
        const x = THREE.MathUtils.lerp(-30, 30, k); // 60 m in 16 s, about 13 km/h (illustrative timing)
        M.car.position.x = x;
        const near = Math.max(0, 1 - Math.abs(x) / 10);
        M.headSweep.material.opacity = near * 0.22;
        M.headSweep.position.x = -x * 0.25;
      } });
    motion.add({ id: 'lit-windows', layer: 'agents', label: 'illustrative', objects: ['windows-rain'], description: 'Lights in the building across the street switch on and off.',
      update: (dt) => {
        const L = M.litWindows;
        L.t += dt;
        if (L.t < 4) return;
        L.t = 0;
        const i = Math.floor(Math.random() * L.state.length);
        L.state[i] = !L.state[i];
        M._drawLit();
      } });
    motion.add({ id: 'clock-pendulum', layer: 'objects', label: 'accurate', objects: ['grandfather-clock'], holdWithCard: false, description: 'The seconds pendulum swings once each second; the hands move at clock speed from about 9:40 pm.',
      update: (dt, t) => {
        if (!M.clock) return;
        // Real clock speed: a 2 s period (one swing per second), hands from 9:40 pm.
        M.clock.pendulum.rotation.z = 0.06 * Math.sin(Math.PI * M._clockT(t));
        const minutes = 40 + M._clockT(t) / 60;
        if (M.clock.minute) M.clock.minute.rotation.z = -(minutes / 60) * Math.PI * 2;
        if (M.clock.hour) M.clock.hour.rotation.z = -((9 + minutes / 60) / 12) * Math.PI * 2;
      } });
    motion.add({ id: 'security-camera-pan', layer: 'objects', label: 'illustrative', objects: ['security-camera'], description: 'The security camera pans slowly across the gallery and back.',
      update: (dt, t) => { if (M.secCam) M.secCam.pan.rotation.y = M.secCam.base + Math.sin(t * 0.18) * 0.55; } });
    motion.add({ id: 'exit-flicker', layer: 'objects', label: 'illustrative', objects: ['exit-sign'], holdWithCard: false, description: 'The exit sign dims now and then, slowly and within flash-safety limits.',
      update: (dt, t) => {
        // At most one slow dip every ~9 s (well under 3 flashes a second, WCAG 2.3.1).
        const k = t % 9.3;
        const dip = k < 0.7 ? 0.45 * Math.sin((k / 0.7) * Math.PI) : 0;
        M.exitMat.emissiveIntensity = 1.6 * (1 - dip);
      } });
    motion.add({ id: 'chandelier-flicker', layer: 'objects', label: 'illustrative', objects: ['chandelier'], holdWithCard: false, description: 'The chandelier\'s candle bulbs flicker gently.',
      update: (dt, t) => {
        const f = 0.88 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.2);
        M.chandelierLight.intensity = 7 * f * (M._warm ?? 1);
        if (M.chandelierGlass) M.chandelierGlass.emissiveIntensity = 1.2 * f;
      } });
  }

  /** Scene seconds for the clock (real time, so the pendulum and hands run at clock speed). */
  _clockT(t) { return t; }

  /** Legend for cues and markers in this scene (controls dialog, ui-audit marker gate). */
  legend() {
    return [
      { label: 'Point-of-interest tag', text: 'A small numbered tag on the object on the inspection table marks a spot to examine (Spot 1, 2, 3…).' },
      { label: 'Magnifier lens', text: 'A round lens that shows the surface under it magnified 2, 4 or 8 times.' },
      { label: 'Measurement line', text: 'A yellow line between the two points you measured.' },
      { label: 'Task glint', text: 'A soft star over the object the current step asks you to open.' },
    ];
  }
}

/** Photographic sweep: flat floor (+z), quarter-circle bend, vertical rise at the back (-z). */
export function makeSweep(width = 1.3, flat = 0.42, radius = 0.18, rise = 0.48, seg = 16) {
  const profile = [[flat, 0], [0, 0]];
  for (let i = 1; i <= seg; i++) { const a = (i / seg) * (Math.PI / 2); profile.push([-Math.sin(a) * radius, radius - Math.cos(a) * radius]); }
  profile.push([-radius, radius + rise]);
  const pos = [], uv = [], idx = [];
  profile.forEach(([z, y], r) => { for (let c = 0; c < 2; c++) { pos.push((c - 0.5) * width, y, z); uv.push(c, r / (profile.length - 1)); } });
  for (let r = 0; r < profile.length - 1; r++) { const a = r * 2, b = a + 2; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 30 cm ruler with millimetre ticks (true-size view). */
export function makeRuler() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 220;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#1a1a1a';
  g.font = '600 44px "Source Sans 3", system-ui, sans-serif';
  g.textAlign = 'center';
  const pxPerCm = c.width / 30;
  for (let mm = 0; mm <= 300; mm++) {
    const x = Math.round(mm * (pxPerCm / 10));
    const len = mm % 10 === 0 ? 90 : mm % 5 === 0 ? 60 : 34;
    g.fillRect(Math.min(x, c.width - 3), 0, mm % 10 === 0 ? 4 : 2, len);
    if (mm % 10 === 0 && mm > 0 && mm < 300) g.fillText(String(mm / 10), x, 150);
  }
  g.font = '32px "Source Sans 3", system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('cm', 12, 200);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  const side = new THREE.MeshStandardMaterial({ color: '#d9d3c3', roughness: 0.6, map: t });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.002, 0.032), [side, side, top, side, side, side]);
  m.castShadow = true;
  m.name = 'ruler';
  return m;
}

export { DEG };
