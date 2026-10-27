/**
 * Case engine — the historical-thinking loop, shared by 3D mode and text mode
 * (both call the same methods, so every decision exists in both):
 *   brief -> inspect (discover findings, classify observation vs inference)
 *   -> archive (open records, sourcing questions) -> evidence board (pin
 *   evidence to claims as supports / contradicts / unclear) -> verdicts with
 *   confidence -> label (self-check against rubric + exemplar) -> debrief.
 * Pure logic: no DOM, no three.js. Serializable for save/resume.
 * @module systems/case-engine
 */

export const VERDICTS = { confirmed: 'Confirmed', refuted: 'Refuted', 'cant-tell': "Can't tell yet" };
export const RELATIONS = { supports: 'Supports', contradicts: 'Contradicts', unclear: 'Unclear' };
/** Confidence scale (1–4) and the probability each level expresses, for calibration. */
export const CONFIDENCE = [
  { level: 1, label: 'Guessing', p: 0.4 },
  { level: 2, label: 'Somewhat sure', p: 0.6 },
  { level: 3, label: 'Fairly sure', p: 0.8 },
  { level: 4, label: 'Certain', p: 0.95 },
];

export class CaseEngine {
  /** @param {object} caseDef content/cases/*.json */
  constructor(caseDef, saved = null) {
    this.def = caseDef;
    this.state = {
      caseId: caseDef.id,
      discovered: [],
      classifications: {},
      archiveOpened: [],
      sourcing: {},
      pins: {},
      verdicts: {},
      label: '',
      selfCheck: {},
      submitted: false,
      ...(saved && saved.caseId === caseDef.id ? saved : {}),
    };
  }

  /* ---------------- lookups ---------------- */
  finding(id) { return this.def.findings.find((f) => f.id === id) || null; }
  doc(id) { return this.def.archive.find((d) => d.id === id) || null; }
  claim(id) { return this.def.claims.find((c) => c.id === id) || null; }
  evidence(id) {
    const f = this.finding(id);
    if (f) return { id, type: 'finding', title: f.hotspot.label, text: f.description, objectId: f.objectId };
    const d = this.doc(id);
    if (d) return { id, type: d.kind === 'fictional' ? 'fictional' : 'record', title: d.title, text: d.excerpts.join(' '), objectId: d.objectId || null };
    return null;
  }

  /* ---------------- inspect ---------------- */
  /**
   * Record that a finding was revealed. `tool` must match the finding's tool
   * (view / magnify / raking / measure) — text mode passes the same tool name
   * when the learner chooses the matching "look" action.
   * @returns {{ok:boolean, reason?:string, finding?:object}}
   */
  discover(findingId, tool) {
    const f = this.finding(findingId);
    if (!f) return { ok: false, reason: 'unknown finding' };
    if (f.tool !== 'view' && tool !== f.tool) return { ok: false, reason: `needs-${f.tool}` };
    if (!this.state.discovered.includes(findingId)) this.state.discovered.push(findingId);
    return { ok: true, finding: f };
  }
  isDiscovered(id) { return this.state.discovered.includes(id); }

  /** Classify one statement as observation or inference; returns why-feedback. */
  classify(findingId, statementId, kind) {
    const f = this.finding(findingId);
    const s = f?.statements.find((x) => x.id === statementId);
    if (!s) return null;
    this.state.classifications[findingId] ||= {};
    this.state.classifications[findingId][statementId] = kind;
    const correct = s.kind === kind;
    return { correct, expected: s.kind, why: s.why, statement: s.text };
  }

  classificationScore() {
    let correct = 0; let total = 0;
    for (const [fid, byStmt] of Object.entries(this.state.classifications)) {
      const f = this.finding(fid);
      for (const [sid, kind] of Object.entries(byStmt)) {
        total++;
        if (f.statements.find((s) => s.id === sid)?.kind === kind) correct++;
      }
    }
    return { correct, total };
  }

  /* ---------------- archive ---------------- */
  openDoc(docId) {
    if (!this.doc(docId)) return false;
    if (!this.state.archiveOpened.includes(docId)) this.state.archiveOpened.push(docId);
    return true;
  }
  answerSourcing(qid, optionId) {
    const q = (this.def.sourcingQuestions || []).find((x) => x.id === qid);
    if (!q) return null;
    this.state.sourcing[qid] = optionId;
    return { correct: q.correct === optionId, why: q.why };
  }

  /** Evidence the learner can pin: discovered findings + opened documents (not the claim card itself). */
  availableEvidence() {
    const ids = [...this.state.discovered, ...this.state.archiveOpened.filter((id) => id !== this.def.fictionalDocument?.id)];
    return ids.map((id) => this.evidence(id)).filter(Boolean);
  }

  /* ---------------- evidence board ---------------- */
  pin(claimId, evidenceId, relation) {
    if (!this.claim(claimId) || !RELATIONS[relation]) return false;
    if (!this.availableEvidence().some((e) => e.id === evidenceId)) return false;
    this.state.pins[claimId] ||= {};
    this.state.pins[claimId][evidenceId] = relation;
    return true;
  }
  unpin(claimId, evidenceId) { if (this.state.pins[claimId]) delete this.state.pins[claimId][evidenceId]; }
  pinsFor(claimId) { return this.state.pins[claimId] || {}; }

  /** Set a verdict; keeps an existing confidence rating, else defaults to 2 ("Somewhat sure"). */
  setVerdict(claimId, verdict, confidence) {
    if (!this.claim(claimId) || !VERDICTS[verdict]) return false;
    const prev = this.state.verdicts[claimId];
    const c = Math.min(4, Math.max(1, Math.round(confidence || prev?.confidence || 2)));
    this.state.verdicts[claimId] = { verdict, confidence: c };
    return true;
  }

