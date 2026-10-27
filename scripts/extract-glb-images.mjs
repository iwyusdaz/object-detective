#!/usr/bin/env node
/**
 * extract-glb-images.mjs — write the embedded texture images of each GLB to
 * tmp/textures/<slug>-<i>.jpg so the builder can inspect the scanned surface
 * (e.g. look for stamped marks) before writing any observation text.
 * Usage: node scripts/extract-glb-images.mjs data/raw [outDir]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const dir = process.argv[2] || 'data/raw';
const out = process.argv[3] || 'tmp/textures';
mkdirSync(out, { recursive: true });
for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb'))) {
  const b = readFileSync(join(dir, f));
  const jlen = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jlen).toString('utf8'));
  const binStart = 20 + jlen + 8;
  (j.images || []).forEach((img, i) => {
    const bv = j.bufferViews[img.bufferView];
    const data = b.subarray(binStart + (bv.byteOffset || 0), binStart + (bv.byteOffset || 0) + bv.byteLength);
    const role = Object.entries({ base: j.materials[0].pbrMetallicRoughness?.baseColorTexture?.index, normal: j.materials[0].normalTexture?.index, orm: j.materials[0].occlusionTexture?.index })
      .filter(([, t]) => t != null && j.textures[t].source === i).map(([k]) => k).join('+') || `img${i}`;
    const name = `${basename(f, '.glb')}-${role}.jpg`;
    writeFileSync(join(out, name), data);
    console.log(name, data.length);
  });
}
