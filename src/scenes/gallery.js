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
import { AmbientLifeManager } from '../v2/ambient-life.js';
import { ModelLibrary } from '../v2/model-placer.js';

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

/** Greedy word wrap to a max character width. */
export function wrapText(text, width) {
  const out = [];
  for (const para of String(text).split(/\n+/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if ((line + ' ' + word).trim().length > width) { if (line) out.push(line); line = word; } else line = (line + ' ' + word).trim();
    }
    if (line) out.push(line);
  }
  return out;
}

function textTexture(lines, { w, h, bg, fg, font, firstBold = true }) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textBaseline = 'top';
  let y = font * 0.9;
  lines.forEach((l, i) => {
    g.font = `${i === 0 && firstBold ? 'bold ' : ''}${font}px Georgia, serif`;
    g.fillText(l, font * 0.8, y);
    y += font * (i === 0 ? 1.6 : 1.3);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Streaky rain texture for the window glass (scrolled in _buildLife). */
function makeRainTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(200, 216, 232, 0.75)';
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 256;
    const len = 8 + Math.random() * 34;
    g.globalAlpha = 0.18 + Math.random() * 0.5;
    g.lineWidth = Math.random() < 0.2 ? 1.6 : 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 1.5, y + len);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

export const H_CHAND = 3.6;

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
    this._buildLife();
    this._loadHDRI(hdriPath);
    // Poly Haven furniture (async, fails soft if the manifest is unavailable).
    this.library = new ModelLibrary();
    this.library.place(this.root, 'Chandelier_01', { position: [0, H_CHAND - 0.05, -2], targetHeight: 1.05, contactShadow: false })
      .then((m) => { if (m) { m.traverse((c) => { if (c.isMesh && c.material && 'emissiveIntensity' in c.material) c.material.emissiveIntensity = 0.55; }); } })
      .catch(() => {});
    this.library.place(this.root, 'vintage_grandfather_clock_01', { position: [-5.45, 0, -3.4], rotationY: Math.PI / 2, targetHeight: 2.05 })
      .then((m) => { if (m) { this.clock = m; this._buildPendulum(m); } })
      .catch(() => {});
    this.library.place(this.root, 'drawer_cabinet', { position: [8.1, 0, -1.9], rotationY: -Math.PI / 2, targetHeight: 1.05 })
      .then((m) => {
        if (!m) return;
        this.cabinet = m;
        const top = new THREE.Box3().setFromObject(m).max.y;
        this.library.place(this.root, 'ceramic_vase_01', { position: [8.1, top - 0.02, -1.55], targetHeight: 0.3, contactShadow: false }).catch(() => {});
        this.library.place(this.root, 'Lantern_01', { position: [8.32, top - 0.02, -2.3], targetHeight: 0.34, contactShadow: false }).catch(() => {});
      })
      .catch(() => {});
    this.library.place(this.root, 'wooden_bookshelf_worn', { position: [8.15, 0, -4.02], targetHeight: 2.1 })
      .then((m) => { this.bookshelf = m; })
      .catch(() => {});
    this.library.place(this.root, 'desk_lamp_arm_01', { position: [-0.58, TABLE_Y - 0.02, -0.3], rotationY: 2.3, targetHeight: 0.42, contactShadow: false })
      .then((m) => {
        if (!m) return;
        this.deskLamp = m;
        const lamp = new THREE.PointLight('#ffd9a0', 1.6, 1.6, 2);
        lamp.position.set(-0.45, TABLE_Y + 0.3, -0.1);
        this.root.add(lamp);
        this.lampLight = lamp;
      })
      .catch(() => {});
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
    this.H = H;
    this._buildWalls();
    this._buildWainscoting();
    this._buildWindows();
    this._buildDoorway();
    this._buildArchive();
    this._buildEvidenceBoard();
  }

  /** Wall planes with real openings: two tall windows (back wall) and a doorway (east wall). */
  _buildWalls() {
    const W = 12; const D = 12;
    const H = this.H;
    const add = (w, h, p, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.wallMat);
      m.position.set(...p);
      m.rotation.y = ry;
      m.receiveShadow = true;
      this.root.add(m);
      return m;
    };
    // back wall z=-8, window openings x in [-4.8,-2.6] and [2.6,4.8], y in [1.1,3.2]
    add(1.2, H, [-5.4, H / 2, -8], 0);          // far left pier
    add(5.2, H, [0, H / 2, -8], 0);             // pier between the windows
    add(1.2, H, [5.4, H / 2, -8], 0);           // far right pier
    add(2.2, 1.1, [-3.7, 0.55, -8], 0);         // below left window
    add(2.2, H - 3.2, [-3.7, (H + 3.2) / 2, -8], 0); // above left window
    add(2.2, 1.1, [3.7, 0.55, -8], 0);
    add(2.2, H - 3.2, [3.7, (H + 3.2) / 2, -8], 0);
    // front wall z=4
    add(W, H, [0, H / 2, 4], Math.PI);
    // west wall x=-6
    add(D, H, [-6, H / 2, -2], Math.PI / 2);
    // east wall x=6 with doorway opening z in [-3.2,-0.8], y in [0,2.4]
    add(8.8, H, [6, H / 2, 1.6], -Math.PI / 2);       // south of doorway
    add(1.2, H, [6, H / 2, -3.8], -Math.PI / 2);      // north of doorway
    add(2.4, H - 2.4, [6, (H + 2.4) / 2, -2], -Math.PI / 2); // above doorway
  }

  /** Oxblood wainscoting band, dado rail, brass picture rail and skirting on every wall. */
  _buildWainscoting() {
    const H = this.H;
    const wainMat = new THREE.MeshStandardMaterial({ color: '#5B1A1F', roughness: 0.52, metalness: 0.05 });
    const railMat = new THREE.MeshStandardMaterial({ color: '#B08D57', roughness: 0.35, metalness: 0.75 });
    const skirtMat = new THREE.MeshStandardMaterial({ color: '#241d18', roughness: 0.6 });
    const band = (w, pos, ry) => {
      const g = new THREE.Group();
      g.rotation.y = ry;
      g.position.set(...pos);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.92), wainMat);
      panel.position.y = 0.58;
      g.add(panel);
      const dado = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.05), railMat);
      dado.position.set(0, 1.04, 0.01);
      g.add(dado);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.035), skirtMat);
      skirt.position.set(0, 0.07, 0.008);
      g.add(skirt);
      this.root.add(g);
    };
    band(12, [0, 0, -7.98], 0);
    band(12, [0, 0, 3.98], Math.PI);
    band(12, [-5.98, 0, -2], Math.PI / 2);
    band(8.8, [5.98, 0, 1.6], -Math.PI / 2);
    band(1.2, [5.98, 0, -3.8], -Math.PI / 2);
    // brass picture rail at 2.6 m, gallery walls only
    const rail = (w, pos, ry) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.045, 0.04), railMat);
      r.position.set(...pos);
      r.rotation.y = ry;
      this.root.add(r);
    };
    rail(12, [0, 2.6, -7.97], 0);
    rail(12, [0, 2.6, 3.97], Math.PI);
    rail(12, [-5.97, 2.6, -2], Math.PI / 2);
    rail(8.8, [5.97, 2.6, 1.6], -Math.PI / 2);
  }

  /** Tall north windows: frames, glass, night backdrop, moonlight and animated rain streaks. */
  _buildWindows() {
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#cfd8e2', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.4, depthWrite: false });
    const frameMat = new THREE.MeshStandardMaterial({ color: '#3a3129', roughness: 0.5 });
    const nightMat = new THREE.MeshBasicMaterial({ color: '#1B2433' });
    this.rain = [];
    for (const x of [-3.7, 3.7]) {
      const g = new THREE.Group();
      g.position.set(x, 0, -8);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.1), nightMat);
      back.position.set(0, 2.15, -0.35);
      g.add(back);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 2.06), glassMat);
      glass.position.set(0, 2.15, -0.02);
      glass.renderOrder = 9;
      g.add(glass);
      for (const [w, h, px, py] of [[2.3, 0.08, 0, 1.1], [2.3, 0.08, 0, 3.2], [0.08, 2.18, -1.12, 2.15], [0.08, 2.18, 1.12, 2.15], [0.05, 2.06, 0, 2.15]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), frameMat);
        bar.position.set(px, py, 0);
        g.add(bar);
      }
      // rain streak sheet: scrolling canvas texture just behind the glass
      const rainTex = makeRainTexture();
      const rain = new THREE.Mesh(new THREE.PlaneGeometry(2.14, 2.04), new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, opacity: 0.5, depthWrite: false }));
      rain.position.set(0, 2.15, -0.05);
      rain.renderOrder = 8;
      g.add(rain);
      this.rain.push(rainTex);
      this.root.add(g);
    }
    // moonlight spilling through the windows (no shadow — keeps the light budget low)
    this.moon = new THREE.DirectionalLight('#9db4d8', 0.55);
    this.moon.position.set(-1.5, 3.4, -11);
    this.moon.target.position.set(0.5, 0.4, -3);
    this.root.add(this.moon, this.moon.target);
  }

  /** East doorway with architrave; the archive alcove beyond it. */
  _buildDoorway() {
    const frameMat = new THREE.MeshStandardMaterial({ color: '#332a23', roughness: 0.55 });
    const arch = (w, h, d, pos) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      m.position.set(...pos);
      this.root.add(m);
    };
    arch(0.14, 2.48, 0.3, [6, 1.24, -3.3]);
    arch(0.14, 2.48, 0.3, [6, 1.24, -0.7]);
    arch(0.14, 0.14, 2.74, [6, 2.44, -2]);
    // door standing open into the archive
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.36, 1.14), new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 0.5 }));
    door.position.set(6.35, 1.19, -0.16);
    door.rotation.y = -1.15;
    door.castShadow = true;
    this.root.add(door);
  }

  /** Archive corner: green storeroom beyond the doorway with its own dim picture light. */
  _buildArchive() {
    const H = 2.9;
    const wall = new THREE.MeshStandardMaterial({ color: '#2F4A3A', roughness: 0.9 });
    const g = new THREE.Group();
    const mk = (w, h, pos, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wall);
      m.position.set(...pos);
      m.rotation.y = ry;
      m.receiveShadow = true;
      g.add(m);
    };
    // alcove spans x 6..9.6, z -4.4..0.4
    mk(5.2, H, [7.8, H / 2, -4.4], 0);          // north wall
    mk(4.8, H, [7.8, H / 2, 0.4], Math.PI);     // south wall
    mk(3.6, H, [9.6, H / 2, -2], -Math.PI / 2); // east end
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.6), new THREE.MeshStandardMaterial({ color: '#26302a', roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(7.8, H, -2);
    g.add(ceil);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 0.03), new THREE.MeshStandardMaterial({ color: '#1d1712', roughness: 0.6 }));
    skirt.position.set(7.8, 0.06, -4.39);
    g.add(skirt);
    this.root.add(g);
    // archive spots (one over the cabinet, one over the shelf)
    this.archiveLights = [];
    for (const [px, tz] of [[8.1, -1.9], [8.1, -4.0]]) {
      const s = new THREE.SpotLight('#ffd7a8', 7, 4.5, 0.42, 0.7, 2);
      s.position.set(px, 2.7, tz + 0.8);
      s.target.position.set(px, 1.0, tz);
      this.root.add(s, s.target);
      this.archiveLights.push(s);
    }
  }

  /** Cork evidence board beside the archive doorway with pinned cards and red string. */
  _buildEvidenceBoard() {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.24, 1.84), new THREE.MeshStandardMaterial({ color: '#3a2c1e', roughness: 0.6 }));
    frame.position.set(0, 1.72, 0);
    const cork = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), new THREE.MeshStandardMaterial({ color: '#a97d4f', roughness: 0.95 }));
    cork.rotation.y = -Math.PI / 2;
    cork.position.set(-0.032, 1.72, 0);
    g.add(frame, cork);
    const cardMat = new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.85 });
    const pinMat = new THREE.MeshStandardMaterial({ color: '#8c2d35', roughness: 0.4 });
    const cards = [[1.5, 2.1], [1.5, 1.75], [1.9, 1.55], [1.85, 2.0]];
    for (const [cz, cy] of cards) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), cardMat);
      card.rotation.y = -Math.PI / 2;
      card.rotation.x = (Math.sin(cz * 7) * 0.06);
      card.position.set(-0.036, cy, cz);
      g.add(card);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), pinMat);
      pin.position.set(-0.04, cy + 0.115, cz);
      g.add(pin);
    }
    const stringMat = new THREE.LineBasicMaterial({ color: '#8c2d35' });
    const pts = cards.map(([cz, cy]) => new THREE.Vector3(-0.04, cy + 0.115, cz));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), stringMat));
    g.position.set(5.97, 0, 1.7);
    this.root.add(g);
  }

  /** Ambient life: dust in the spotlight cones, pendulum, guard torch, rain, chandelier flicker. */
  _buildLife() {
    this.life = new AmbientLifeManager(this.root, { reducedMotion: false, seed: 47 });
    // 1. dust motes drifting through the case spotlights
    this.life.addParticleVolume({ center: [0, 1.9, -4], extents: [8.5, 2.6, 7], count: 130, size: 0.02, opacity: 0.32, color: 0xffe9c4, drift: [0.05, 0.018, 0.035] });
    // 2. night-guard torch sweeping past the archive doorway every ~25 s
    const torch = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.7), new THREE.MeshBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
    blade.position.y = 0.1;
    const beam = new THREE.SpotLight('#ffc47e', 0, 7, 0.5, 0.8, 2);
    beam.position.set(0, 0.2, 0);
    torch.add(blade, beam);
    torch.position.set(6.7, 1.45, -4.2);
    this.root.add(torch);
    this.torch = torch;
    this.torchBeam = beam;
    this.torchBlade = blade;
    this.life.addUpdater((dt, elapsed) => {
      const period = 25;
      const t = elapsed % period;
      const sweep = t < 6 ? Math.sin((t / 6) * Math.PI) : 0; // ~6 s visible pass
      const z = THREE.MathUtils.lerp(-4.2, 0.2, (t % period) / period);
      torch.position.z = z;
      beam.intensity = sweep * 26;
      beam.target.position.set(5.2, 0.9, z);
      blade.material.opacity = sweep * 0.22;
      blade.rotation.y = Math.sin(elapsed * 1.4) * 0.2;
    });
    this.root.add(beam.target);
    // 3. rain scroll + 4. chandelier candle flicker
    this.flicker = { phase: Math.random() * 10 };
    this.life.addUpdater((dt, elapsed) => {
      for (const tex of this.rain || []) tex.offset.y -= dt * 0.55;
      if (this.chandelierLight) {
        const f = 0.82 + 0.18 * Math.sin(elapsed * 7.3 + this.flicker.phase) * Math.sin(elapsed * 3.1);
        this.chandelierLight.intensity = 14 * f;
      }
    });
  }

  /** Procedural brass pendulum hung on the grandfather clock, driven by addOscillator. */
  _buildPendulum(clock) {
    const box = new THREE.Box3().setFromObject(clock);
    const frontX = box.max.x + 0.02;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const g = new THREE.Group();
    g.position.set(frontX - 0.03, box.max.y - 0.42, cz);
    const rodMat = new THREE.MeshStandardMaterial({ color: '#B08D57', roughness: 0.3, metalness: 0.85 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 8), rodMat);
    rod.position.y = -0.31;
    const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 20), rodMat);
    bob.rotation.x = Math.PI / 2;
    bob.position.y = -0.6;
    g.add(rod, bob);
    this.root.add(g);
    // top of the pendulum rides just inside the clock case front
    g.position.x = frontX - 0.06;
    this.pendulum = g;
    this.life.addOscillator(g, { axis: 'z', mode: 'rotate', amplitude: 0.09, frequency: 1.0 });
  }

  /** Register the gallery's in-world hotspots on an InWorldInteractionManager. */
  registerHotspots(iw, { onCase, onTable, onArchive, onBoard } = {}) {
    this.hotspotGroups = [];
    const ring = (pos, opts) => {
      const g = iw.addHotspotRing(pos, opts);
      this.hotspotGroups.push(g);
      return g;
    };
    ring([0, 0.02, 1.4], { id: 'hotspot-table', label: 'Inspection table', hint: 'Walk to the inspection table', color: 0xF2B25C,
      cameraPos: [0, 1.55, 2.6], cameraTarget: [0, 1.0, 0], onClick: () => onTable?.() });
    const caseNames = ['left', 'centre', 'right'];
    [-2.4, 0, 2.4].forEach((x, i) => {
      ring([x, 0.02, -2.9], { id: `hotspot-case-${i}`, label: `Display case (${caseNames[i]})`, hint: 'Walk to the case', color: 0xF2B25C,
        cameraPos: [x, 1.5, -1.5], cameraTarget: [x, 1.2, -4.2], onClick: () => onCase?.(i) });
    });
    ring([7.1, 0.02, -0.9], { id: 'hotspot-archive', label: 'Archive cabinet', hint: 'Walk into the archive corner', color: 0x8FB08D,
      cameraPos: [6.5, 1.5, 0.1], cameraTarget: [8.1, 0.95, -1.9], onClick: () => onArchive?.() });
    ring([4.6, 0.02, 1.7], { id: 'hotspot-board', label: 'Evidence board', hint: 'Walk to the evidence board', color: 0xC9743B,
      cameraPos: [4.1, 1.5, 1.7], cameraTarget: [5.95, 1.7, 1.7], onClick: () => onBoard?.() });
  }

  /** Show/hide the exploration rings (hidden while the inspection tools own the view). */
  setHotspotsVisible(on) {
    for (const g of this.hotspotGroups || []) g.visible = Boolean(on);
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
    // chandelier candle glow over the centre of the room (flicker lives in _buildLife)
    this.chandelierLight = new THREE.PointLight('#ffd9a0', 14, 9, 2);
    this.chandelierLight.position.set(0, 2.95, -2);
    this.root.add(this.chandelierLight);
  }

  /** Flat paper card on the inspection table (the draft label, seen in S1). */
  setCard(visible, title = 'DRAFT LABEL', sub = 'Lantern Museum (fictional)') {
    if (!this.card) {
      const tex = textTexture([title, '', sub], { w: 512, h: 320, bg: '#efe6d2', fg: '#2a241c', font: 44 });
      this.card = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.094), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      this.card.rotation.x = -Math.PI / 2;
      this.card.rotation.z = 0.25;
      this.card.position.set(0.42, TABLE_Y + 0.002, 0.3);
      this.card.receiveShadow = true;
      this.root.add(this.card);
    }
    this.card.visible = visible;
  }

  /**
   * Put a copy of the object on the centre case deck with the learner's label
   * on a small stand beside it (shot S2). Pass null to clear.
   */
  showInCase(model, labelText) {
    if (this._caseGroup) { this.root.remove(this._caseGroup); this._caseGroup = null; }
    if (!model) return;
    const g = new THREE.Group();
    const copy = model.clone(true);
    const box = new THREE.Box3().setFromObject(copy);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    copy.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));
    const holder = new THREE.Group();
    holder.add(copy);
    holder.position.set(-0.1, CASE_POS.y + 0.011, CASE_POS.z);
    holder.rotation.y = 0.35;
    const lines = wrapText(labelText || '', 34).slice(0, 12);
    const tex = textTexture(['YOUR LABEL', ...lines], { w: 640, h: 800, bg: '#f4efe4', fg: '#1d1a16', font: 30, firstBold: true });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    plaque.position.set(0.24, CASE_POS.y + 0.11, CASE_POS.z + 0.18);
    plaque.rotation.set(-0.35, -0.3, 0);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.4, metalness: 0.6 }));
    stand.position.set(0.24, CASE_POS.y + 0.05, CASE_POS.z + 0.15);
    g.add(holder, plaque, stand);
    g.userData.objectSize = size;
    this._caseGroup = g;
    this.root.add(g);
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
    // v2 room lights: warm pools sink while the studio key or raking light owns the cue
    const warm = { gallery: 1.0, inspect: 0.42, raking: 0.06 }[mode];
    for (const s of this.archiveLights || []) s.intensity = 7 * warm;
    if (this.moon) this.moon.intensity = { gallery: 0.55, inspect: 0.3, raking: 0.08 }[mode];
    if (this.chandelierLight) this.chandelierLight.intensity = 14 * warm;
    if (this.lampLight) this.lampLight.intensity = 1.6 * warm;
  }

  /** Advance ambient life (dust, pendulum, torch, rain, flicker) and hotspot pulses. */
  update(dt, camera = null) {
    this.life?.update(dt, camera);
  }

  /** Calm mode: ambient life slows to ~30 % during focused inspection tasks. */
  setCalmMode(on) {
    this.life?.setCalmMode(Boolean(on));
  }

  setReducedMotion(reduced) {
    this.life?.setReducedMotion(Boolean(reduced));
  }
}
