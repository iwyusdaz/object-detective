/**
 * Unit tests: tool math (measurement units, raking-light geometry, true-size
 * statements, key map) and the FACT AUDIT (plan section 10): every real-object
 * fact used in content matches the saved Smithsonian record, and scan bounds
 * agree with the record's measurements (true scale).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { formatLength, parseInches, relativeDifference, CM_PER_INCH } from '../../src/systems/measure.js';
import { clampRaking, rakingDirection, RAKING_REVEAL_MAX_ELEVATION } from '../../src/systems/raking-light.js';
import { comparisons, REFERENCES } from '../../src/systems/true-size-view.js';
import { longestPreset } from '../../src/app-tools.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const objects = load('content/objects.json').objects;
const models = load('content/models.json');
const main = load('content/cases/main.json');
const tutorial = load('content/cases/tutorial.json');

describe('measurement', () => {
  it('formats metres as cm and inches', () => {
    expect(formatLength(0.17145)).toMatchObject({ cm: 17.1, inches: 6.75 });
    expect(formatLength(0.0254).text).toBe('2.5 cm (1.00 in)');
    expect(CM_PER_INCH).toBe(2.54);
  });
  it('parses record-style mixed fractions', () => {
    expect(parseInches('6 3/4 in')).toBeCloseTo(6.75);
    expect(parseInches('1 7/8')).toBeCloseTo(1.875);
    expect(parseInches('15 in')).toBe(15);
  });
  it('relative difference', () => { expect(relativeDifference(16.9, 17.145)).toBeCloseTo(0.0143, 3); });
  it('longest-side preset spans the longest bounding-box axis', () => {
    const p = longestPreset({ x: 0.1, y: 0.05, z: 0.3 });
    expect(p.a[2]).toBe(0);
    expect(p.b[2]).toBe(1);
  });
});

describe('raking light', () => {
  it('clamps and wraps controls', () => {
    expect(clampRaking({ azimuth: -10, elevation: 0, intensity: 99 })).toEqual({ azimuth: 350, elevation: 2, intensity: 6 });
    expect(clampRaking({ azimuth: 725, elevation: 90, intensity: 0 })).toEqual({ azimuth: 5, elevation: 60, intensity: 0.5 });
  });
  it('direction is a unit vector with the right elevation', () => {
    const [x, y, z] = rakingDirection(90, 10);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
    expect(Math.asin(y) * 180 / Math.PI).toBeCloseTo(10);
    expect(x).toBeGreaterThan(0.9);
  });
  it('reveal threshold is a low, grazing angle', () => { expect(RAKING_REVEAL_MAX_ELEVATION).toBeLessThanOrEqual(25); });
});

describe('true-size references (verified sizes, research/sources.md)', () => {
  it('uses the US quarter and ISO/IEC 7810 ID-1 card sizes', () => {
    expect(REFERENCES.quarter.diameterM).toBeCloseTo(0.02426);
    expect(REFERENCES.card.widthM).toBeCloseTo(0.0856);
    expect(REFERENCES.card.heightM).toBeCloseTo(0.05398);
  });
  it('builds a comparison statement from record dimensions', () => {
    expect(comparisons([7.62, 5.08, 17.145])).toMatch(/17\.1 cm/);
  });
});

describe('fact audit: content vs the saved Smithsonian records', () => {
  // Committed, trimmed CC0 fixture (tests/fixtures/si-records.json) so the audit
  // always runs, including in CI. If the full raw API response is present
  // locally (data/raw/si3d.json, gitignored), it is audited too as a refresh check.
  const fixture = new URL('../../tests/fixtures/si-records.json', import.meta.url);
  const raw = new URL('../../data/raw/si3d.json', import.meta.url);
  let rows = null;
  beforeAll(() => { rows = JSON.parse(readFileSync(fixture, 'utf8')).response.rows; });
  it('the fixture holds all six records the game uses', () => {
    const ids = new Set(rows.map((r) => r.content.descriptiveNonRepeating.record_ID));
    for (const o of objects) expect(ids.has(o.record.recordId), o.record.recordId).toBe(true);
  });
  it.runIf(existsSync(raw))('optional refresh: the fixture matches the full raw API response', () => {
    const full = JSON.parse(readFileSync(raw, 'utf8')).response.rows;
    for (const r of rows) {
      const f = full.find((x) => x.content.descriptiveNonRepeating.record_ID === r.content.descriptiveNonRepeating.record_ID);
      expect(f.content.freetext).toEqual(r.content.freetext);
      expect(f.content.descriptiveNonRepeating.metadata_usage).toEqual(r.content.descriptiveNonRepeating.metadata_usage);
    }
  });
  const recordText = (recordId) => {
    const row = rows.find((r) => r.content.descriptiveNonRepeating.record_ID === recordId);
    return JSON.stringify(row.content);
  };
  for (const o of objects) {
    it(`${o.id}: record id, dates, makers, numbers and descriptions match the API record`, () => {
      const txt = recordText(o.record.recordId);
      expect(JSON.parse(txt).descriptiveNonRepeating.metadata_usage.access).toBe('CC0');
      const json = JSON.parse(txt);
      const media3d = json.descriptiveNonRepeating.online_media.media.filter((m) => m.type === '3d_voyager');
      expect(media3d.length).toBeGreaterThan(0);
      for (const m of media3d) expect(m.usage.access).toBe('CC0');
      const strings = [o.record.idNumber, o.record.dateMade, o.measurementsText, ...(o.record.makers || []), ...(o.record.descriptions || []), o.record.creditLine, o.record.patentNumber, o.record.serialNumber].filter(Boolean);
      for (const s of strings) expect(txt.includes(JSON.stringify(s).slice(1, -1)), `"${s}" not found in record ${o.record.recordId}`).toBe(true);
    });
  }
  it('record excerpts quoted in the case archives appear verbatim in the API records', () => {
    const all = rows.map((r) => JSON.stringify(r.content)).join('\n');
    for (const def of [tutorial, main]) {
      for (const d of def.archive.filter((x) => x.kind === 'record')) {
        for (const ex of d.excerpts) {
          for (const q of ex.match(/"([^"]{12,})"/g) || []) {
            const inner = q.slice(1, -1).replace(/^"|"$/g, '');
            expect(all.includes(JSON.stringify(inner).slice(1, -1)), `quote not in records: ${inner.slice(0, 60)}`).toBe(true);
          }
        }
      }
    }
  });
});

describe('true scale: scan bounding boxes vs record measurements', () => {
  it('objects whose scan does not match the record are flagged and never used for measurement', () => {
    const unverified = objects.filter((o) => !o.scaleVerified);
    for (const o of unverified) {
      expect(o.scaleNote).toMatch(/does not match/);
      // not in any case (cases use the measure tool); transfer task uses photos only
      expect([...tutorial.objects, ...main.objects]).not.toContain(o.id);
    }
  });
  for (const o of objects.filter((x) => x.scaleVerified)) {
    it(`${o.id}: scan size matches the record within 10%`, () => {
      const scan = [...models[o.id].boundsMetres].map((m) => m * 100).sort((a, b) => b - a);
      const rec = [...o.dimensionsCm].sort((a, b) => b - a);
      // Compare the longest dimension (orientation of the other axes varies by scan).
      expect(relativeDifference(scan[0], rec[0])).toBeLessThan(0.1);
    });
  }
});
