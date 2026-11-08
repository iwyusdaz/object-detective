/**
 * lessons.js — the five modules of The Object Detective in the v3 scene-first
 * shell (plan 10 §2, §6.2).
 *
 *   1 Welcome      the brief and four warm-up questions, one at a time
 *   2 Case 1       the tutorial: one object (Morse-Vail key), hints on
 *   3 Case 2       the assessed case: four objects, no tool hints
 *   4 On your own  the transfer task (galvanometer), no hints
 *   5 Wrap-up      the shift report
 *
 * Each case runs Brief → Inspect → Archive → Evidence board → Label → Debrief
 * as Now-card steps. The Now card holds only the goal, one action, compact
 * tools and one primary button (<= 60 words, tests/unit/now-cards.test.js).
 * Reading and writing (the draft card, the records drawer, the evidence board,
 * the label writer, the debrief) open in the drawer, rendered by the v2 case
 * views, so the decisions and their wording are the same as in v2 and in text
 * mode. One CaseEngine per case serves the scene, the drawer and text mode
 * (parity). Progress is saved under the v2 key, so v2 saves carry over.
 * @module od/lessons
 */
import { CaseEngine, VERDICTS } from '../systems/case-engine.js';
import { CaseView, STEPS, TOOL_NAMES } from '../ui/case-view.js';
import { renderBoard, renderLabel, renderDebrief } from '../ui/case-board.js';
import { renderWelcome, renderTransfer, renderWrapUp } from '../ui/chapters.js';
import { h, clear, feedback } from '../ui/dom.js';
import { announce } from '../a11y/announcer.js';
import { sizeStatement } from '../systems/true-size-view.js';
import { RAKING_REVEAL_MAX_ELEVATION } from '../systems/raking-light.js';
import { STAGE_POS, VITRINES } from './museum.js';

const BASE = import.meta.env?.BASE_URL || './';
export const SHORT = {
  'morse-vail-key': 'Key', 'davenport-motor': 'Motor', 'henry-trough-battery': 'Battery',
  'chester-relay': 'Relay', 'page-induction-coil': 'Coil', 'tangent-galvanometer': 'Galvanometer',
};
const LONG = {
  'morse-vail-key': 'telegraph key', 'davenport-motor': 'Davenport motor', 'henry-trough-battery': 'trough battery',
  'chester-relay': 'relay', 'page-induction-coil': 'induction coil', 'tangent-galvanometer': 'galvanometer',
};
/** Tutorial hint per tool: the one action that reveals a finding. */
export const TOOL_ACTIONS = {
  view: 'Look at the whole object. Then press Record what I see.',
  magnify: 'Put the lens on the mark. Then press Record what I see.',
  raking: `Press Light and set it to ${RAKING_REVEAL_MAX_ELEVATION}° or lower. Then press Record what I see.`,
  measure: 'Press Measure. Then press Record what I see.',
};
const STEP_GOALS = { brief: 'Read the draft card', inspect: 'Examine the object', archive: 'Source the records', board: 'Weigh the evidence', label: 'Write the label', debrief: 'Read the debrief' };
const DRAWERS = { brief: 'Draft card', archive: 'Records drawer', board: 'Evidence board', label: 'Label writer', debrief: 'Debrief' };

/** Preset measurement across the object's longest side (normalized local-box points). */
export function longestPreset(size) {
  const axes = [size.x, size.y, size.z];
  const i = axes.indexOf(Math.max(...axes));
  const a = [0.5, 0.12, 0.5]; const b = [0.5, 0.12, 0.5];
  a[i] = 0; b[i] = 1;
  if (i === 1) { a[0] = b[0] = 0.5; }
  return { id: 'longest', label: 'Longest side', a, b };
}

const btn = (label, onClick, { cls = 'v3-btn', pressed = null, aria = null, disabled = false, data = null } = {}) => {
  const b = h('button', { type: 'button', class: cls, onclick: onClick });
  b.textContent = label;
  if (pressed !== null) b.setAttribute('aria-pressed', String(Boolean(pressed)));
  if (aria) b.setAttribute('aria-label', aria);
  if (disabled) b.disabled = true;
  if (data) Object.assign(b.dataset, data);
  return b;
};

export class Lessons {
  /**
   * @param {{ slug: string, content: object }} o
   *   content: records, cases {tutorial, main}, items, rubric, photos, descriptions, cinematics
   */
  constructor({ slug, content }) {
    this.slug = slug;
    this.c = content;
    this.records = Object.fromEntries(content.records.objects.map((o) => [o.id, o]));
    this.SAVE_KEY = `${slug}:save`;
    this.save = this._load();
    this.cases = {};
    for (const [id, def] of Object.entries(content.cases)) this.cases[id] = { def, engine: new CaseEngine(def, this.save.cases[id]) };
    this.step = { ...(this.save.steps || {}) }; // module id -> step index
    this.ins = { objectId: null, findingId: null, phase: 'choose', stmt: 0, msg: '' };
    this.transferQ = this.save.transferQ || 0;
    this.app = null;
  }

  _load() {
    const blank = { chapter: 0, cases: {}, pre: {}, transfer: { cls: {}, verdicts: {}, label: '' }, s1Seen: false, steps: {} };
    try { return { ...blank, ...JSON.parse(localStorage.getItem(`${this.slug}:save`) || '{}') }; } catch { return blank; }
  }

  persist() {
    for (const [id, c] of Object.entries(this.cases)) this.save.cases[id] = c.engine.toJSON();
    this.save.steps = this.step;
    this.save.transferQ = this.transferQ;
    try { localStorage.setItem(this.SAVE_KEY, JSON.stringify(this.save)); } catch { /* private mode */ }
  }

