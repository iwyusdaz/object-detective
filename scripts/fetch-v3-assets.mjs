#!/usr/bin/env node
/**
 * fetch-v3-assets.mjs — stage the v3.0.0 (plan 10 §6.2) assets for the Lantern
 * Museum: neighbouring-exhibit scans, open-access paintings, extra Poly Haven
 * props, ambientCG surface textures and two own-work textures.
 *
 * Licence check (plan 10 §12, plan 09 decision 2): every asset is checked
 * against its source BEFORE it is downloaded, and the script stops on the
 * first asset that is not on the allowed list (CC0 1.0, public domain,
 * CC BY 4.0 with attribution, own work):
 *   - Smithsonian: the Open Access record's metadata_usage.access AND the
 *     3d_voyager media's usage.access must both be "CC0".
 *   - Met: the collection API's isPublicDomain must be true (Met Open Access
 *     releases public-domain works under CC0) and the image URL must be the
 *     record's primaryImage.
 *   - Poly Haven: the info API must return the asset as a model (type 2) and
 *     https://polyhaven.com/license must state CC0.
 *   - ambientCG: the asset must exist in the v2 API and
 *     https://docs.ambientcg.com/license/ must state CC0 1.0.
 *   - Own work: generated here; licensed with the repo content (CC BY 4.0).
 * The evidence (licence fields, record URLs, retrieval time) is written to
 * research/v3-licence-log.json (committed). Raw downloads stay in
 * data/raw/v3/ (gitignored).
 *
 * Outputs (only public/assets/v3/ is cleaned; v1/v2 assets are untouched):
 *   public/assets/v3/exhibits/  Smithsonian std Draco GLBs, unmodified, hashed names
 *   public/assets/v3/paintings/ KTX2 (ETC1S, sRGB, mipmaps) at 1024 and 2048 px
 *   public/assets/v3/props/     Poly Haven GLBs: meshopt + quantization, KTX2 textures
 *   public/assets/v3/textures/  ambientCG maps as KTX2 (colour ETC1S sRGB, normal UASTC)
 *   public/assets/v3/own/       own-work KTX2 textures
 *   content/assets-v3.json      manifest: file, bytes, sha256, tier, licence, source, bounds
 *
 * Formats follow _templates/spikes/RESULTS.md ("Asset formats S4 should use").
 * Requires: Node 22+, ImageMagick (magick), toktx 4.4.2 (~/ktx-software/bin or
 * PATH, override with TOKTX=…), the pinned @gltf-transform 4.5.1 and
 * meshoptimizer 1.3.0 devDependencies. Smithsonian API: SI_API_KEY (DEMO_KEY
 * by default; build-time only, never shipped).
 * Usage: node scripts/fetch-v3-assets.mjs
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRTextureBasisu } from '@gltf-transform/extensions';
import { dedup, getBounds, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(root, 'data', 'raw', 'v3');
const OUT = join(root, 'public', 'assets', 'v3');
const KEY = process.env.SI_API_KEY || 'DEMO_KEY';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const TOKTX = process.env.TOKTX || (existsSync(join(homedir(), 'ktx-software/bin/toktx')) ? join(homedir(), 'ktx-software/bin/toktx') : 'toktx');
const MAX_FILE = 19.5e6; // plan 10 §7: every file <= 20 MB

export const ALLOWED_LICENCES = ['CC0 1.0', 'Public domain', 'CC BY 4.0'];

/** Neighbouring exhibits: other CC0 Smithsonian scans (plan 10 §6.2). */
export const EXHIBITS = [
  { slug: 'lincoln-patent-model', id: 'ld1-1643399625297-1643399671505-0', file: '_std_draco.glb' },
  { slug: 'elkins-refrigerator-patent-model', id: 'ld1-1643398738600-1643398745496-0', file: '_std_draco.glb' },
  { slug: 'mattey-stereoscope', id: 'ld1-1643398738600-1643398751541-0', file: '-100k-2048_std_draco.glb' },
];
/** Paintings from The Met Open Access (public domain, CC0). */
export const PAINTINGS = [
  { slug: 'morse-the-muse', metId: 11605 },
  { slug: 'elliott-mathew-brady', metId: 10850 },
];
/** Extra Poly Haven CC0 props (the v2 set stays in public/assets/models/). */
export const PROPS = [
  { id: 'Ottoman_01', tex: 1024 }, // gallery bench (padded leather seat)
  { id: 'security_camera_01', tex: 1024 },
  { id: 'magnifying_glass_01', tex: 512 },
];
/** ambientCG CC0 surface sets: id, output size, maps. */
export const TEXTURES = [
  { id: 'Wood051', size: 1024, maps: ['Color', 'NormalGL', 'Roughness'], use: 'wainscoting, case bases, reception desk' },
  { id: 'Marble012', size: 1024, maps: ['Color', 'NormalGL', 'Roughness'], use: 'plinth tops, reception desk top' },
  { id: 'Cork002', size: 512, maps: ['Color', 'NormalGL', 'Roughness'], use: 'evidence board' },
  { id: 'Metal048A', size: 512, maps: ['Color', 'NormalGL', 'Roughness', 'Metalness'], use: 'brass rails, case frames, picture frames' },
  { id: 'Fabric085', size: 512, maps: ['Color', 'NormalGL', 'Roughness'], use: 'curtains' },
  { id: 'Fingerprints002', size: 1024, maps: ['Roughness'], use: 'smudges on vitrine glass (roughness only)' },
  { id: 'Paper004', size: 512, maps: ['Color', 'NormalGL', 'Roughness'], use: 'label cards, visitor book, leaflets' },
];

