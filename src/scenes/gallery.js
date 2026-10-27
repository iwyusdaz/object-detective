/**
 * The Lantern Museum (fictional) gallery after hours: modeled room with CC0
 * ambientCG materials, display cases, track lights, and an inspection table
 * with a neutral photographic sweep. HDRI (Poly Haven, CC0) provides IBL.
 * Realism matrix: gallery = medium realism, NOT a learning cue; it is dimmed
 * during inspection (setMode('inspect')).
 * 1 unit = 1 metre. Table top at y = TABLE_Y.
 * @module scenes/gallery
 */
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { assetURL } from '../core/assets.js';

export const TABLE_Y = 0.9;
export const CASE_POS = new THREE.Vector3(0, 1.05, -4.2); // top of the centre plinth

function tex(loader, path, { srgb = false, repeat = [1, 1] } = {}) {
  const t = loader.load(assetURL(path));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pbr(loader, textures, id, repeat, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map: tex(loader, textures[`${id}_Color`], { srgb: true, repeat }),
    normalMap: tex(loader, textures[`${id}_NormalGL`], { repeat }),
    roughnessMap: tex(loader, textures[`${id}_Roughness`], { repeat }),
    ...extra,
  });
}

/** Photographic sweep: flat floor, quarter-circle bend, vertical rise (swept along x). */
export function makeSweep(width = 1.4, flat = 0.55, radius = 0.25, rise = 0.55, seg = 16) {
  const profile = [];
  profile.push([flat, 0]);
  profile.push([0, 0]);
  for (let i = 1; i <= seg; i++) {
    const a = (i / seg) * (Math.PI / 2);
    profile.push([-Math.sin(a) * radius, radius - Math.cos(a) * radius]);
  }
  profile.push([-radius, radius + rise]);
  const pos = []; const uv = []; const idx = [];
  const cols = 2;
  profile.forEach(([z, y], r) => {
    for (let c = 0; c < cols; c++) {
      pos.push((c - 0.5) * width, y, z);
      uv.push(c, r / (profile.length - 1));
    }
  });
  for (let r = 0; r < profile.length - 1; r++) {
    const a = r * cols; const b = a + cols;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Gallery {
  constructor(scene, renderer, textures, hdriPath) {
    this.scene = scene;
    this.renderer = renderer;
    this.root = new THREE.Group();
    this.root.name = 'gallery';
    scene.add(this.root);
    const loader = new THREE.TextureLoader();
    this.floorMat = pbr(loader, textures, 'WoodFloor043', [6, 6]);
    this.wallMat = pbr(loader, textures, 'Plaster001', [5, 2], { color: new THREE.Color('#d9d2c4') });
    this.feltMat = pbr(loader, textures, 'Fabric026', [3, 2], { color: new THREE.Color('#3b4250') });
    this._buildRoom();
    this._buildCases();
    this._buildTable();
    this._buildLights();
    this._loadHDRI(hdriPath);
    this.setMode('gallery');
  }

  _loadHDRI(path) {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    new HDRLoader().load(assetURL(path), (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      this.envMap = pmrem.fromEquirectangular(hdr).texture;
      this.scene.environment = this.envMap;
      hdr.dispose();
      pmrem.dispose();
      this.ready = true;
    });
  }

  _buildRoom() {
    const W = 12; const D = 12; const H = 3.6;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -2;
    floor.receiveShadow = true;
    this.root.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, H, -2);
    this.root.add(ceil);
    const wallDefs = [
      [W, [0, H / 2, -8], 0], [W, [0, H / 2, 4], Math.PI],
      [D, [-6, H / 2, -2], Math.PI / 2], [D, [6, H / 2, -2], -Math.PI / 2],
    ];
    for (const [w, p, ry] of wallDefs) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), this.wallMat);
      m.position.set(...p);
      m.rotation.y = ry;
      m.receiveShadow = true;
      this.root.add(m);
    }
    // skirting board
    const skirtMat = new THREE.MeshStandardMaterial({ color: '#2c2620', roughness: 0.6 });
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, 0.02), skirtMat);
    skirt.position.set(0, 0.06, -7.99);
    this.root.add(skirt);
  }

  _buildCases() {
    const plinthMat = new THREE.MeshStandardMaterial({ color: '#1f2329', roughness: 0.55 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.2, depthWrite: false });
    this.cases = [];
    for (const x of [-2.4, 0, 2.4]) {
      const g = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.8), plinthMat);
      plinth.position.y = 0.525;
      plinth.castShadow = plinth.receiveShadow = true;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.01, 0.76), this.feltMat);
      deck.position.y = 1.055;
      deck.receiveShadow = true;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.6, 0.78), glassMat);
      glass.position.y = 1.36;
      glass.renderOrder = 10;
      g.add(plinth, deck, glass);
      g.position.set(x, 0, -4.2);
      this.root.add(g);
      this.cases.push(g);
    }
  }

  _buildTable() {
    const t = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 0.5 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.9), woodMat);
    top.position.y = TABLE_Y - 0.02;
    top.castShadow = top.receiveShadow = true;
    t.add(top);
    for (const [x, z] of [[-0.74, -0.38], [0.74, -0.38], [-0.74, 0.38], [0.74, 0.38]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, TABLE_Y - 0.04, 0.05), woodMat);
      leg.position.set(x, (TABLE_Y - 0.04) / 2, z);
      leg.castShadow = true;
      t.add(leg);
    }
    const sweepMat = new THREE.MeshStandardMaterial({ color: '#77797c', roughness: 0.95, side: THREE.DoubleSide });
    const sweep = new THREE.Mesh(makeSweep(1.5, 0.55, 0.22, 0.6), sweepMat);
    sweep.position.set(0, TABLE_Y + 0.001, 0.05);
    sweep.receiveShadow = true;
    t.add(sweep);
    this.sweep = sweep;
    this.table = t;
    this.root.add(t);
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight('#c9d4e6', '#2a2118', 0.25);
    this.root.add(this.hemi);
    this.trackLights = [];
    for (const c of this.cases) {
      const s = new THREE.SpotLight('#ffd7a8', 18, 5, 0.32, 0.6, 2);
      s.position.set(c.position.x, 3.4, -3.3);
      s.target.position.set(c.position.x, 1.1, -4.2);
      this.root.add(s, s.target);
      this.trackLights.push(s);
    }
    // Studio key light over the inspection table (soft, from front-left-above).
    this.key = new THREE.SpotLight('#fff4e8', 9, 4, 0.5, 0.9, 2);
    this.key.position.set(-0.7, TABLE_Y + 1.3, 1.1);
    this.key.target.position.set(0, TABLE_Y + 0.05, 0);
    this.key.castShadow = true;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.01;
    this.root.add(this.key, this.key.target);
  }

  setShadowSize(size) {
    for (const l of [this.key]) {
      l.castShadow = size > 0;
      if (size > 0) { l.shadow.mapSize.set(size, size); l.shadow.map?.dispose(); l.shadow.map = null; }
    }
  }

  /** 'gallery' (dim after-hours room), 'inspect' (room dimmed, studio key on), 'raking' (only the raking light). */
  setMode(mode) {
    this.mode = mode;
    const env = { gallery: 0.35, inspect: 0.55, raking: 0.04 }[mode];
    this.scene.environmentIntensity = env;
    this.hemi.intensity = mode === 'raking' ? 0.0 : mode === 'inspect' ? 0.12 : 0.25;
    this.key.intensity = mode === 'raking' ? 0 : mode === 'inspect' ? 9 : 4;
    for (const s of this.trackLights) s.intensity = mode === 'gallery' ? 18 : 3;
  }
}
