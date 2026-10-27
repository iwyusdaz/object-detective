#!/usr/bin/env node
/**
 * prepare-models.mjs — copy the downloaded scans from data/raw/ into
 * public/assets/models/ with content-hashed filenames (build contract 08 5.1)
 * and write content/models.json (slug -> file, bytes, sha256, bounding size).
 *
 * The Smithsonian "_std_draco" GLBs are already Draco-compressed with 2048 px
 * textures (~1.3–2.1 MB each), inside the per-file and first-interaction
 * budgets, so no further decimation is applied (see DECISIONS.md D-07).
 * Usage: node scripts/prepare-models.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OBJECTS, HI_RES } from './fetch-smithsonian-models.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(root, 'data', 'raw');
const OUT = join(root, 'public', 'assets', 'models');
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(join(OUT, f));

const manifest = {};
for (const o of OBJECTS) {
  const buf = readFileSync(join(RAW, `${o.slug}.glb`));
  const sha = createHash('sha256').update(buf).digest('hex');
  const name = `${o.slug}-${sha.slice(0, 10)}.glb`;
  writeFileSync(join(OUT, name), buf);
  const len = buf.readUInt32LE(12);
  const j = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  const pos = j.accessors.find((a) => a.max && a.type === 'VEC3');
  const sizeM = pos.max.map((x, i) => +(x - pos.min[i]).toFixed(4));
  manifest[o.slug] = { file: `assets/models/${name}`, bytes: buf.length, sha256: sha, boundsMetres: sizeM };
  // Optional on-demand 4096 px texture variant for the magnifier (data/raw/hi/<slug>.glb).
  const hiPath = join(RAW, 'hi', `${o.slug}.glb`);
  if (HI_RES[o.slug] && existsSync(hiPath)) {
    const hb = readFileSync(hiPath);
    if (hb.length > 19.5e6) throw new Error(`${o.slug} hi-res exceeds the 20 MB single-file budget`);
    const hsha = createHash('sha256').update(hb).digest('hex');
    const hname = `${o.slug}-4k-${hsha.slice(0, 10)}.glb`;
    writeFileSync(join(OUT, hname), hb);
    manifest[o.slug].hiRes = `assets/models/${hname}`;
    manifest[o.slug].hiResBytes = hb.length;
  }
  console.log(`${o.slug}: ${name} ${(buf.length / 1e6).toFixed(2)} MB bounds ${sizeM.join(' x ')} m${manifest[o.slug].hiRes ? ' + 4k' : ''}`);
}
writeFileSync(join(root, 'content', 'models.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('content/models.json written');
