/**
 * Unit tests: every committed scan (base 2048 px and on-demand 4096 px) is in
 * metres, and each hi-res model matches its base model's size (agent review
 * V1/V2/R1/H1: the 4k files were in inches or millimetres). Also covers the
 * runtime safety net that normalises a mis-scaled hi-res model.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { glbExtent, chooseFactor, scaleGlbPositions } from '../../scripts/glb-units.mjs';
import { normaliseFactor } from '../../src/scenes/inspection.js';
import { formatLength } from '../../src/systems/measure.js';

const root = new URL('../../', import.meta.url);
const models = JSON.parse(readFileSync(new URL('content/models.json', root), 'utf8'));
const glb = (p) => readFileSync(new URL(`public/${p}`, root));
const longest = (ext) => Math.max(...ext);

describe('scan units: every GLB is in metres', () => {
  for (const [id, m] of Object.entries(models)) {
    it(`${id}: base model longest extent is 0.05–1.0 m and matches models.json`, () => {
      expect(existsSync(new URL(`public/${m.file}`, root))).toBe(true);
      const ext = glbExtent(glb(m.file));
      expect(longest(ext)).toBeGreaterThan(0.05);
      expect(longest(ext)).toBeLessThan(1.0);
      expect(longest(ext)).toBeCloseTo(longest(m.boundsMetres), 3);
    });
    if (m.hiRes) {
      it(`${id}: hi-res model is in metres and within 5% of the base model`, () => {
        const hi = longest(glbExtent(glb(m.hiRes)));
        const base = longest(glbExtent(glb(m.file)));
        expect(hi).toBeGreaterThan(0.05);
        expect(hi).toBeLessThan(1.0);
        expect(Math.abs(hi / base - 1)).toBeLessThan(0.05);
        // Measuring the longest side on the hi-res model gives a sane centimetre value.
        expect(formatLength(hi).cm).toBeCloseTo(formatLength(base).cm, 0);
        expect(formatLength(hi).cm).toBeLessThan(40);
      });
    }
  }
  it('at least four objects have a hi-res magnifier model', () => {
    expect(Object.values(models).filter((m) => m.hiRes).length).toBeGreaterThanOrEqual(4);
  });
});

describe('unit conversion helpers', () => {
  it('snaps inch and millimetre sources to exact factors', () => {
    expect(chooseFactor(8.322, 0.2114)).toEqual({ factor: 0.0254, unit: 'inch' });
    expect(chooseFactor(169.08, 0.1691)).toEqual({ factor: 0.001, unit: 'millimetre' });
    expect(chooseFactor(0.2114, 0.2114)).toEqual({ factor: 1, unit: 'metre' });
  });
  it('rescales an uncompressed GLB and keeps it parseable', () => {
    const base = glb(models['chester-relay'].hiRes);
    const scaled = scaleGlbPositions(base, 10);
    expect(longest(glbExtent(scaled))).toBeCloseTo(longest(glbExtent(base)) * 10, 3);
    expect(scaled.readUInt32LE(8)).toBe(scaled.length);
  });
});

describe('runtime safety net (Inspection.loadHiRes)', () => {
  const box = (s) => new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(s, s / 2, s / 3));
  it('leaves a correctly scaled hi-res model alone', () => {
    expect(normaliseFactor(box(0.212), box(0.211))).toBe(1);
  });
  it('scales an inch-unit model down to the base size', () => {
    expect(normaliseFactor(box(8.32), box(0.2114))).toBeCloseTo(0.0254, 3);
  });
  it('ignores empty boxes', () => {
    expect(normaliseFactor(new THREE.Box3(), box(0.2))).toBe(1);
  });
});