const log = { generatedAt: new Date().toISOString(), allowedLicences: ALLOWED_LICENCES, assets: [] };
const manifest = { _about: 'v3.0.0 assets staged by scripts/fetch-v3-assets.mjs (plan 10 S4). tier "first" may load before the first interaction; tier "stream" loads after the first click or on inspect. boundsMetres are [x, y, z] of the file as authored (glTF, y up, 1 unit = 1 m).', exhibits: {}, paintings: {}, props: {}, textures: {}, own: {} };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
function assertLicence(name, licence) {
  if (!ALLOWED_LICENCES.includes(licence)) throw new Error(`${name}: licence "${licence}" is not on the allowed list — refusing`);
}
const redact = (url) => url.replace(/api_key=[^&]+/, 'api_key=REDACTED');
async function get(url, { json = false, ua = UA } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': ua } });
    if (res.ok) return json ? res.json() : Buffer.from(await res.arrayBuffer());
    console.warn(`  HTTP ${res.status} for ${redact(url)} (attempt ${attempt})`);
    await sleep(3000 * attempt);
  }
  throw new Error(`download failed: ${redact(url)}`);
}
async function cached(path, url, opts) {
  if (existsSync(path) && statSync(path).size > 0) return readFileSync(path);
  mkdirSync(dirname(path), { recursive: true });
  const buf = await get(url, opts);
  writeFileSync(path, buf);
  return buf;
}
function writeHashed(dir, base, ext, buf) {
  if (buf.length > MAX_FILE) throw new Error(`${base}: ${buf.length} bytes exceeds the 20 MB single-file budget`);
  mkdirSync(join(OUT, dir), { recursive: true });
  const h = sha(buf);
  const name = `${base}-${h.slice(0, 10)}.${ext}`;
  writeFileSync(join(OUT, dir, name), buf);
  return { file: `assets/v3/${dir}/${name}`, bytes: buf.length, sha256: h };
}
/** Normal maps are capped at this edge: UASTC normals are ~4x the bytes of ETC1S colour (measured: Wood051 1024 px normal 1.1 MB vs 187 KB at 512 px with RDO). */
const NORMAL_MAX = 512;
/** PNG -> KTX2. kind: 'srgb' (colour, ETC1S), 'linear' (data, ETC1S), 'normal' (UASTC + RDO + zstd). */
function toKtx2(png, kind) {
  const out = png.replace(/\.png$/, `.${kind}.ktx2`);
  const args = ['--t2', '--genmipmap', '--target_type', 'RGB'];
  if (kind === 'normal') args.push('--encode', 'uastc', '--uastc_quality', '2', '--uastc_rdo_l', '1.0', '--zcmp', '19', '--assign_oetf', 'linear');
  else args.push('--encode', 'etc1s', '--clevel', '4', '--qlevel', '255', '--assign_oetf', kind === 'srgb' ? 'srgb' : 'linear');
  execFileSync(TOKTX, [...args, out, png]);
  return readFileSync(out);
}
/** Resize so the longest edge is `edge` and both sides are multiples of 4 (Basis block size). */
function resizePng(src, dest, edge) {
  const [w, h] = execFileSync('magick', ['identify', '-format', '%w %h', `${src}[0]`], { encoding: 'utf8' }).trim().split(' ').map(Number);
  const s = edge / Math.max(w, h);
  const W = Math.max(4, Math.round((w * s) / 4) * 4);
  const H = Math.max(4, Math.round((h * s) / 4) * 4);
  execFileSync('magick', [`${src}[0]`, '-resize', `${W}x${H}!`, '-strip', '-depth', '8', '-define', 'png:color-type=2', dest]);
  return [W, H];
}
function glbAccessorBounds(buf) {
  const len = buf.readUInt32LE(12);
  const j = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  const prims = j.meshes.flatMap((m) => m.primitives);
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    const a = j.accessors[p.attributes.POSITION];
    for (let i = 0; i < 3; i++) { mins[i] = Math.min(mins[i], a.min[i]); maxs[i] = Math.max(maxs[i], a.max[i]); }
  }
  const hasNodeScale = (j.nodes || []).some((n) => n.scale || n.matrix || n.rotation);
  return { size: maxs.map((x, i) => +(x - mins[i]).toFixed(4)), hasNodeTransform: hasNodeScale };
}

