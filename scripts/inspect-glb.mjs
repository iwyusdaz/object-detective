#!/usr/bin/env node
/**
 * inspect-glb.mjs — print the glTF JSON summary of each GLB in a folder
 * (nodes, POSITION bounds, images, materials). Used to plan scaling: the
 * Smithsonian packages are authored in metres ("units": "m" in Voyager), and
 * the game checks the bounding box against the record's measurements.
 * Usage: node scripts/inspect-glb.mjs data/raw
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'data/raw';
for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb')).sort()) {
  const b = readFileSync(join(dir, f));
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
  console.log(`== ${f}  meshes=${j.meshes.length} nodes=${j.nodes.length} ext=${JSON.stringify(j.extensionsUsed || [])}`);
  for (const n of j.nodes) {
    const { name, scale, rotation, translation, matrix, mesh } = n;
    console.log('   node', JSON.stringify({ name, scale, rotation, translation, matrix, mesh }));
  }
  const pos = j.accessors.filter((a) => a.max && a.type === 'VEC3').slice(0, 1);
  for (const a of pos) {
    const size = a.max.map((x, i) => +(x - a.min[i]).toFixed(4));
    console.log('   POSITION min', a.min.map((x) => +x.toFixed(4)), 'max', a.max.map((x) => +x.toFixed(4)), 'size', size, 'count', a.count);
  }
  console.log('   images', JSON.stringify((j.images || []).map((i) => [i.mimeType, i.name])));
  console.log('   materials', JSON.stringify(j.materials.map((m) => ({ name: m.name, pbr: Object.keys(m.pbrMetallicRoughness || {}), normal: !!m.normalTexture, occ: !!m.occlusionTexture }))));
}