  /** Set confidence (1–4) independently of the verdict (either may come first). */
  setConfidence(claimId, confidence) {
    if (!this.claim(claimId)) return false;
    const c = Math.min(4, Math.max(1, Math.round(confidence)));
    this.state.verdicts[claimId] = { verdict: this.state.verdicts[claimId]?.verdict || null, confidence: c };
    return true;
  }

  allVerdictsSet() { return this.def.claims.every((c) => this.state.verdicts[c.id]?.verdict); }

  /* ---------------- label ---------------- */
  setLabel(text) { this.state.label = String(text).slice(0, 2000); }
  setSelfCheck(criterionId, level) { this.state.selfCheck[criterionId] = level; }

  /* ---------------- scoring (main case) ---------------- */
  /**
   * Evidence is "linked correctly" for a claim when at least one KEY evidence
   * item from the expert map is pinned with the expert relation (for
   * can't-tell claims the expert relation is "unclear"), and no key item is
   * pinned with the opposite relation.
   */
  evidenceLinked(claimId) {
    const map = this.def.expertMap[claimId];
    const pins = this.pinsFor(claimId);
    const expected = (id) => (map.supports?.includes(id) ? 'supports' : map.contradicts?.includes(id) ? 'contradicts' : map.unclear?.includes(id) ? 'unclear' : null);
    let good = false; let conflict = false;
    for (const id of map.key) {
      const rel = pins[id];
      if (!rel) continue;
      if (rel === expected(id)) good = true;
      else if ((rel === 'supports' && expected(id) === 'contradicts') || (rel === 'contradicts' && expected(id) === 'supports')) conflict = true;
    }
    return good && !conflict;
  }

  score() {
    const perClaim = this.def.claims.map((c) => {
      const v = this.state.verdicts[c.id];
      const correct = Boolean(v && v.verdict === c.verdict);
      return { claimId: c.id, chosen: v?.verdict || null, expected: c.verdict, correct, confidence: v?.confidence || null, linked: this.evidenceLinked(c.id), expert: c.expert };
    });
    const n = perClaim.length;
    const verdictCorrect = perClaim.filter((r) => r.correct).length;
    const linked = perClaim.filter((r) => r.linked).length;
    const cal = calibration(perClaim.filter((r) => r.confidence).map((r) => ({ p: CONFIDENCE[r.confidence - 1].p, correct: r.correct })));
    const overconfident = perClaim.filter((r) => !r.correct && r.confidence >= 3).map((r) => r.claimId);
    const underconfident = perClaim.filter((r) => r.correct && r.confidence === 1).map((r) => r.claimId);
    return { perClaim, verdictCorrect, linked, total: n, calibration: cal, overconfident, underconfident, classification: this.classificationScore() };
  }

  /** Can every claim be resolved from evidence the case actually offers? (solvability check) */
  static solvability(caseDef) {
    const problems = [];
    const ids = new Set([...caseDef.findings.map((f) => f.id), ...caseDef.archive.map((d) => d.id)]);
    for (const c of caseDef.claims) {
      const m = caseDef.expertMap[c.id];
      if (!m) { problems.push(`${c.id}: no expert map`); continue; }
      if (!m.key?.length) problems.push(`${c.id}: no key evidence`);
      for (const id of [...(m.key || []), ...(m.supports || []), ...(m.contradicts || []), ...(m.unclear || [])]) {
        if (!ids.has(id)) problems.push(`${c.id}: evidence ${id} does not exist`);
      }
      for (const id of m.key || []) {
        const f = caseDef.findings.find((x) => x.id === id);
        if (f && !f.hotspot) problems.push(`${c.id}: finding ${id} has no hotspot (not discoverable)`);
      }
      if (c.verdict === 'cant-tell' && !(m.unclear || []).length) problems.push(`${c.id}: can't-tell claim needs "unclear" evidence`);
      if (c.verdict === 'confirmed' && !(m.supports || []).length) problems.push(`${c.id}: confirmed claim needs supporting evidence`);
      if (c.verdict === 'refuted' && !(m.contradicts || []).length) problems.push(`${c.id}: refuted claim needs contradicting evidence`);
    }
    for (const f of caseDef.findings) {
      if (!f.statements?.some((s) => s.kind === 'observation') || !f.statements?.some((s) => s.kind === 'inference')) problems.push(`${f.id}: needs one observation and one inference statement`);
    }
    return { ok: problems.length === 0, problems };
  }

  toJSON() { return this.state; }
}

/**
 * Calibration summary: Brier score (0 = perfect) and mean confidence vs. accuracy.
 * @param {{p:number, correct:boolean}[]} rows
 */
export function calibration(rows) {
  if (!rows.length) return { brier: null, meanConfidence: null, accuracy: null, gap: null, summary: 'No confidence ratings yet.' };
  const brier = rows.reduce((s, r) => s + (r.p - (r.correct ? 1 : 0)) ** 2, 0) / rows.length;
  const meanConfidence = rows.reduce((s, r) => s + r.p, 0) / rows.length;
  const accuracy = rows.filter((r) => r.correct).length / rows.length;
  const gap = meanConfidence - accuracy;
  let summary;
  if (Math.abs(gap) <= 0.1) summary = 'Well calibrated: your confidence matched how often you were right.';
  else if (gap > 0) summary = 'Overconfident: on average you were more sure than your accuracy justified.';
  else summary = 'Underconfident: you were right more often than you expected. Trust well-supported evidence.';
  return { brier: +brier.toFixed(3), meanConfidence: +meanConfidence.toFixed(2), accuracy: +accuracy.toFixed(2), gap: +gap.toFixed(2), summary };
}