async function exhibits() {
  for (const o of EXHIBITS) {
    // DEMO_KEY is rate-limited (HTTP 429). Prefer the live record; fall back to
    // the record this script saved on an earlier run, and log which was used.
    const saved = join(RAW, 'si', `${o.slug}.record.json`);
    let rec;
    let recordSource = 'live content endpoint';
    try {
      rec = (await get(`https://api.si.edu/openaccess/api/v1.0/content/${o.id}?api_key=${KEY}`, { json: true })).response;
    } catch (e) {
      if (!existsSync(saved)) throw e;
      rec = JSON.parse(readFileSync(saved, 'utf8'));
      recordSource = `saved record from an earlier live run (${statSync(saved).mtime.toISOString()}); live call failed: ${e.message}`;
      console.warn(`  ${o.slug}: using ${recordSource}`);
    }
    const dn = rec.content.descriptiveNonRepeating;
    const media = (dn.online_media?.media || []).find((m) => m.type === '3d_voyager');
    const recordAccess = dn.metadata_usage?.access;
    const mediaAccess = media?.usage?.access;
    if (recordAccess !== 'CC0') throw new Error(`${o.slug}: record access "${recordAccess}" is not CC0 — refusing`);
    if (mediaAccess !== 'CC0') throw new Error(`${o.slug}: 3D media access "${mediaAccess}" is not CC0 — refusing`);
    assertLicence(o.slug, 'CC0 1.0');
    const url = media.resources.map((r) => r.url).find((u) => u.endsWith(o.file));
    if (!url) throw new Error(`${o.slug}: no resource ending in ${o.file}`);
    if (recordSource === 'live content endpoint') writeFileSync(saved, JSON.stringify(rec, null, 2));
    const buf = await cached(join(RAW, 'si', `${o.slug}.glb`), url);
    if (buf.subarray(0, 4).toString() !== 'glTF') throw new Error(`${o.slug}: not a GLB`);
    const out = writeHashed('exhibits', o.slug, 'glb', buf);
    const { size, hasNodeTransform } = glbAccessorBounds(buf);
    const ft = rec.content.freetext;
    const dims = (ft.physicalDescription || []).find((x) => /measure|dimension/i.test(x.label))?.content || '';
    manifest.exhibits[o.slug] = { ...out, tier: 'stream', boundsMetres: size, nodeTransforms: hasNodeTransform, title: rec.title, recordId: dn.record_ID, recordUrl: dn.guid, voyagerUrl: media.content, measurementsText: dims, licence: 'CC0 1.0' };
    log.assets.push({ asset: `exhibits/${o.slug}`, source: 'Smithsonian Open Access API', apiId: o.id, recordId: dn.record_ID, recordUrl: dn.guid, voyagerUrl: media.content, recordAccess, mediaAccess, recordSource, file: url, licence: 'CC0 1.0' });
    console.log(`exhibit ${o.slug}: CC0 record + media; ${(buf.length / 1e6).toFixed(2)} MB; bounds ${size.join(' x ')} m; record "${dims}"`);
    await sleep(1500);
  }
}

