/**
 * kit.js — shared helpers for the v3 Lantern Museum scene: self-hosted KTX2
 * and glTF loaders (build contract 08 §5.1), PBR material sets from the S4
 * textures (content/assets-v3.json), per-material geometry merging (draw
 * calls) and canvas textures for printed labels and signage.
 * @module od/kit
 */
import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BASE = import.meta.env?.BASE_URL || './';
export const url = (p) => `${BASE}${String(p).replace(/^\/+/, '')}`;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

let ktx2 = null, gltf = null;
/** Every lazy texture's load promise (the scene waits for them before baking its environment). */
export const pendingTextures = [];
export function getKTX2(renderer) {
  if (!ktx2) ktx2 = new KTX2Loader().setTranscoderPath(url('decoders/basis/')).detectSupport(renderer);
  return ktx2;
}
export function getGLTF(renderer) {
  if (gltf) return gltf;
  const draco = new DRACOLoader().setDecoderPath(url('decoders/draco/'));
  gltf = new GLTFLoader().setKTX2Loader(getKTX2(renderer)).setMeshoptDecoder(MeshoptDecoder).setDRACOLoader(draco);
  return gltf;
}
export function loadGLB(renderer, path) { return getGLTF(renderer).loadAsync(url(path)); }

/** A texture that fills in when its file arrives (KTX2 or an image). Never rejects. */
export function lazyTexture(renderer, path, { srgb = true, repeat = [1, 1], anisotropy = 8 } = {}) {
  const tex = new THREE.Texture();
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  const apply = (t) => {
    t.colorSpace = tex.colorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    // KTX2 images are stored top row first and cannot be flipped on upload
    // (compressed), so flip V here; otherwise paintings and signs show upside down.
    if (t.isCompressedTexture && !t.flipY) { t.repeat.y = -repeat[1]; t.offset.y = repeat[1]; }
    t.anisotropy = Math.min(anisotropy, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    return t;
  };
  const p = path.endsWith('.ktx2') ? getKTX2(renderer).loadAsync(url(path)) : new THREE.TextureLoader().loadAsync(url(path));
  const ready = p.then(apply).catch((e) => { console.warn('texture not loaded:', path, e?.message); return null; });
  pendingTextures.push(ready);
  return { placeholder: tex, ready };
}

/**
 * A PBR material whose maps arrive asynchronously. `set` is a texture-set entry
 * from content/assets-v3.json ({ Color, NormalGL, Roughness, Metalness? }) or
 * from content/textures.json (v2 jpg sets). The material is usable at once.
 */
export function pbr(renderer, set, { repeat = [1, 1], ...extra } = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...extra });
  const slot = (key, prop, srgb) => {
    if (!set?.[key]) return;
    // A placeholder map keeps the shader variant stable (no recompile when it loads).
    const { placeholder, ready } = lazyTexture(renderer, set[key], { srgb, repeat });
    placeholder.image = WHITE_PIXEL(prop === 'normalMap');
    placeholder.needsUpdate = true;
    m[prop] = placeholder;
    ready.then((t) => { if (t) { m[prop] = t; m.needsUpdate = true; } });
  };
  slot('Color', 'map', true);
  slot('NormalGL', 'normalMap', false);
  slot('Roughness', 'roughnessMap', false);
  slot('Metalness', 'metalnessMap', false);
  return m;
}
const _px = {};
function WHITE_PIXEL(normal) {
  const k = normal ? 'n' : 'w';
  if (!_px[k]) {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const g = c.getContext('2d');
    g.fillStyle = normal ? '#8080ff' : '#ffffff';
    g.fillRect(0, 0, 2, 2);
    _px[k] = c;
  }
  return _px[k];
}

/** Collects parts per material and merges them into one mesh per material (draw calls). */
export class Parts {
  constructor() { this.byMat = new Map(); }
  add(geo, mat, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], uv = null } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (uv && g.attributes.uv) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uv[0], a.getY(i) * uv[1]); }
    g.applyMatrix4(new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scale)));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.byMat.has(mat)) this.byMat.set(mat, []);
    this.byMat.get(mat).push(g);
    return this;
  }
  get empty() { return this.byMat.size === 0; }
  build(name, { cast = true, receive = true } = {}) {
    const grp = new THREE.Group();
    grp.name = name;
    for (const [mat, geos] of this.byMat) {
      const m = new THREE.Mesh(geos.length === 1 ? geos[0] : mergeGeometries(geos, false), mat);
      m.castShadow = cast; m.receiveShadow = receive;
      m.name = `${name}:${mat.name || 'part'}`;
      grp.add(m);
    }
    return grp;
  }
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, s = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);

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

/**
 * A printed card (museum label, sign, book page) drawn on a canvas.
 * lines: [{ text, size, font?, weight?, color?, align?, gap? }]. Fonts are the
 * case faces (Libre Baskerville for in-world signage, Source Sans 3 for small
 * print); the card redraws once the faces have loaded.
 */
export function cardTexture(lines, { w = 512, h = 320, bg = '#f1ead9', border = '#8a7a5f', pad = 36, paper = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const draw = () => {
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (paper) {
      // Faint paper fibre and edge wear so a card never reads as a flat sheet.
      let s = 7;
      const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(90,70,40,${0.025 + rnd() * 0.04})`;
        g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1);
      }
      const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(80,60,30,0.16)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }
    if (border) { g.strokeStyle = border; g.lineWidth = Math.max(3, w / 120); g.strokeRect(10, 10, w - 20, h - 20); }
    let y = pad;
    g.textBaseline = 'top';
    for (const l of lines) {
      const size = l.size || 28;
      const family = l.font === 'display' ? '"Libre Baskerville", Georgia, serif' : '"Source Sans 3", system-ui, sans-serif';
      g.font = `${l.italic ? 'italic ' : ''}${l.weight || 400} ${size}px ${family}`;
      g.fillStyle = l.color || '#241d15';
      g.textAlign = l.align || 'left';
      const x = l.align === 'center' ? w / 2 : l.align === 'right' ? w - pad : pad;
      const maxChars = l.wrap || Math.floor((w - pad * 2) / (size * 0.5));
      for (const line of wrapText(l.text, maxChars)) {
        g.fillText(line, x, y);
        y += size * (l.leading || 1.28);
      }
      y += l.gap ?? size * 0.35;
    }
  };
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (document.fonts?.load) {
    Promise.all([document.fonts.load('700 30px "Libre Baskerville"'), document.fonts.load('400 30px "Source Sans 3"')])
      .then(() => { draw(); t.needsUpdate = true; }).catch(() => {});
  }
  return t;
}

/** Contact shadow: a soft dark disc under an object so nothing floats. */
let _contactTex = null;
export function contactShadow(w, d, opacity = 0.45) {
  if (!_contactTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    _contactTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: _contactTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.renderOrder = 1;
  m.userData.noOutline = true;
  m.raycast = () => {};
  return m;
}

/** Place a loaded glTF scene at real size: resting on y = 0, centred in x/z. Never scales. */
export function restOnFloor(root) {
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root);
  const c = b.getCenter(new THREE.Vector3());
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= b.min.y;
  const holder = new THREE.Group();
  holder.add(root);
  return holder;
}

/** Shadow flags for every mesh under root. */
export function shadows(root, cast = true, receive = true) {
  root.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return root;
}
