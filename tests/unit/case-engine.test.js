/**
 * Unit tests: the case engine (discovery, observation/inference classification,
 * evidence board, verdicts, scoring, calibration, save/resume) and the
 * solvability of BOTH shipped cases from content/.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CaseEngine, calibration, CONFIDENCE } from '../../src/systems/case-engine.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../../content/${p}`, import.meta.url), 'utf8'));
const tutorial = load('cases/tutorial.json');
const main = load('cases/main.json');

/** Play a case the way the expert would: discover everything, open every doc, pin key evidence, expert verdicts. */
function solveLikeExpert(def, conf = 3) {
  const e = new CaseEngine(def);
  for (const f of def.findings) expect(e.discover(f.id, f.tool).ok).toBe(true);
  for (const d of def.archive) e.openDoc(d.id);
  for (const c of def.claims) {
    const m = def.expertMap[c.id];
    for (const id of m.supports || []) e.pin(c.id, id, 'supports');
    for (const id of m.contradicts || []) e.pin(c.id, id, 'contradicts');
    for (const id of m.unclear || []) e.pin(c.id, id, 'unclear');
    e.setVerdict(c.id, c.verdict, conf);
  }
  return e;
}

describe('content solvability (plan section 10: case solvability check)', () => {
  for (const def of [tutorial, main]) {
    it(`${def.id}: every claim is resolvable from evidence the case offers`, () => {
      const r = CaseEngine.solvability(def);
      expect(r.problems).toEqual([]);
      expect(r.ok).toBe(true);
    });
    it(`${def.id}: an expert playthrough scores full marks`, () => {
      const s = solveLikeExpert(def).score();
      expect(s.verdictCorrect).toBe(def.claims.length);
      expect(s.linked).toBe(def.claims.length);
    });
  }
  it('main case has 3–4 objects, archival records and at least one fictional document', () => {
    expect(main.objects.length).toBeGreaterThanOrEqual(3);
    expect(main.objects.length).toBeLessThanOrEqual(4);
    expect(main.archive.filter((d) => d.kind === 'record').length).toBeGreaterThanOrEqual(3);
    expect(main.archive.some((d) => d.kind === 'fictional')).toBe(true);
  });
  it('both cases use all three verdicts, including "can\'t tell yet"', () => {
    for (const def of [tutorial, main]) {
      const verdicts = new Set(def.claims.map((c) => c.verdict));
      expect(verdicts).toEqual(new Set(['confirmed', 'refuted', 'cant-tell']));
    }
  });
  it('every fictional document is labelled fictional in its title', () => {
    for (const def of [tutorial, main]) {
      expect(def.fictionalDocument.title).toMatch(/fictional document created for this game/i);
      for (const d of def.archive.filter((x) => x.kind === 'fictional')) expect(d.title).toMatch(/fictional document created for this game/i);
    }
  });
  it('the red herring (relay serial number 589) is resolvable: the painted number is the catalog number', () => {
    const rec = main.archive.find((d) => d.id === 'rec-relay').excerpts.join(' ');
    expect(rec).toMatch(/catalog number: 335588/);
    expect(rec).toMatch(/serial number: 589/);
    const f = main.findings.find((x) => x.id === 'f-relay-number');
    expect(f.transcription.replace('.', '')).toMatch(/335588/);
  });
});

describe('discovery and classification', () => {
  it('a finding needs the matching tool (view findings need none)', () => {
    const e = new CaseEngine(main);
    expect(e.discover('f-relay-number', 'view')).toMatchObject({ ok: false, reason: 'needs-magnify' });
    expect(e.discover('f-relay-number', 'magnify').ok).toBe(true);
    expect(e.discover('f-relay-base', 'view').ok).toBe(true);
    expect(e.discover('nope', 'view').ok).toBe(false);
  });
  it('classifies observation vs inference with why-feedback', () => {
    const e = new CaseEngine(tutorial);
    const ok = e.classify('f-number', 's1', 'observation');
    expect(ok.correct).toBe(true);
    const bad = e.classify('f-number', 's2', 'observation');
    expect(bad.correct).toBe(false);
    expect(bad.expected).toBe('inference');
    expect(bad.why.length).toBeGreaterThan(10);
    expect(e.classificationScore()).toEqual({ correct: 1, total: 2 });
  });
});

