// Every Now card, rendered as the shell renders it (tool controls included),
// at every step and phase a learner reaches, fresh and done: at most 60 words
// and an action or a question in each (plan 10 §2.1; template-changes T-23:
// ui-audit measures only the states it opens). Also checks that every
// "Open …" button names the drawer it opens (T-18).
import { describe, it, expect, afterAll } from 'vitest';
import { Lessons } from '../../src/od/lessons.js';
import { nowCardIssues } from '../../src/v3/shell.js';
import { STEPS } from '../../src/ui/case-view.js';
import records from '../../content/records.json';
import items from '../../content/items.json';
import rubric from '../../content/rubric.json';
import photos from '../../content/photos.json';
import descriptions from '../../content/text-mode/descriptions.json';
import cinematics from '../../content/cinematics.json';
import tutorial from '../../content/cases/tutorial.json';
import main from '../../content/cases/main.json';

/** A minimal DOM node: enough for the lesson tools to build their controls; text() reads what a learner would see. */
class FakeNode {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.textContent = ''; this.style = {}; this.dataset = {}; this.attributes = {}; this.hidden = false; this.className = ''; this.disabled = false; }
  append(...k) { for (const c of k) this.children.push(typeof c === 'string' ? new FakeText(c) : c); }
  appendChild(c) { this.append(c); return c; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener() {}
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  get classList() { return { add() {}, remove() {}, toggle() {}, contains: () => false }; }
  text() { return this.hidden ? '' : [this.textContent, ...(this.tagName === 'INPUT' ? [] : this.children.map((c) => c.text?.() ?? ''))].filter(Boolean).join(' '); }
}
class FakeText extends FakeNode { constructor(s) { super('#text'); this.textContent = s; } text() { return this.textContent; } }

const cardText = (n, toolBox) => [n.step ? `Step ${n.step} of ${n.total}` : n.kicker, n.goal, n.action, n.result, n.question?.prompt,
  ...(n.question?.choices || []).map((c) => c.text), toolBox?.text(), n.hint, n.primary?.label, n.secondary?.label, n.readMore?.label].filter(Boolean).join(' ');