async function paintings() {
  for (const p of PAINTINGS) {
    const rec = await get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${p.metId}`, { json: true });
    if (rec.isPublicDomain !== true) throw new Error(`${p.slug}: Met isPublicDomain is ${rec.isPublicDomain} — refusing`);
    if (!rec.primaryImage) throw new Error(`${p.slug}: no primaryImage`);
    assertLicence(p.slug, 'CC0 1.0');
    writeFileSync(join(RAW, 'met', `${p.metId}.json`), JSON.stringify(rec, null, 2));
    const src = join(RAW, 'met', `${p.metId}.jpg`);
    await cached(src, rec.primaryImage);
    const overall = rec.measurements?.find((m) => m.elementName === 'Overall')?.elementMeasurements;
    const framed = rec.measurements?.find((m) => m.elementName === 'Framed')?.elementMeasurements;
    const entry = { tier: { '1024': 'first', '2048': 'stream' }, title: rec.title, artist: rec.artistDisplayName, date: rec.objectDate, medium: rec.medium, dimensions: rec.dimensions, creditLine: rec.creditLine, accessionNumber: rec.accessionNumber, objectURL: rec.objectURL, canvasMetres: overall ? [overall.Width / 100, overall.Height / 100] : null, framedMetres: framed ? [framed.Width / 100, framed.Height / 100, (framed.Depth || 0) / 100] : null, licence: 'CC0 1.0', files: {} };
    for (const edge of [1024, 2048]) {
      const png = join(RAW, 'met', `${p.slug}-${edge}.png`);
      const px = resizePng(src, png, edge);
      entry.files[edge] = { ...writeHashed('paintings', `${p.slug}-${edge}`, 'ktx2', toKtx2(png, 'srgb')), px };
    }
    manifest.paintings[p.slug] = entry;
    log.assets.push({ asset: `paintings/${p.slug}`, source: 'The Met Collection API', objectID: p.metId, objectURL: rec.objectURL, isPublicDomain: rec.isPublicDomain, primaryImage: rec.primaryImage, licence: 'CC0 1.0' });
    console.log(`painting ${p.slug}: public domain (Met ${p.metId}); canvas ${entry.canvasMetres?.join(' x ')} m; ${Object.values(entry.files).map((f) => `${f.px.join('x')} ${(f.bytes / 1e3).toFixed(0)} KB`).join(', ')}`);
  }
}

/** Material slot -> KTX2 kind for every texture in a glTF document. */
function textureKinds(doc) {
  const kinds = new Map();
  const set = (t, k) => { if (t && !kinds.has(t)) kinds.set(t, k); };
  for (const m of doc.getRoot().listMaterials()) {
    set(m.getBaseColorTexture(), 'srgb');
    set(m.getEmissiveTexture(), 'srgb');
    set(m.getNormalTexture(), 'normal');
    set(m.getMetallicRoughnessTexture(), 'linear');
    set(m.getOcclusionTexture(), 'linear');
  }
  for (const t of doc.getRoot().listTextures()) set(t, 'linear');
  return kinds;
}

async function props(io) {
  const page = (await get('https://polyhaven.com/license')).toString('utf8');
  if (!/CC0/.test(page)) throw new Error('polyhaven.com/license does not mention CC0 — refusing');
  for (const p of PROPS) {
    const info = await get(`https://api.polyhaven.com/info/${p.id}`, { json: true, ua: 'ImmersiveLearningPortfolio/3.0' });
    if (info.type !== 2) throw new Error(`${p.id}: Poly Haven type ${info.type} is not a model`);
    assertLicence(p.id, 'CC0 1.0');
    const files = await get(`https://api.polyhaven.com/files/${p.id}`, { json: true, ua: 'ImmersiveLearningPortfolio/3.0' });
    const entry = files.gltf?.['1k']?.gltf;
    if (!entry?.url) throw new Error(`${p.id}: no 1k glTF`);
    const dir = join(RAW, 'polyhaven', p.id);
    const gltfPath = join(dir, `${p.id}.gltf`);
    await cached(gltfPath, entry.url, { ua: 'ImmersiveLearningPortfolio/3.0' });
    for (const [rel, meta] of Object.entries(entry.include || {})) await cached(join(dir, rel), meta.url, { ua: 'ImmersiveLearningPortfolio/3.0' });
    const doc = await io.read(gltfPath);
    await doc.transform(dedup(), weld(), prune());
    const tmp = join(dir, 'ktx');
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    let n = 0;
    for (const [tex, kind] of textureKinds(doc)) {
      const ext = tex.getMimeType() === 'image/png' ? 'png' : 'jpg';
      const src = join(tmp, `t${n}.${ext}`);
      writeFileSync(src, tex.getImage());
      const png = join(tmp, `t${n}.png`);
      resizePng(src, png, Math.min(kind === 'normal' ? NORMAL_MAX : p.tex, Math.max(...tex.getSize())));
      tex.setImage(toKtx2(png, kind)).setMimeType('image/ktx2').setURI(`t${n}.ktx2`);
      n++;
    }
    doc.createExtension(KHRTextureBasisu).setRequired(true);
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
    const b = getBounds(scene);
    const size = b.max.map((x, i) => +(x - b.min[i]).toFixed(4));
    const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((s, pr) => s + (pr.getIndices() ? pr.getIndices().getCount() / 3 : pr.getAttribute('POSITION').getCount() / 3), 0);
    const glb = Buffer.from(await io.writeBinary(doc));
    const out = writeHashed('props', p.id, 'glb', glb);
    const authors = Object.keys(info.authors || {}).join(', ');
    manifest.props[p.id] = { ...out, tier: 'first', name: info.name, authors, source: `https://polyhaven.com/a/${p.id}`, licence: 'CC0 1.0', boundsMetres: size, triangles: tris, textures: n, textureMax: p.tex };
    log.assets.push({ asset: `props/${p.id}`, source: `https://polyhaven.com/a/${p.id}`, infoApi: `https://api.polyhaven.com/info/${p.id}`, type: info.type, authors, licencePage: 'https://polyhaven.com/license (states CC0)', licence: 'CC0 1.0' });
    console.log(`prop ${p.id}: ${(glb.length / 1e3).toFixed(0)} KB, ${tris} tris, ${n} KTX2 textures, bounds ${size.join(' x ')} m (by ${authors})`);
  }
}