  bind(app, { museum, stage }) {
    this.app = app;
    this.museum = museum;
    this.stage = stage;
    if (!stage) return;
    stage.measure.onMeasured = (m) => {
      this.ins.msg = `${m.method === 'preset' ? 'Longest side' : 'Between your points'}: ${m.text}.`;
      announce(this.ins.msg);
      app.record.log('experienced', { id: `measure-${m.objectId}`, name: 'Measurement' }, { response: m.text });
      this.refresh();
    };
    stage.magnifier.onHiRes = (ok) => { if (ok) announce('Sharper 4096-pixel scan loaded for the lens.'); stage.lensToHotspot(); };
    // Lens follows the mouse; a tap places it on touch. Two-point measuring takes clicks on the object.
    const canvas = app.shell.canvas;
    canvas.addEventListener('pointermove', (e) => {
      if (!stage.magnifier.on || e.pointerType !== 'mouse') return;
      stage.lensFollow = false;
      const r = canvas.getBoundingClientRect();
      stage.magnifier.moveTo((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
    app.rig.on('tap', (x, y, type) => {
      const r = canvas.getBoundingClientRect();
      if (stage.magnifier.on && type !== 'mouse') stage.lensFollow = false;
      if (stage.magnifier.on && type !== 'mouse') stage.magnifier.moveTo((x - r.left) / r.width, (y - r.top) / r.height);
      if (this.pointMeasure) {
        const hit = stage.measure.pick(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
        if (!hit && stage.measure.points.length === 1) { this.ins.msg = 'First point placed. Click a second point.'; this.refresh(); }
      }
    });
  }

  // ---------------------------------------------------------------- v2 adapter (text mode, drawers)
  /** The v2 chapter renderers expect the v2 App; this adapter gives them the same fields. */
  get v2() {
    const L = this;
    return this._v2 ||= {
      get items() { return L.c.items; },
      get objects() { return L.records; },
      get descriptions() { return L.c.descriptions; },
      get photos() { return L.c.photos; },
      get save() { return L.save; },
      get cases() { return L.cases; },
      get record() { return L.app.record; },
      asset: (p) => `${BASE}${String(p).replace(/^\/+/, '')}`,
      persist: () => L.persist(),
      startTutorial: () => L.app.completeModule(0),
      gotoChapter: (i) => { if (i === 4) L.app.completeModule(3); else L.app.goModule(i); },
      progressPage: { open: (b) => L.app.shell._emit('action:progress', b) },
      backToStart: () => L.app.backToStart(),
    };
  }

  _hooks(caseId, { text = false } = {}) {
    const L = this;
    const modIndex = caseId === 'tutorial' ? 1 : 2;
    return {
      isTextMode: () => text,
      asset: (p) => L.v2.asset(p),
      save: () => L.persist(),
      log: (verb, obj, result) => L.app.record.log(verb, obj, result),
      announce: (m) => announce(m),
      showObject: () => {},
      gotoHotspot: () => {},
      activeTools: (id, hs) => L.activeFor(id, hs),
      whyNotRevealed: (id, hs, tool) => L.whyNotRevealed(id, hs, tool),
      onSubmitted: () => { L._boardSync(); },
      canPlayReveal: () => caseId === 'main' && !text && Boolean(L.app.player),
      playReveal: () => L.playReveal(),
      nextChapter: () => L.app.completeModule(modIndex),
      restartCase: () => {
        L.cases[caseId].engine = new CaseEngine(L.cases[caseId].def);
        L.step[caseId] = 0;
        L.persist();
        L.app.shell.closeDrawer();
        L.app.goModule(modIndex);
      },
    };
  }

  /** A case view whose step changes move the lesson (drawer flow); same renderers as text mode. */
  _drawerView(caseId) {
    const L = this;
    const { def, engine } = this.cases[caseId];
    const view = new CaseView({ panel: document.createElement('div'), def, engine, objects: this.records, photos: this.c.photos, descriptions: this.c.descriptions, rubric: this.c.rubric, hooks: this._hooks(caseId) });
    view.go = (step) => L._caseGo(caseId, step);
    view.next = (step) => h('p', { class: 'next-row' }, h('button', { type: 'button', class: 'v3-btn v3-primary', onclick: () => view.go(step) }, `Next: ${STEPS.find(([id]) => id === step)[1]}`));
    return view;
  }

  // ---------------------------------------------------------------- module definitions
  modules() {
    const L = this;
    const mk = (i, id, label, { view, calm = false, enter, now, text, back }) => ({
      id, label, calm, back,
      get view() { return view(); },
      enter: () => { L.mod = i; enter?.(); },
      now: () => now(),
      text: (el) => text(el),
    });
    const galleryView = () => ({ target: [0, 1.25, -3.2], radius: 6.2, theta: 0.32, phi: 1.33 });
    const tableView = () => ({ target: [STAGE_POS.x - 0.12, STAGE_POS.y + 0.08, STAGE_POS.z], radius: 0.75, theta: 0, phi: 1.2 });
    return [
      mk(0, 'welcome', 'Welcome', { view: galleryView, enter: () => L._enterGallery(), now: () => L.welcomeNow(), text: (el) => renderWelcome(L.v2, L._tmPanel(el)) }),
      mk(1, 'case-tutorial', 'Case 1: the key', { view: tableView, calm: true, enter: () => L._enterCase('tutorial'), now: () => L.caseNow('tutorial'), back: () => L._caseBack('tutorial'), text: (el) => L._caseText('tutorial', el) }),
      mk(2, 'case-main', 'Case 2: the label', { view: tableView, calm: true, enter: () => L._enterCase('main'), now: () => L.caseNow('main'), back: () => L._caseBack('main'), text: (el) => L._caseText('main', el) }),
      mk(3, 'transfer', 'On your own', { view: tableView, calm: true, enter: () => L._enterTransfer(), now: () => L.transferNow(), text: (el) => renderTransfer(L.v2, L._tmPanel(el)) }),
      mk(4, 'wrap-up', 'Wrap-up', { view: () => ({ target: [0, 1.3, -2.8], radius: 7.4, theta: -0.45, phi: 1.32 }), enter: () => L._enterGallery(), now: () => L.wrapNow(), text: (el) => renderWrapUp(L.v2, L._tmPanel(el)) }),
    ];
  }

  _tmPanel(el) { const d = h('div', { class: 'od-tm-panel' }); el.append(d); return d; }

  _caseText(caseId, el) {
    const { def, engine } = this.cases[caseId];
    const panel = this._tmPanel(el);
    const view = new CaseView({ panel, def, engine, objects: this.records, photos: this.c.photos, descriptions: this.c.descriptions, rubric: this.c.rubric, hooks: this._hooks(caseId, { text: true }) });
    const idx = this.step[caseId] || 0;
    view.render(engine.state.submitted ? 'debrief' : (STEPS[Math.min(idx, STEPS.length - 1)]?.[0] || 'brief'));
  }

  refresh() {
    const a = this.app;
    if (!a || a.module < 0 || a.onboarding?.active) return;
    // Re-rendering the card must not drop keyboard focus: put it back on the same control.
    const f = document.activeElement;
    const inCard = f && a.shell.now.contains(f);
    const key = inCard ? (f.getAttribute('aria-label') || f.dataset.action || f.textContent.trim()) : null;
    const choice = inCard ? f.dataset.choice : null;
    a.shell.setNow(a.modules[a.module].now(a));
    if (inCard) {
      const all = [...a.shell.now.querySelectorAll('button, input, a[href]')];
      const same = all.find((el) => (choice && el.dataset.choice === choice) || (el.getAttribute('aria-label') || el.dataset.action || el.textContent.trim()) === key)
        || a.shell.now.querySelector('[data-action="now-primary"]') || all[0];
      same?.focus({ preventScroll: true });
    }
    this.persist();
  }

  // ---------------------------------------------------------------- scene staging
  _enterGallery() {
    const s = this.stage;
    if (!s) return;
    this.pointMeasure = false;
    s.clear();
    this.museum.setMode('gallery');
    this.app.inspect?.setEnabled(true);
  }

  async _enterCase(caseId) {
    const { def } = this.cases[caseId];
    this.caseId = caseId;
    if (!this.step[caseId]) this.step[caseId] = 0;
    const objs = def.objects;
    if (!objs.includes(this.ins.objectId)) this.ins = { objectId: objs[0], findingId: null, phase: 'choose', stmt: 0, msg: '' };
    this._boardSync();
    if (!this.stage) return;
    this.museum.setMode('inspect');
    await this.stage.show(this.ins.objectId);
    this._tagsSync();
    this.stage.frameAll(0, 14, 1.2);
  }

  async _enterTransfer() {
    if (!this.stage) return;
    this.caseId = null;
    this.museum.setMode('inspect');
    await this.stage.show(this.c.items.transfer.objectId);
    this.stage.frameAll(0, 18, 1.2);
  }

  _tagsSync() {
    if (!this.stage || !this.caseId) return;
    const def = this.cases[this.caseId].def;
    const step = STEPS[this.step[this.caseId] || 0][0];
    if (step !== 'inspect') { this.stage.setTags([]); return; }
    const list = def.findings.filter((f) => f.objectId === this.ins.objectId).map((f, i) => ({ id: f.id, objectId: f.objectId, hs: f.hotspot, n: i + 1 }));
    this.stage.setTags(list);
  }

  _boardSync() {
    if (!this.museum || !this.caseId) { this.museum?.setBoardCards([]); return; }
    const ev = this.cases[this.caseId].engine.availableEvidence();
    this.museum.setBoardCards(ev.map((e) => ({ kind: e.type === 'finding' ? 'OBSERVATION' : e.type === 'record' ? 'RECORD' : 'FICTIONAL', title: e.title.replace(/^Smithsonian record: /, '').slice(0, 48) })));
  }

  // ---------------------------------------------------------------- tools (3D)
  scaleOk(id = this.stage?.primary?.id) { return Boolean(this.records[id]?.scaleVerified); }

  /**
   * Tools whose use counts for discovering a finding now (v2 rule, agent review
   * H2): the lens must cover the mark; raking light must be low with the object
   * in the hotspot's pose and side; measuring counts once this object is measured.
   */
  activeFor(objectId, hs = null) {
    const s = new Set(['view']);
    const st = this.stage;
    if (!st) return s;
    const posed = !hs || (st.primary?.id === objectId && st.viewMatches(hs));
    if (st.magnifier.on && (!hs || (posed && st.magnifier.covers(st.hotspotScreen(objectId, hs))))) s.add('magnify');
    if (st.rake.revealing && posed) s.add('raking');
    if (st.measure.last && st.measure.last.objectId === objectId) s.add('measure');
    return s;
  }

  whyNotRevealed(objectId, hs, tool) {
    const st = this.stage;
    if (!st) return null;
    if (tool === 'magnify' && st.magnifier.on) return 'Move the lens onto the mark.';
    if (tool === 'raking' && st.rake.on && !st.rake.revealing) return `Too high: set the light to ${RAKING_REVEAL_MAX_ELEVATION}° or lower.`;
    if (tool === 'raking' && st.rake.revealing) return 'The light is low, but on another side. Press the spot number again.';
    return null;
  }

  async chooseObject(id) {
    this.ins = { objectId: id, findingId: null, phase: 'choose', stmt: 0, msg: '' };
    this.pointMeasure = false;
    if (this.stage) {
      if (this.stage.magnifier.on) this.stage.magnifier.setEnabled(false);
      await this.stage.show(id);
      this.stage.frameAll(0, 14);
      this._tagsSync();
    }
    announce(`On the table: ${this.records[id].title}.`);
    this.refresh();
  }

  async chooseSpot(findingId) {
    const f = this.cases[this.caseId].def.findings.find((x) => x.id === findingId);
    this.ins.findingId = findingId;
    this.ins.phase = 'choose';
    this.ins.msg = '';
    this.pointMeasure = false;
    this.refresh();
    if (this.stage) {
      await this.stage.gotoHotspot(f.objectId, f.hotspot);
      this._tagsSync();
    }
    announce(`Camera moved to: ${f.hotspot.label}`);
  }

  toggle(tool) {
    const st = this.stage;
    if (!st) return;
    if (tool === 'lens') {
      st.magnifier.setEnabled(!st.magnifier.on);
      if (st.magnifier.on) st.lensToHotspot();
      this.app.inspect.setEnabled(!st.magnifier.on && !this.pointMeasure);
      announce(st.magnifier.on ? `Lens on, ${st.magnifier.zoom} times. Move the mouse to move it, or tap where to look.` : 'Lens off.');
    } else if (tool === 'light') {
      st.rake.setEnabled(!st.rake.on);
      announce(st.rake.describe());
    } else if (tool === 'measure') {
      const slot = st.primary;
      if (!slot) return;
      if (!this.scaleOk(slot.id)) { this.ins.msg = "This scan's scale is not verified. Use the record's sizes."; announce(this.ins.msg); }
      else st.measure.preset(slot.id, longestPreset(st.localSize(slot.id)));
    } else if (tool === 'points') {
      this.pointMeasure = !this.pointMeasure;
      st.measure.clear();
      this.app.inspect.setEnabled(!this.pointMeasure && !st.magnifier.on);
      this.ins.msg = this.pointMeasure ? 'Two points: click a first point on the object.' : '';
      announce(this.pointMeasure ? this.ins.msg : 'Two-point measuring off.');
    } else if (tool === 'flip') {
      const pose = st.flip();
      announce(pose === 'flipped' ? 'Object turned over: you see the underside.' : 'Object turned upright.');
      st.frameAll(0, pose === 'flipped' ? 60 : 14, 0.8);
    } else if (tool === 'size') {
      if (!this.scaleOk()) { this.ins.msg = "No true size: this scan's scale is not verified."; announce(this.ins.msg); }
      else {
        const on = st.setTrueSize(!st.trueSize);
        const obj = this.records[st.primary.id];
        this.ins.msg = on ? 'True size: ruler, quarter and card beside it.' : '';
        announce(on ? `True-size view. ${sizeStatement(obj)}` : 'True-size view off.');
        if (!on) st.frameAll(0, 14);
      }
    } else if (tool === 'zoom') {
      announce(`Lens ${st.magnifier.cycleZoom(1)} times`);
    }
    this.refresh();
  }

  async compareNext() {
    const st = this.stage;
    const primary = st?.primary?.id;
    if (!primary || !this.scaleOk(primary)) return;
    const opts = this.cases[this.caseId].def.objects.filter((id) => id !== primary && this.scaleOk(id));
    const i = opts.indexOf(st.compareId);
    const next = i + 1 < opts.length ? opts[i + 1] : null;
    await st.setCompare(next);
    if (next) this.app.record.log('experienced', { id: `compare-${primary}-${next}`, name: 'Side-by-side compare' });
    this.ins.msg = next ? `True scale, side by side: ${SHORT[primary]} and ${SHORT[next]}.` : '';
    announce(next ? `Comparing ${this.records[primary].title} with ${this.records[next].title}.` : 'Comparison off.');
    this._tagsSync();
    this.refresh();
  }

  /** Record what the learner sees at the current spot (v2 rule: the tool must reveal it now). */
  recordFinding() {
    const { engine, def } = this.cases[this.caseId];
    const f = def.findings.find((x) => x.id === this.ins.findingId);
    if (!f) return;
    const tryTool = (tool, why = null) => {
      const r = engine.discover(f.id, tool);
      if (r.ok) {
        this.app.record.log('experienced', { id: `finding-${f.id}`, name: f.hotspot.label }, { response: tool });
        announce('Finding recorded in your observation log.');
        this.ins.phase = 'classify';
        this.ins.stmt = 0;
        this.ins.msg = '';
        this._boardSync();
        this.persist();
      } else {
        this.ins.msg = why || (def.assessed ? 'Nothing new. Try the lens, a low light or measuring.' : `Nothing new yet. Hint: this spot needs ${TOOL_NAMES[f.tool]}.`);
        announce(this.ins.msg);
      }
      this.refresh();
    };
    const active = this.activeFor(f.objectId, f.hotspot);
    if (active.has(f.tool)) { tryTool(f.tool); return; }
    tryTool([...active].find((t) => t !== 'view') || 'view', this.whyNotRevealed(f.objectId, f.hotspot, f.tool));
  }

  // ---------------------------------------------------------------- case flow
  _caseGo(caseId, step) {
    const i = STEPS.findIndex(([id]) => id === step);
    if (i < 0) return;
    this.step[caseId] = i;
    this.persist();
    const shell = this.app.shell;
    if (['board', 'label', 'debrief'].includes(step)) this.openCaseDrawer(caseId, step);
    else shell.closeDrawer();
    this._tagsSync();
    this.refresh();
  }

  /** Back inside a case (top-bar Back): the previous case step; false at the first step or once submitted. */
  _caseBack(caseId) {
    const i = this.step[caseId] || 0;
    if (i <= 0 || this.cases[caseId].engine.state.submitted) return false;
    this._caseGo(caseId, STEPS[i - 1][0]);
    return true;
  }

  openCaseDrawer(caseId, step, trigger = null) {
    const view = this._drawerView(caseId);
    const render = {
      brief: (b) => view.renderBrief(b),
      archive: (b) => view.renderArchive(b),
      board: (b) => renderBoard(view, b),
      label: (b) => renderLabel(view, b),
      debrief: (b) => renderDebrief(view, b),
      log: (b) => this._renderLog(caseId, b),
      tools: (b) => this._renderToolsHelp(b),
    }[step];
    const title = step === 'log' ? 'Observation log' : step === 'tools' ? 'Inspection tools' : DRAWERS[step];
    this.app.shell.openDrawer({
      title, key: `case-${step}`, trigger,
      render: (b) => { render(b); this._afterDrawerRender(caseId, step, b); },
      onClose: () => { if (step === 'brief') { this.save.briefRead = { ...(this.save.briefRead || {}), [caseId]: true }; } this._boardSync(); this.refresh(); },
    });
  }

  /** Drawer details: data labels on tables (stacked rows) and the evidence board refreshing the room's cork board. */
  _afterDrawerRender(caseId, step, body) {
    for (const t of body.querySelectorAll('table')) {
      const heads = [...t.querySelectorAll('thead th')].map((x) => x.textContent);
      for (const tr of t.querySelectorAll('tbody tr')) [...tr.children].forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; });
    }
    body.addEventListener('change', () => { this._boardSync(); this.persist(); });
    body.addEventListener('toggle', () => this._boardSync(), true);
    void caseId; void step;
  }

  _renderLog(caseId, body) {
    const { def, engine } = this.cases[caseId];
    const found = def.findings.filter((f) => engine.isDiscovered(f.id));
    body.append(h('p', {}, `You have recorded ${found.length} of ${def.findings.length} findings in this case.`));
    for (const f of found) {
      const img = this.c.photos._findings?.[f.id];
      body.append(h('section', { class: 'od-log-item' },
        h('h3', {}, `${SHORT[f.objectId]}: ${f.hotspot.label}`),
        img ? h('img', { src: this.v2.asset(img), alt: `${f.hotspot.label}: ${f.description}`, loading: 'lazy', width: 800, height: 600 }) : null,
        h('p', {}, f.description),
        f.transcription ? h('p', {}, h('strong', {}, 'Transcription: '), f.transcription) : null));
    }
  }

  _renderToolsHelp(body) {
    const rows = [
      ['Spot numbers', 'Move the camera to a point of interest. A numbered tag marks it on the object.'],
      ['Lens', 'A round magnifier. With a mouse it follows the pointer; on touch, tap where to look. Zoom changes 2×, 4× or 8×. The sharper 4096 px scan loads when you need it.'],
      ['Light', 'A raking light from one side. Set its height low (20° or less) so faint marks cast shadows. Turn changes the direction it comes from.'],
      ['Measure', 'Measures the longest side of the scan in centimetres and inches. Two points measures between two clicks on the object.'],
      ['Turn over', 'Turns the object upside down to see its base.'],
      ['True size', 'Puts a ruler, a US quarter and a bank-sized card beside the object.'],
      ['Compare', 'Case 2: puts another object beside this one at true scale. Press again for the next one.'],
      ['Look around', 'Drag to circle the object. Scroll or pinch to zoom. Q/E turn, R/F tilt, + and - zoom.'],
    ];
    body.append(h('dl', { class: 'od-tools' }, ...rows.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))),
      // A control in the drawer also makes its scrolling body reachable by keyboard (axe scrollable-region-focusable).
      h('p', { class: 'next-row' }, h('button', { type: 'button', class: 'v3-btn v3-primary', onclick: () => this.app.shell.closeDrawer() }, 'Back to the object')));
  }

  /** The Now card for a case's current step. */
  caseNow(caseId) {
    const { def, engine } = this.cases[caseId];
    const i = this.step[caseId] || 0;
    const step = STEPS[i][0];
    const total = STEPS.length;
    const base = { step: i + 1, total };
    const next = (label = 'Next step') => ({ label, onClick: () => this._caseGo(caseId, STEPS[Math.min(i + 1, total - 1)][0]) });
    const openBtn = (s, label) => ({ label, onClick: () => this.openCaseDrawer(caseId, s, this.app.shell.now.querySelector('[data-action="now-primary"], [data-action="now-secondary"]')) });
    if (step === 'brief') {
      const read = this.save.briefRead?.[caseId];
      return {
        ...base, goal: STEP_GOALS.brief,
        action: read ? `Press Next step to examine the ${caseId === 'tutorial' ? 'key' : 'four objects'} on the table.` : `Press Open the draft card. Read the ${def.claims.length} claims you will check.`,
        result: read ? 'Draft card read.' : '',
        hint: 'The card is fictional. The objects are real Smithsonian scans.',
        primary: read ? next() : openBtn('brief', 'Open the draft card'),
        secondary: read ? openBtn('brief', 'Open the draft card') : null,
      };
    }
    if (step === 'inspect') return this._inspectNow(caseId, base, next);
    if (step === 'archive') {
      const opened = engine.state.archiveOpened.filter((id) => id !== def.fictionalDocument.id).length;
      const n = def.archive.filter((d) => d.id !== def.fictionalDocument.id).length;
      return {
        ...base, goal: STEP_GOALS.archive,
        action: opened ? 'Press Next step to weigh the evidence, or read more records.' : 'Press Open the records drawer. Open each record and ask who made it, when and why.',
        result: `Records opened: ${opened} of ${n}.`,
        primary: opened ? next() : openBtn('archive', 'Open the records drawer'),
        secondary: opened ? openBtn('archive', 'Open the records drawer') : null,
      };
    }
    if (step === 'board') {
      const set = Object.values(engine.state.verdicts).filter((v) => v.verdict).length;
      return {
        ...base, goal: STEP_GOALS.board,
        action: 'Press Open the evidence board. Pin evidence to each claim, then give a verdict and how sure you are.',
        result: `Verdicts given: ${set} of ${def.claims.length}.`,
        hint: 'Your findings are also pinned on the cork board by the archive door.',
        primary: openBtn('board', 'Open the evidence board'),
      };
    }
    if (step === 'label') {
      return {
        ...base, goal: STEP_GOALS.label,
        action: 'Press Open the label writer. Say what the evidence supports and what we cannot tell yet.',
        result: engine.state.label ? `Draft saved: ${engine.state.label.trim().split(/\s+/).length} words.` : '',
        primary: openBtn('label', 'Open the label writer'),
      };
    }
    // debrief
    const s = engine.score();
    return {
      ...base, goal: STEP_GOALS.debrief,
      action: caseId === 'tutorial' ? 'Press Open the debrief to compare your verdicts with the expert. Then start Case 2.' : 'Press Open the debrief to see your scores. Then go on to the last task.',
      result: def.assessed ? `Verdicts matching the expert: ${s.verdictCorrect} of ${s.total}.` : '',
      primary: openBtn('debrief', 'Open the debrief'),
      secondary: { label: caseId === 'tutorial' ? 'Next: Case 2' : 'Next: on your own', onClick: () => this.app.completeModule(caseId === 'tutorial' ? 1 : 2) },
    };
  }

  _inspectNow(caseId, base, next) {
    const { def, engine } = this.cases[caseId];
    const ins = this.ins;
    const objId = ins.objectId || def.objects[0];
    const spots = def.findings.filter((f) => f.objectId === objId);
    const f = spots.find((x) => x.id === ins.findingId) || null;
    const n = f ? spots.indexOf(f) + 1 : 0;
    // Classification: one statement at a time.
    if (ins.phase === 'classify' && f) {
      const stmt = f.statements[ins.stmt];
      const last = ins.stmt >= f.statements.length - 1;
      return {
        ...base, kicker: `Step ${base.step} of ${base.total} · Spot ${n}`,
        goal: 'Observation or inference?',
        question: {
          prompt: `“${stmt.text}”`,
          choices: [{ id: 'observation', text: 'Observation' }, { id: 'inference', text: 'Inference' }],
          onAnswer: (kind) => {
            const r = engine.classify(f.id, stmt.id, kind);
            this.app.record.log('answered', { id: `classify-${f.id}-${stmt.id}`, name: stmt.text }, { response: kind, success: r.correct });
            this.persist();
            return { correct: r.correct, feedback: `${r.correct ? 'Yes.' : `Not quite: it is an ${r.expected}.`} ${r.why}` };
          },
        },
        primary: { label: last ? 'Back to the spots' : 'Next statement', onClick: () => { if (last) { ins.phase = 'choose'; ins.findingId = null; } else ins.stmt++; this.refresh(); } },
      };
    }
    const st = this.stage;
    const found = f && engine.isDiscovered(f.id);
    const count = engine.state.discovered.length;
    let action;
    if (!f) action = 'Press a spot number. Then use a tool and record what you see.';
    else if (found) action = 'Recorded. Press another spot number, or Next step.';
    else action = def.assessed ? 'Use a tool, then press Record what I see.' : TOOL_ACTIONS[f.tool];
    const tool = (el) => {
      if (def.objects.length > 1) {
        el.append(h('div', { class: 'od-row', role: 'group', 'aria-label': 'Object on the table' }, ...def.objects.map((id) => btn(SHORT[id], () => this.chooseObject(id), { pressed: id === objId, aria: `${this.records[id].title}${id === objId ? ' (on the table)' : ''}` }))));
      }
      el.append(h('div', { class: 'od-row', role: 'group', 'aria-label': 'Spots to examine' }, ...spots.map((s, k) => btn(`${k + 1}${engine.isDiscovered(s.id) ? ' ✓' : ''}`, () => this.chooseSpot(s.id), { cls: 'v3-btn od-spot', pressed: s.id === ins.findingId, aria: `Spot ${k + 1}: ${s.hotspot.label}${engine.isDiscovered(s.id) ? ' (recorded)' : ''}` }))));
      if (!st) return;
      const sc = this.scaleOk(objId);
      el.append(h('div', { class: 'od-row', role: 'group', 'aria-label': 'Tools' },
        btn('Lens', () => this.toggle('lens'), { pressed: st.magnifier.on, aria: 'Lens (magnifier)' }),
        btn('Light', () => this.toggle('light'), { pressed: st.rake.on, aria: 'Raking light' }),
        sc ? btn('Measure', () => this.toggle('measure'), { aria: 'Measure the longest side' }) : null,
        btn('Turn over', () => this.toggle('flip'), { pressed: st.pose === 'flipped' }),
        sc ? btn('True size', () => this.toggle('size'), { pressed: st.trueSize, aria: 'True-size view' }) : null,
        def.objects.length > 1 && sc ? btn('Compare', () => this.compareNext(), { pressed: Boolean(st.compareId), aria: st.compareId ? `Compare: next object (now beside ${SHORT[st.compareId]})` : 'Compare with another object' }) : null,
      ));
      if (st.rake.on) el.append(this._rakeSliders());
      if (st.magnifier.on) el.append(h('div', { class: 'od-row' }, btn(`Zoom ${st.magnifier.zoom}×`, () => this.toggle('zoom'), { aria: `Lens zoom ${st.magnifier.zoom} times; press for the next` })));
    };
    return {
      ...base, goal: f ? f.hotspot.label : `Examine the ${LONG[objId]}`,
      action,
      result: ins.msg || (count ? `Findings recorded: ${count} of ${def.findings.length}.` : ''),
      tool,
      primary: f && !found ? { label: 'Record what I see', onClick: () => this.recordFinding() } : next(),
      secondary: f && !found ? next() : (count ? { label: 'Open the observation log', onClick: () => this.openCaseDrawer(caseId, 'log', this.app.shell.now.querySelector('[data-action="now-secondary"]')) } : null),
      readMore: f ? null : { label: 'Tool help', title: 'Inspection tools', render: (b) => this._renderToolsHelp(b) },
    };
  }

  _rakeSliders() {
    const rake = this.stage.rake;
    const mk = (label, key, min, max, unit) => {
      const out = h('output', {}, `${rake.state[key]}${unit}`);
      const inp = h('input', { type: 'range', min: String(min), max: String(max), step: '1', value: String(rake.state[key]), 'data-arrow-keys': '', 'aria-label': `Light ${label.toLowerCase()}` });
      inp.addEventListener('input', () => { rake.set({ [key]: Number(inp.value) }); out.textContent = `${rake.state[key]}${unit}`; });
      inp.addEventListener('change', () => announce(rake.describe()));
      return h('label', { class: 'od-slider' }, h('span', {}, label), inp, out);
    };
    return h('div', { class: 'od-row od-sliders' }, mk('Height', 'elevation', 2, 60, '°'), mk('Turn', 'azimuth', 0, 359, '°'));
  }

  // ---------------------------------------------------------------- welcome
  welcomeNow() {
    const pre = this.c.items.preCheck.items;
    const i = this.step.welcome || 0;
    const total = pre.length + 2;
    if (i === 0) {
      return {
        step: 1, total, goal: 'Your evening shift',
        action: 'Press Next step to answer four warm-up questions.',
        hint: 'Look around the gallery first if you like: drag to turn, click anything to learn what it is.',
        primary: { label: 'Next step', onClick: () => { this.step.welcome = 1; this.refresh(); } },
        secondary: { label: 'Watch the gallery tour', play: true, onClick: () => this.playTour() },
        readMore: { label: 'Read the brief', title: 'Your brief', render: (b) => this._renderBrief(b) },
      };
    }
    if (i <= pre.length) {
      const item = pre[i - 1];
      return {
        kicker: `Warm-up ${i} of ${pre.length} · not graded`, goal: 'Warm-up question',
        question: {
          prompt: item.prompt,
          choices: item.options.map((o) => ({ id: o.id, text: o.text })),
          onAnswer: (id) => {
            const opt = item.options.find((o) => o.id === id);
            const correct = id === item.correct;
            this.save.pre[item.id] = id;
            this.app.record.log('answered', { id: item.id, name: item.prompt }, { response: id, success: correct });
            this.persist();
            return { correct, feedback: `${correct ? 'Yes.' : 'Not quite.'} ${opt.short || opt.why}` };
          },
        },
        primary: { label: i < pre.length ? 'Next question' : 'Next step', onClick: () => { this.step.welcome = i + 1; this.refresh(); } },
      };
    }
    return {
      step: total, total, goal: 'Ready for Case 1',
      action: 'Press Start Case 1. The first object is waiting for you on the inspection table.',
      hint: 'Case 1 is a tutorial with hints. Case 2 has none.',
      primary: { label: 'Start Case 1', onClick: () => this.app.completeModule(0) },
      secondary: { label: 'Watch the gallery tour', play: true, onClick: () => this.playTour() },
    };
  }

  _renderBrief(b) {
    b.append(
      h('p', {}, 'You are a new evening intern at the Lantern Museum. The museum, its staff and its documents are ', h('strong', {}, 'fictional'), '. The objects are ', h('strong', {}, 'real'), ': 3D scans released by the Smithsonian under CC0, with their real catalog records.'),
      h('p', {}, 'Your job: check museum labels. Look closely, separate what you see from what you think it means, weigh the records, and write a label that says how sure we are.'),
      h('p', {}, 'The six objects of the case stand in the tall glass cases. When you examine one, it moves to the inspection table in the middle of the room.'),
    );
  }

  // ---------------------------------------------------------------- transfer
  transferNow() {
    const t = this.c.items.transfer;
    const st = this.save.transfer;
    const qs = [...t.statements.map((s) => ({ kind: 'cls', s })), ...t.claims.map((c) => ({ kind: 'claim', c }))];
    const i = this.transferQ;
    const total = qs.length + 2;
    if (i === 0) {
      return {
        step: 1, total, goal: 'A new object, no hints',
        action: 'Press Open the visitor card. Read its three claims and the record excerpt.',
        hint: 'You can turn and zoom the galvanometer on the table.',
        primary: this.save.transferCardRead ? { label: 'Next step', onClick: () => { this.transferQ = 1; this.refresh(); } } : { label: 'Open the visitor card', onClick: (e) => this._openTransferCard() },
        secondary: this.save.transferCardRead ? { label: 'Open the visitor card', onClick: () => this._openTransferCard() } : null,
      };
    }
    if (i <= qs.length) {
      const q = qs[i - 1];
      const chosen = q.kind === 'cls' ? st.cls[q.s.id] : st.verdicts[q.c.id];
      const opts = q.kind === 'cls' ? [['observation', 'Observation'], ['inference', 'Inference']] : Object.entries(VERDICTS);
      return {
        step: i + 1, total,
        goal: q.kind === 'cls' ? 'Observation or inference?' : `Claim ${q.c.id.slice(1)}: what is your verdict?`,
        action: q.kind === 'cls' ? 'Choose one. You see the answers when you check them at the end.' : 'Choose a verdict. You see the answers at the end.',
        tool: (el) => {
          el.append(h('p', { class: 'od-quote' }, q.kind === 'cls' ? `“${q.s.text}”` : `“${q.c.text}”`));
          el.append(h('div', { class: 'od-row', role: 'group', 'aria-label': q.kind === 'cls' ? 'Observation or inference' : 'Verdict' }, ...opts.map(([v, label]) => btn(label, () => {
            if (q.kind === 'cls') st.cls[q.s.id] = v; else st.verdicts[q.c.id] = v;
            this.persist();
            this.refresh();
          }, { pressed: chosen === v }))));
        },
        primary: { label: i < qs.length ? 'Next question' : 'Next step', disabled: !chosen, onClick: () => { this.transferQ = i + 1; this.refresh(); } },
      };
    }
    return {
      step: total, total, goal: 'Write one label sentence',
      action: st.checked ? 'Press Finish to see your shift report.' : 'Press Open the label sentence. Write one sentence, then check your answers.',
      result: st.checked ? `${st.checked.right} of ${st.checked.total} match the expert reading.` : '',
      primary: st.checked ? { label: 'Finish', onClick: () => this.app.completeModule(3) } : { label: 'Open the label sentence', onClick: () => this._openTransferSentence() },
      secondary: st.checked ? { label: 'Open the label sentence', onClick: () => this._openTransferSentence() } : null,
    };
  }

  _openTransferCard() {
    const t = this.c.items.transfer;
    const obj = this.records[t.objectId];
    this.app.shell.openDrawer({
      title: 'Visitor card', key: 'transfer-card', trigger: this.app.shell.now.querySelector('[data-action="now-primary"]'),
      render: (b) => b.append(
        h('p', {}, t.intro),
        h('article', { class: 'doc-card fictional' }, h('p', { class: 'badge fiction' }, 'Fictional document created for this game'), h('h3', {}, t.card.title), h('blockquote', {}, t.card.body)),
        h('section', { class: 'doc-card record' }, h('p', { class: 'badge real' }, 'Real record excerpt (Smithsonian Open Access)'), h('h3', {}, obj.title),
          h('ul', { class: 'excerpts' }, ...t.recordExcerpt.map((x) => h('li', {}, x))),
          h('p', {}, h('a', { href: obj.recordUrl, target: '_blank', rel: 'noopener' }, 'Open the real Smithsonian record (new tab)'))),
      ),
      onClose: () => { this.save.transferCardRead = true; this.persist(); this.refresh(); },
    });
  }

  _openTransferSentence() {
    const t = this.c.items.transfer;
    const state = this.save.transfer;
    this.app.shell.openDrawer({
      title: 'Label sentence', key: 'transfer-label', trigger: this.app.shell.now.querySelector('[data-action="now-primary"]'),
      render: (b) => {
        const ta = h('textarea', { id: 'transfer-label', rows: 3, maxlength: 600, oninput: (e) => { state.label = e.target.value; this.persist(); } });
        ta.value = state.label || '';
        const out = h('div', { class: 'transfer-results' });
        const check = () => {
          clear(out);
          const missing = t.statements.filter((s) => !state.cls[s.id]).length + t.claims.filter((c) => !state.verdicts[c.id]).length;
          if (missing) { out.appendChild(feedback('warn', `Answer every question first (${missing} left). Close this drawer and use the Now card.`)); this.app.shell.revealInDrawer(out); return; }
          let right = 0; let total = 0;
          const list = h('ul', {});
          for (const s of t.statements) { total++; const ok = state.cls[s.id] === s.kind; if (ok) right++; list.appendChild(h('li', {}, `${ok ? '✓' : '✗'} “${s.text}” is an ${s.kind}. ${s.why}`)); this.app.record.log('answered', { id: `transfer-${s.id}`, name: s.text }, { response: state.cls[s.id], success: ok }); }
          for (const c of t.claims) { total++; const ok = state.verdicts[c.id] === c.verdict; if (ok) right++; list.appendChild(h('li', {}, `${ok ? '✓' : '✗'} ${c.id}: ${VERDICTS[c.verdict]}. ${c.why}`)); this.app.record.log('answered', { id: `transfer-${c.id}`, name: c.text }, { response: state.verdicts[c.id], success: ok }); }
          state.checked = { right, total };
          this.app.record.log('completed', { id: 'transfer', name: 'Transfer task' }, { score: { raw: right, max: total }, response: (state.label || '').slice(0, 300) });
          this.persist();
          const head = h('p', { class: 'od-result' }, h('strong', {}, `${right} of ${total} match the expert reading.`));
          out.append(head, list, h('h3', {}, 'An example label sentence'), h('p', {}, t.exemplar),
            h('p', { class: 'next-row' }, h('button', { type: 'button', class: 'v3-btn v3-primary', onclick: () => { this.app.shell.closeDrawer(); this.app.completeModule(3); } }, 'Finish: wrap-up')));
          this.app.shell.revealInDrawer(head);
          this.refresh();
        };
        b.append(h('label', { for: 'transfer-label' }, t.labelPrompt), ta,
          h('p', { class: 'next-row' }, h('button', { type: 'button', class: 'v3-btn v3-primary', onclick: check }, 'Check my answers')), out);
        if (state.checked) check();
      },
    });
  }

  // ---------------------------------------------------------------- wrap-up
  wrapNow() {
    const main = this.cases.main.engine.score();
    return {
      goal: 'Shift complete',
      action: 'Press Open the shift report to see your results. Then explore the gallery as long as you like.',
      result: `Case 2: ${main.verdictCorrect} of ${main.total} verdicts match the expert.`,
      hint: 'Every object you open goes into the Discovery journal (Menu).',
      primary: { label: 'Open the shift report', onClick: () => this.app.shell.openDrawer({ title: 'Shift report', key: 'wrap', trigger: this.app.shell.now.querySelector('[data-action="now-primary"]'), render: (b) => renderWrapUp(this.v2, b), onClose: () => this.app.shell.setModuleDone(4, true) }) },
    };
  }

  // ---------------------------------------------------------------- cinematics
  playTour() {
    const shots = this.c.cinematics.shots.filter((s) => s.id === 'S1');
    this.app.playCinematic({ id: 'S1', title: 'After hours', shots });
    this.app.record.log('experienced', { id: 'cinematic-S1', name: 'After hours (cinematic)' });
    if (this.app.player) this.app.player.onFinish = () => { this.save.s1Seen = true; this.persist(); };
  }

  playReveal() {
    const label = this.cases.main.engine.state.label || this.cases.main.def.label.exemplar;
    this.stage?.clear();
    this.museum?.showLabelInCase('chester-relay', label);
    const shots = this.c.cinematics.shots.filter((s) => s.id === 'S2');
    this.app.playCinematic({ id: 'S2', title: 'The reveal', shots });
    this.app.record.log('experienced', { id: 'cinematic-S2', name: 'The reveal (cinematic)' });
    if (this.app.player) this.app.player.onFinish = () => { this.museum?.showLabelInCase(null); if (this.app.module === 2) this._enterCase('main'); this.refresh(); };
  }

  /** Test and audit hooks: put a case at a step (as a learner reaches it). */
  _setCaseStep(caseId, step) { this.step[caseId] = STEPS.findIndex(([id]) => id === step); this._tagsSync(); this.refresh(); }
}

export { VITRINES };
