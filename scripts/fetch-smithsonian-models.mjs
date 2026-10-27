#!/usr/bin/env node
/**
 * fetch-smithsonian-models.mjs — download the CC0 Smithsonian 3D scans used by
 * the game into data/raw/ (gitignored) and save each Open Access record JSON.
 *
 * For every object it:
 *  1. fetches the record from the Smithsonian Open Access API (api.si.edu),
 *  2. REFUSES to continue unless the record's metadata_usage.access === "CC0"
 *     AND the 3d_voyager media item's usage.access === "CC0",
 *  3. downloads the "_std_draco.glb" (Draco geometry, 2048 px textures) from
 *     3d-api.si.edu with a browser User-Agent (the CDN rejects bare clients),
 *  4. writes data/raw/<slug>.record.json for the verification log.
 *
 * Needs an api.si.edu key: DEMO_KEY works for a handful of calls (rate-limited).
 * Usage: SI_API_KEY=DEMO_KEY node scripts/fetch-smithsonian-models.mjs
 * Then:  node scripts/prepare-models.mjs
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(root, 'data', 'raw');
const KEY = process.env.SI_API_KEY || 'DEMO_KEY';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** Open Access ids (the `id` field of the API) for the objects in the game. */
export const OBJECTS = [
  { slug: 'morse-vail-key', id: 'ld1-1643398853934-1643398870277-0' },
  { slug: 'davenport-motor', id: 'ld1-1643398853934-1643398870885-0' },
  { slug: 'henry-trough-battery', id: 'ld1-1643398853934-1643398870231-1' },
  { slug: 'chester-relay', id: 'ld1-1643398853934-1643398876321-0' },
  { slug: 'page-induction-coil', id: 'ld1-1643398853934-1643398871180-0' },
  { slug: 'tangent-galvanometer', id: 'ld1-1643398853934-1643398875223-0' }, // transfer task
];
/** Objects whose 4096 px "150k-4096" GLB is also fetched (magnifier, on demand). */
export const HI_RES = {
  'morse-vail-key': 'morse-telegraph-key-150k-4096.glb',
  'chester-relay': 'telegraph-relay-150k-4096.glb',
  'page-induction-coil': 'page-induction-coil-150k-4096.glb',
  'henry-trough-battery': 'henry-trough-battery-150k-4096.glb',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getRecord(id) {
  const res = await fetch(`https://api.si.edu/openaccess/api/v1.0/content/${id}?api_key=${KEY}`);
  if (!res.ok) throw new Error(`record ${id}: HTTP ${res.status}`);
  return (await res.json()).response;
}

async function download(url, dest) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.ok && buf.subarray(0, 4).toString() === 'glTF') { writeFileSync(dest, buf); return buf.length; }
    console.warn(`  attempt ${attempt}: HTTP ${res.status}, ${buf.length} bytes (not a GLB) — retrying`);
    await sleep(4000 * attempt);
  }
  throw new Error(`download failed: ${url}`);
}

async function main() {
  mkdirSync(RAW, { recursive: true });
  for (const o of OBJECTS) {
    const rec = await getRecord(o.id);
    const dn = rec.content.descriptiveNonRepeating;
    if (dn.metadata_usage?.access !== 'CC0') throw new Error(`${o.slug}: record is not marked CC0 — refusing`);
    const media = (dn.online_media?.media || []).find((m) => m.type === '3d_voyager');
    if (!media) throw new Error(`${o.slug}: no 3d_voyager media`);
    if (media.usage?.access !== 'CC0') throw new Error(`${o.slug}: 3D media not marked CC0 — refusing`);
    const glb = media.resources.map((r) => r.url).find((u) => u.endsWith('_std_draco.glb'));
    writeFileSync(join(RAW, `${o.slug}.record.json`), JSON.stringify(rec, null, 2));
    const dest = join(RAW, `${o.slug}.glb`);
    if (existsSync(dest) && statSync(dest).size > 10_000) { console.log(`${o.slug}: already downloaded`); continue; }
    console.log(`${o.slug}: CC0 confirmed (${dn.record_ID}); downloading ${glb}`);
    const n = await download(glb, dest);
    console.log(`  ${(n / 1e6).toFixed(2)} MB`);
    await sleep(3000);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