describe('evidence board', () => {
  it('only discovered findings and opened documents can be pinned', () => {
    const e = new CaseEngine(main);
    expect(e.pin('M4', 'f-relay-number', 'contradicts')).toBe(false);
    e.discover('f-relay-number', 'magnify');
    expect(e.pin('M4', 'f-relay-number', 'contradicts')).toBe(true);
    expect(e.pin('M4', 'rec-relay', 'contradicts')).toBe(false);
    e.openDoc('rec-relay');
    expect(e.pin('M4', 'rec-relay', 'contradicts')).toBe(true);
    expect(e.pin('M4', 'rec-relay', 'bogus')).toBe(false);
  });
  it('the claim card itself is not offered as evidence', () => {
    const e = new CaseEngine(main);
    e.openDoc('card-main');
    expect(e.availableEvidence().map((x) => x.id)).not.toContain('card-main');
  });
  it('linking key evidence the wrong way round does not count', () => {
    const e = new CaseEngine(main);
    e.openDoc('rec-davenport');
    e.pin('M2', 'rec-davenport', 'supports');
    expect(e.evidenceLinked('M2')).toBe(false);
    e.pin('M2', 'rec-davenport', 'contradicts');
    expect(e.evidenceLinked('M2')).toBe(true);
  });
});

describe('verdicts, confidence and scoring', () => {
  it('confidence can be set before or after the verdict', () => {
    const e = new CaseEngine(main);
    e.setConfidence('M1', 4);
    expect(e.allVerdictsSet()).toBe(false);
    e.setVerdict('M1', 'refuted');
    expect(e.state.verdicts.M1).toEqual({ verdict: 'refuted', confidence: 4 });
  });
  it('flags overconfident wrong answers', () => {
    const e = solveLikeExpert(main, 3);
    e.setVerdict('M5', 'confirmed', 4); // the family-story trap, stated as certain
    const s = e.score();
    expect(s.verdictCorrect).toBe(main.claims.length - 1);
    expect(s.overconfident).toEqual(['M5']);
  });
  it('save/resume round-trips the full state', () => {
    const e = solveLikeExpert(tutorial);
    e.setLabel('Telegraph key, 1844.');
    const restored = new CaseEngine(tutorial, JSON.parse(JSON.stringify(e.toJSON())));
    expect(restored.score()).toEqual(e.score());
    expect(restored.state.label).toBe('Telegraph key, 1844.');
    // a save from another case is ignored
    expect(new CaseEngine(main, e.toJSON()).state.discovered).toEqual([]);
  });
});

describe('calibration', () => {
  it('perfectly confident and right gives a low Brier score', () => {
    const c = calibration([{ p: 0.95, correct: true }, { p: 0.95, correct: true }]);
    expect(c.brier).toBeLessThan(0.01);
    expect(c.summary).toMatch(/well calibrated/i);
  });
  it('detects over- and under-confidence', () => {
    expect(calibration([{ p: 0.95, correct: false }, { p: 0.95, correct: true }]).summary).toMatch(/overconfident/i);
    expect(calibration([{ p: 0.4, correct: true }, { p: 0.4, correct: true }]).summary).toMatch(/underconfident/i);
  });
  it('empty input is handled', () => { expect(calibration([]).brier).toBeNull(); });
  it('confidence scale is monotonic', () => {
    for (let i = 1; i < CONFIDENCE.length; i++) expect(CONFIDENCE[i].p).toBeGreaterThan(CONFIDENCE[i - 1].p);
  });
});