async function textures() {
  const page = (await get('https://docs.ambientcg.com/license/')).toString('utf8');
  if (!/CC0 1\.0/.test(page)) throw new Error('docs.ambientcg.com/license does not state CC0 1.0 — refusing');
  for (const t of TEXTURES) {
    const api = await get(`https://ambientcg.com/api/v2/full_json?id=${t.id}&include=downloadData`, { json: true });
    const a = api.foundAssets?.[0];
    if (!a || a.assetId !== t.id) throw new Error(`${t.id}: not found in the ambientCG API`);
    assertLicence(t.id, 'CC0 1.0');
    const dl = a.downloadFolders.default.downloadFiletypeCategories.zip.downloads.find((d) => d.attribute === '1K-JPG');
    const zip = join(RAW, 'ambientcg', `${t.id}_1K-JPG.zip`);
    await cached(zip, dl.downloadLink);
    const dir = join(RAW, 'ambientcg', t.id);
    mkdirSync(dir, { recursive: true });
    execFileSync('unzip', ['-oq', zip, '-d', dir]);
    const entry = { tier: 'first', use: t.use, source: `https://ambientcg.com/view?id=${t.id}`, licence: 'CC0 1.0', size: t.size, normalSize: Math.min(t.size, NORMAL_MAX), maps: {} };
    for (const m of t.maps) {
      const src = join(dir, `${t.id}_1K-JPG_${m}.jpg`);
      if (!existsSync(src)) throw new Error(`${t.id}: missing map ${m}`);
      const png = join(dir, `${t.id}-${m}-${t.size}.png`);
      const kind = m === 'Color' ? 'srgb' : m === 'NormalGL' ? 'normal' : 'linear';
      resizePng(src, png, kind === 'normal' ? Math.min(t.size, NORMAL_MAX) : t.size);
      entry.maps[m] = writeHashed('textures', `${t.id}-${m}`, 'ktx2', toKtx2(png, kind));
    }
    manifest.textures[t.id] = entry;
    log.assets.push({ asset: `textures/${t.id}`, source: entry.source, api: `https://ambientcg.com/api/v2/full_json?id=${t.id}`, licencePage: 'https://docs.ambientcg.com/license/ (states CC0 1.0)', licence: 'CC0 1.0' });
    console.log(`texture ${t.id}: ${t.maps.join(', ')} at ${t.size} px, ${(Object.values(entry.maps).reduce((s, x) => s + x.bytes, 0) / 1e3).toFixed(0)} KB`);
  }
}

/** Seeded PRNG so the own-work textures are reproducible. */
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }

