#!/usr/bin/env node
/**
 * check-v3-assets.mjs — offline checks for the plan 10 S4 staging:
 *  1. catalog (content/objects.json "objects", one scene "gallery"): §4.1 fields, short <= 25 words,
 *     more <= 120 words, honesty and role values, unique ids, >= 20 objects,
 *     every non-empty source appears in the research notes (research/*.md, *.json), "real" entries
 *     have a source;
 *  2. realSize vs the bounds of the file that renders the object (within 15%,
 *     §4.3), for entries whose _asset names a manifest entry; "_scale"
 *     exceptions are listed, not tested;
 *  3. every file in content/assets-v3.json exists, matches its bytes and
 *     sha256, starts with the right magic bytes (GLB / KTX2) and is <= 20 MB;
 *  4. every manifest licence is on the allowed list and every v3 source URL has
 *     a row in ATTRIBUTION.md and public/attribution.json.
 * Prints a summary and exits 1 on any failure.
 * Usage: node scripts/check-v3-assets.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_LICENCES } from './fetch-v3-assets.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const j = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

const catalog = j('content/objects.json');
const v3 = j('content/assets-v3.json');
const v1 = j('content/models.json');
const v2 = j('public/assets/models/manifest.json');
// Research notes: every .md and .json under research/ (sources.md, object-verification-log.md, v3-licence-log.json, …).
const sources = readdirSync(join(root, 'research')).filter((f) => /\.(md|json)$/.test(f)).map((f) => readFileSync(join(root, 'research', f), 'utf8')).join('\n');
const attrMd = readFileSync(join(root, 'ATTRIBUTION.md'), 'utf8');
const attrJson = JSON.stringify(j('public/attribution.json'));

// 1. catalog fields
const FIELDS = ['id', 'name', 'short', 'more', 'whyItMatters', 'realSize', 'honesty', 'source', 'role'];
const HONESTY = ['real', 'reconstructed', 'fictional', 'illustrative', 'time-lapse'];
const ids = new Set();
let count = 0;
const honestyCount = {};
for (const scene of catalog.scenes) {
  const inScene = catalog.objects.filter((o) => (o.scene || 'gallery') === scene.id);
  ok(inScene.length >= 20, `${scene.id}: ${inScene.length} objects (< 20)`);
  for (const o of inScene) {
    count++;
    for (const f of FIELDS) ok(f in o, `${o.id}: missing ${f}`);
    ok(!ids.has(o.id), `duplicate id ${o.id}`);
    ids.add(o.id);
    ok(words(o.short) <= 25, `${o.id}: short has ${words(o.short)} words`);
    ok(words(o.more) <= 120, `${o.id}: more has ${words(o.more)} words`);
    ok(HONESTY.includes(o.honesty), `${o.id}: honesty ${o.honesty}`);
    ok(['task', 'explore'].includes(o.role), `${o.id}: role ${o.role}`);
    ok(o.realSize === null || (Array.isArray(o.realSize) && o.realSize.length === 3 && o.realSize.every((x) => x > 0)), `${o.id}: realSize`);
    ok(o.realSize !== null || o._scale, `${o.id}: realSize null without a _scale note`);
    if (o.source) ok(sources.includes(o.source.split('#')[0]) || sources.includes(o.source.replace(/^https?:\/\//, '')), `${o.id}: source not in the research notes: ${o.source}`);
    if (o.honesty === 'real') ok(!!o.source, `${o.id}: real entry without a source`);
    honestyCount[o.honesty] = (honestyCount[o.honesty] || 0) + 1;
  }
}

// 2. realSize vs file bounds
function boundsFor(asset) {
  const m = /^(content\/models\.json|public\/assets\/models\/manifest\.json|content\/assets-v3\.json)#([\w-]+)(?:\.([\w-]+))?$/.exec(asset || '');
  if (!m) return null;
  if (m[1] === 'content/models.json') return v1[m[2]]?.boundsMetres;
  if (m[1] === 'public/assets/models/manifest.json') return V2_BOUNDS[m[2]];
  const e = v3[m[2]]?.[m[3]];
  return e?.boundsMetres || null;
}
// Native bounds of the v2 Poly Haven GLBs (measured with gltf-transform getBounds, 2026-10-30).
const V2_BOUNDS = {
  Chandelier_01: [0.7465, 0.7983, 0.8155],
  vintage_grandfather_clock_01: [0.6256, 2.1906, 0.4266],
  wooden_bookshelf_worn: [1.374, 2.0634, 0.5813],
  drawer_cabinet: [1.1411, 1.8813, 0.4881],
  desk_lamp_arm_01: [0.2017, 0.8926, 0.6139],
  ceramic_vase_01: [0.2036, 0.4003, 0.2036],
  Lantern_01: [0.1221, 0.2942, 0.0972],
};
const scale = [];
for (const o of catalog.objects) {
  // "_scale" notes that start with Exempt / No scale are exceptions; other notes only explain the value.
  if (/^(Exempt|No scale)/.test(o._scale || '')) { scale.push(`${o.id}: exception (${o._scale.slice(0, 70)}…)`); continue; }
  const b = boundsFor(o._asset);
  if (!b || !o.realSize) { scale.push(`${o.id}: built in code, S6 builds it to realSize`); continue; }
  const worst = Math.max(...b.map((x, i) => Math.abs(x / o.realSize[i] - 1)));
  ok(worst <= 0.15, `${o.id}: bounds ${b.join(' x ')} vs realSize ${o.realSize.join(' x ')} (${(worst * 100).toFixed(1)}% off)`);
  scale.push(`${o.id}: file bounds within ${(worst * 100).toFixed(1)}%`);
}

// 3 + 4. files, sizes, magic bytes, licences, attribution rows
const files = [];
const collect = (e, label) => { if (e?.file) files.push({ ...e, label }); };
for (const [k, e] of Object.entries(v3.exhibits)) collect(e, `exhibits/${k}`);
for (const [k, e] of Object.entries(v3.props)) collect(e, `props/${k}`);
for (const [k, e] of Object.entries(v3.own)) collect(e, `own/${k}`);
for (const [k, e] of Object.entries(v3.paintings)) for (const [px, f] of Object.entries(e.files)) collect(f, `paintings/${k}@${px}`);
for (const [k, e] of Object.entries(v3.textures)) for (const [m, f] of Object.entries(e.maps)) collect(f, `textures/${k}-${m}`);
const tiers = { first: 0, stream: 0 };
for (const f of files) {
  const buf = readFileSync(join(root, 'public', f.file));
  ok(buf.length === f.bytes && statSync(join(root, 'public', f.file)).size === f.bytes, `${f.label}: size mismatch`);
  ok(createHash('sha256').update(buf).digest('hex') === f.sha256, `${f.label}: sha256 mismatch`);
  ok(buf.length <= 20e6, `${f.label}: ${buf.length} bytes > 20 MB`);
  const magic = f.file.endsWith('.glb') ? buf.subarray(0, 4).toString() === 'glTF' : buf.subarray(1, 7).toString() === 'KTX 20';
  ok(magic, `${f.label}: bad magic bytes`);
  const tier = f.label.startsWith('paintings/') ? (f.label.endsWith('@2048') ? 'stream' : 'first') : f.label.startsWith('exhibits/') ? 'stream' : 'first';
  tiers[tier] += buf.length;
}
const groups = [...Object.values(v3.exhibits), ...Object.values(v3.props), ...Object.values(v3.own), ...Object.values(v3.paintings), ...Object.values(v3.textures)];
for (const g of groups) ok(ALLOWED_LICENCES.includes(g.licence), `licence ${g.licence} not allowed`);
const urls = [
  ...Object.values(v3.exhibits).map((e) => e.voyagerUrl),
  ...Object.values(v3.props).map((e) => e.source),
  ...Object.values(v3.paintings).map((e) => e.objectURL),
  ...Object.values(v3.textures).map((e) => e.source),
];
for (const u of urls) {
  ok(attrMd.includes(u), `ATTRIBUTION.md has no row for ${u}`);
  ok(attrJson.includes(u), `public/attribution.json has no row for ${u}`);
}
ok(attrMd.includes('exit sign face, night facade'), 'ATTRIBUTION.md has no row for the own-work textures');

console.log(`catalog: ${count} objects in ${catalog.scenes.length} scene(s); task ${catalog.objects.filter((o) => o.role === 'task').length}, explore ${catalog.objects.filter((o) => o.role === 'explore').length}; honesty ${JSON.stringify(honestyCount)}`);
console.log(scale.map((s) => `  scale ${s}`).join('\n'));
console.log(`files: ${files.length} v3 files, largest ${(Math.max(...files.map((f) => f.bytes)) / 1e6).toFixed(2)} MB; tier first ${(tiers.first / 1e6).toFixed(2)} MB, stream ${(tiers.stream / 1e6).toFixed(2)} MB`);
console.log(`licences: ${[...new Set(groups.map((g) => g.licence))].join(', ')}; ${urls.length} source URLs checked in ATTRIBUTION.md and public/attribution.json`);
if (fails.length) { console.error(`\nFAIL (${fails.length}):\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log('\nPASS');
