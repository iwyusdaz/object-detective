/**
 * glb-units.mjs — small, dependency-free GLB helpers used by prepare-models.mjs
 * and the unit tests: read the JSON chunk, measure POSITION extents, and
 * rescale an uncompressed (non-Draco) GLB's POSITION data to metres.
 *
 * Why: the Smithsonian "150k-4096" packages are authored in the scan's native
 * units (inches for the relay, battery and coil; millimetres for the key),
 * while the "_std_draco" packages are in metres. glTF requires metres, so the
 * hi-res copies are rescaled at the source (agent review V1/R1/H1).
 */

/** Split a GLB buffer into { json, bin, jsonLen }. */
export function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen;
  const bin = binStart < buf.length ? buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart)) : null;
  return { json, bin };
}

/** Bounding-box extent [x, y, z] of all POSITION accessors (from accessor min/max). */
export function glbExtent(buf) {
  const { json } = readGlb(buf);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives) {
      const a = json.accessors[prim.attributes.POSITION];
      for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min[i]); max[i] = Math.max(max[i], a.max[i]); }
    }
  }
  return max.map((x, i) => x - min[i]);
}

/** Known authoring units and their metre factors (snapped to when close). */
export const UNIT_FACTORS = { inch: 0.0254, millimetre: 0.001, centimetre: 0.01, metre: 1 };

/** Choose the factor that maps `hiLongest` onto `baseLongest`, snapped to a known unit within 3%. */
export function chooseFactor(hiLongest, baseLongest) {
  const raw = baseLongest / hiLongest;
  for (const [unit, f] of Object.entries(UNIT_FACTORS)) {
    if (Math.abs(raw / f - 1) < 0.03) return { factor: f, unit };
  }
  return { factor: raw, unit: 'matched to base model' };
}

/**
 * Return a new GLB buffer with every POSITION accessor scaled by `factor`
 * (float32 data in the BIN chunk plus accessor min/max). Uniform scaling leaves
 * normals and UVs unchanged. Draco or sparse positions are rejected.
 */
export function scaleGlbPositions(buf, factor) {
  const { json } = readGlb(buf);
  if ((json.extensionsUsed || []).includes('KHR_draco_mesh_compression')) throw new Error('Draco GLB: rescale with a full glTF tool');
  const out = Buffer.from(buf);
  const jsonLen = out.readUInt32LE(12);
  const binData = 20 + jsonLen + 8;
  const done = new Set();
  for (const mesh of json.meshes) {
    for (const prim of mesh.primitives) {
      const idx = prim.attributes.POSITION;
      if (done.has(idx)) continue;
      done.add(idx);
      const a = json.accessors[idx];
      if (a.sparse || a.componentType !== 5126 || a.type !== 'VEC3') throw new Error('unsupported POSITION accessor');
      const bv = json.bufferViews[a.bufferView];
      const stride = bv.byteStride || 12;
      const start = binData + (bv.byteOffset || 0) + (a.byteOffset || 0);
      for (let v = 0; v < a.count; v++) {
        for (let c = 0; c < 3; c++) {
          const o = start + v * stride + c * 4;
          out.writeFloatLE(out.readFloatLE(o) * factor, o);
        }
      }
      a.min = a.min.map((x) => x * factor);
      a.max = a.max.map((x) => x * factor);
    }
  }
  // Re-encode the JSON chunk (padded with spaces to a 4-byte boundary).
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (js.length % 4)) % 4;
  js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const rest = out.subarray(20 + jsonLen);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + js.length + rest.length, 8);
  header.writeUInt32LE(js.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, js, rest]);
}