function ownWork() {
  const dir = join(RAW, 'own');
  mkdirSync(dir, { recursive: true });
  const font = join(root, '..', '_direction', '_fonts', 'source-sans-3', 'source-sans-3-latin-600-normal.woff2');
  if (!existsSync(font)) throw new Error(`font not found: ${font}`);
  assertLicence('own work', 'CC BY 4.0');
  // 1. Exit sign face (colour = emissive): red letters on a dark panel, white border. 512 x 192 px for a 0.35 x 0.15 m sign.
  const exit = join(dir, 'exit-sign.png');
  execFileSync('magick', ['-size', '512x192', 'xc:#141414', '-fill', 'none', '-stroke', '#d8d8d8', '-strokewidth', '6', '-draw', 'roundrectangle 8,8 503,183 14,14', '-stroke', 'none', '-fill', '#ff2a1f', '-font', font, '-pointsize', '132', '-gravity', 'center', '-annotate', '+0+4', 'EXIT', '-depth', '8', '-define', 'png:color-type=2', exit]);
  // 2. The building across the street at night: brick-dark facade, 8 x 5 windows, about a quarter lit warm (illustrative).
  const r = rng(1844);
  const draw = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 40 + col * 122;
      const y = 40 + row * 92;
      const lit = r() < 0.27;
      const c = lit ? ['#f2b25c', '#f6c983', '#e9a54a', '#fbe1b0'][Math.floor(r() * 4)] : ['#1b2433', '#202a3a', '#161d29'][Math.floor(r() * 3)];
      draw.push('-fill', c, '-draw', `rectangle ${x},${y} ${x + 70},${y + 58}`);
      if (lit && r() < 0.5) draw.push('-fill', '#3a2a1f', '-draw', `rectangle ${x + 36},${y} ${x + 70},${y + 58}`); // half-drawn blind
      draw.push('-fill', '#0e0c0b', '-draw', `rectangle ${x + 33},${y} ${x + 37},${y + 58}`, '-draw', `rectangle ${x},${y + 27} ${x + 70},${y + 31}`); // glazing bars
    }
  }
  const facade = join(dir, 'night-facade.png');
  execFileSync('magick', ['-size', '1024x512', 'xc:#2a1d19', '(', '-size', '1024x512', 'xc:', '+noise', 'Random', '-colorspace', 'gray', '-blur', '0x0.6', ')', '-compose', 'softlight', '-composite', ...draw, '-depth', '8', '-define', 'png:color-type=2', facade]);
  const items = [
    { key: 'exit-sign', png: exit, px: [512, 192], use: 'exit sign face (colour and emissive), 0.35 x 0.15 m', honesty: 'illustrative' },
    { key: 'night-facade', png: facade, px: [1024, 512], use: 'lit windows of the building across the street (colour and emissive, seeded random, illustrative)', honesty: 'illustrative' },
  ];
  for (const it of items) {
    const out = writeHashed('own', it.key, 'ktx2', toKtx2(it.png, 'srgb'));
    manifest.own[it.key] = { ...out, tier: 'first', px: it.px, use: it.use, licence: 'CC BY 4.0', author: 'Built for this project (scripts/fetch-v3-assets.mjs)' };
    log.assets.push({ asset: `own/${it.key}`, source: 'scripts/fetch-v3-assets.mjs', licence: 'CC BY 4.0 (repo content licence, LICENSE-CONTENT)', note: it.key === 'exit-sign' ? 'Lettering set in Source Sans 3 (SIL OFL 1.1)' : 'Seeded procedural image' });
    console.log(`own ${it.key}: ${(out.bytes / 1e3).toFixed(0)} KB`);
  }
}

async function main() {
  for (const d of ['si', 'met', 'polyhaven', 'ambientcg', 'own']) mkdirSync(join(RAW, d), { recursive: true });
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  execFileSync(TOKTX, ['--version']);
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  await exhibits();
  await paintings();
  await props(io);
  await textures();
  ownWork();
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(statSync(p).size); } };
  walk(OUT);
  manifest.totals = { files: files.length, bytes: files.reduce((s, x) => s + x, 0), largestFileBytes: Math.max(...files) };
  writeFileSync(join(root, 'content', 'assets-v3.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(root, 'research', 'v3-licence-log.json'), JSON.stringify(log, null, 2) + '\n');
  console.log(`\n${files.length} files, ${(manifest.totals.bytes / 1e6).toFixed(2)} MB; largest ${(manifest.totals.largestFileBytes / 1e6).toFixed(2)} MB`);
  console.log('wrote content/assets-v3.json and research/v3-licence-log.json');
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