describe('every Now card: at most 60 words and an action (T-23)', () => {
  // The cards render while the suite is collected, so the fake DOM goes in first.
  const saved = { document: globalThis.document, Node: globalThis.Node };
  globalThis.Node = FakeNode;
  globalThis.document = { createElement: (t) => new FakeNode(t), createElementNS: (_, t) => new FakeNode(t), createTextNode: (s) => new FakeText(s), activeElement: null };
  afterAll(() => { globalThis.document = saved.document; globalThis.Node = saved.Node; });

  const L = new Lessons({ slug: 'unit-now', content: { records, cases: { tutorial, main }, items, rubric, photos, descriptions, cinematics } });
  const app = { record: { log() {} }, shell: { now: { querySelector: () => null }, openDrawer() {}, closeDrawer() {}, setModuleDone() {} }, module: 0, goModule() {}, completeModule() {} };
  L.app = app;
  // The inspection stage as the tools read it (lens and light off, or both on with the light sliders).
  const stage = { magnifier: { on: false, zoom: 4 }, rake: { on: false, state: { elevation: 15, azimuth: 90 } }, pose: 'upright', trueSize: false, compareId: null };
  L.stage = stage;
  const cards = [];
  const render = (label, n) => {
    let box = null;
    if (n.tool) { box = new FakeNode('div'); n.tool(box, app.shell); }
    cards.push({ label, n, text: cardText(n, box) });
  };

  for (const pass of ['fresh', 'done']) {
    // Module 1: the welcome, each warm-up question, the last step.
    for (let i = 0; i < items.preCheck.items.length + 2; i++) { L.step.welcome = i; render(`${pass} welcome ${i}`, L.welcomeNow()); }
    // Modules 2 and 3: every case step; in Inspect every spot, found or not, and each statement.
    for (const [caseId, def] of Object.entries({ tutorial, main })) {
      L.caseId = caseId;
      const eng = L.cases[caseId].engine;
      if (pass === 'done') {
        L.save.briefRead = { tutorial: true, main: true };
        for (const d of def.archive) eng.openDoc(d.id);
        for (const c of def.claims) { eng.setVerdict(c.id, c.verdict); eng.setConfidence(c.id, 3); }
        eng.setLabel(def.label.exemplar);
      }
      for (const [k, [stepId]] of STEPS.entries()) {
        L.step[caseId] = k;
        if (stepId !== 'inspect') { render(`${pass} ${caseId} ${stepId}`, L.caseNow(caseId)); continue; }
        for (const objId of def.objects) {
          L.ins = { objectId: objId, findingId: null, phase: 'choose', stmt: 0, msg: '' };
          render(`${pass} ${caseId} inspect ${objId}`, L.caseNow(caseId));
          for (const f of def.findings.filter((x) => x.objectId === objId)) {
            L.ins = { objectId: objId, findingId: f.id, phase: 'choose', stmt: 0, msg: '' };
            if (pass === 'done') eng.discover(f.id, f.tool);
            render(`${pass} ${caseId} spot ${f.id}`, L.caseNow(caseId));
            Object.assign(stage, { compareId: def.objects.find((o) => o !== objId) || null, trueSize: true });
            stage.magnifier.on = true; stage.rake.on = true;
            render(`${pass} ${caseId} spot ${f.id} lens and light on`, L.caseNow(caseId));
            // Each status line a tool can leave on this card (the longest a learner can see).
            const rec = records.objects.find((o) => o.id === objId);
            const msgs = [
              `Longest side: ${(Math.max(...rec.dimensionsCm)).toFixed(1)} cm (${(Math.max(...rec.dimensionsCm) / 2.54).toFixed(2)} in).`,
              'Between your points: 12.3 cm (4.84 in).',
              'First point placed. Click a second point.',
              'Two points: click a first point on the object.',
              "This scan's scale is not verified. Use the record's sizes.",
              "No true size: this scan's scale is not verified.",
              'True size: ruler, quarter and card beside it.',
              'True scale, side by side: Galvanometer and Battery.',
              'Nothing new. Try the lens, a low light or measuring.',
              'Nothing new yet. Hint: this spot needs the magnifier.',
              ...['magnify', 'raking'].map((t) => L.whyNotRevealed(objId, f.hotspot, t) || ''),
            ];
            stage.magnifier.on = true; stage.rake.on = true;
            for (const msg of msgs) { L.ins.msg = msg; render(`${pass} ${caseId} spot ${f.id} with "${msg.slice(0, 30)}…"`, L.caseNow(caseId)); }
            L.ins.msg = '';
            Object.assign(stage, { compareId: null, trueSize: false });
            stage.magnifier.on = false; stage.rake.on = false;
            for (let s = 0; s < f.statements.length; s++) {
              L.ins = { objectId: objId, findingId: f.id, phase: 'classify', stmt: s, msg: '' };
              render(`${pass} ${caseId} spot ${f.id} statement ${s + 1}`, L.caseNow(caseId));
            }
          }
        }
      }
    }
    // Module 4: the card, each question, the label sentence (before and after checking).
    const t = items.transfer;
    const qs = t.statements.length + t.claims.length;
    if (pass === 'done') {
      L.save.transferCardRead = true;
      for (const s of t.statements) L.save.transfer.cls[s.id] = s.kind;
      for (const c of t.claims) L.save.transfer.verdicts[c.id] = c.verdict;
      L.save.transfer.checked = { right: qs, total: qs };
    }
    for (let i = 0; i < qs + 2; i++) { L.transferQ = i; render(`${pass} transfer ${i}`, L.transferNow()); }
    render(`${pass} wrap-up`, L.wrapNow());
  }

  it('renders every card, tool controls included', () => {
    expect(cards.length).toBeGreaterThan(80);
    expect(cards.some((c) => c.text.includes('True size') && c.text.includes('Height'))).toBe(true);
    if (process.env.NOW_DEBUG) console.log(Math.max(...cards.map((c) => nowCardIssues(c.text, c.n).words)));
  });
  it('each card has at most 60 words and an action or a question', () => {
    const bad = cards.map((c) => ({ c, r: nowCardIssues(c.text, c.n) })).filter(({ r }) => r.issues.length).map(({ c, r }) => `${c.label}: ${r.issues.join('; ')} — "${c.text}"`);
    expect(bad).toEqual([]);
  });
});
