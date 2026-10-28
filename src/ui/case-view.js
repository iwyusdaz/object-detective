/**
 * Case panel (shared by 3D mode and text mode — the SAME decisions in both):
 * step navigation Brief → Inspect → Archive → Evidence board → Label → Debrief.
 * Brief/Inspect/Archive are rendered here; board/label/debrief in case-board.js.
 * In text mode, Inspect shows photo sets + descriptions and "look" actions
 * (magnifier / raking light / measure) instead of the 3D tools.
 * @module ui/case-view
 */
import { h, clear, radioGroup, feedback } from './dom.js';
import { renderBoard, renderLabel, renderDebrief } from './case-board.js';

export const STEPS = [
  ['brief', 'Brief'], ['inspect', 'Inspect'], ['archive', 'Archive'], ['board', 'Evidence board'], ['label', 'Label'], ['debrief', 'Debrief'],
];
export const TOOL_NAMES = { view: 'looking', magnify: 'the magnifier', raking: 'a low raking light', measure: 'the measuring tool' };

export class CaseView {
  constructor(opts) {
    Object.assign(this, opts); // panel, def, engine, objects, photos, descriptions, rubric, hooks
    this.step = 'brief';
    this.objectId = this.def.objects[0];
    this.poiId = null;
  }

  get isText() { return this.hooks.isTextMode(); }

  render(step = this.step) {
    this.step = step;
    clear(this.panel);
    this.panel.append(
      h('h2', { class: 'case-title' }, this.def.title),
      h('nav', { class: 'step-nav', 'aria-label': 'Case steps' }, ...STEPS.map(([id, label], i) => h('button', {
        type: 'button', 'aria-current': id === step ? 'step' : null, class: id === step ? 'active' : '',
        disabled: id === 'debrief' && !this.engine.state.submitted,
        onclick: () => this.go(id),
      }, `${i + 1}. ${label}`))),
    );
    const body = h('div', { class: 'step-body' });
    this.panel.appendChild(body);
    ({ brief: () => this.renderBrief(body), inspect: () => this.renderInspect(body), archive: () => this.renderArchive(body), board: () => renderBoard(this, body), label: () => renderLabel(this, body), debrief: () => renderDebrief(this, body) })[step]();
    this.hooks.onStep?.(step);
  }

  go(step) {
    this.render(step);
    this.hooks.save();
    this.panel.querySelector('.step-body h3, .step-body h4')?.setAttribute('tabindex', '-1');
    this.panel.querySelector('.step-body h3')?.focus();
  }

  next(step) { return h('p', { class: 'next-row' }, h('button', { type: 'button', class: 'primary', onclick: () => this.go(step) }, `Next: ${STEPS.find(([id]) => id === step)[1]}`)); }

  /* ---------------- Brief ---------------- */
  renderBrief(body) {
    const doc = this.def.fictionalDocument;
    body.append(
      h('h3', {}, 'Your brief'),
      ...this.def.intro.map((p) => h('p', {}, p)),
      h('article', { class: 'doc-card fictional', 'aria-labelledby': `${doc.id}-h` },
        h('p', { class: 'badge fiction' }, 'Fictional document created for this game'),
        h('h4', { id: `${doc.id}-h` }, doc.title),
        h('p', { class: 'doc-meta' }, `Author: ${doc.author}. Date: ${doc.date}.`),
        h('blockquote', {}, doc.body),
        h('p', { class: 'doc-note' }, doc.sourcingNotes),
      ),
      h('h4', {}, 'The claims to check'),
      h('ol', { class: 'claim-list' }, ...this.def.claims.map((c) => h('li', {}, h('strong', {}, `${c.id}: `), c.text))),
      h('p', {}, 'Your verdict for each claim can be confirmed, refuted or ', h('strong', {}, "can't tell yet"), '. "Can\'t tell yet" is a real answer when the evidence runs out.'),
      this.next('inspect'),
    );
  }

  /* ---------------- Inspect ---------------- */
  renderInspect(body) {
    const objs = this.def.objects.map((id) => this.objects[id]);
    body.appendChild(h('h3', {}, 'Inspect the objects'));
    if (objs.length > 1) {
      body.appendChild(h('div', { class: 'object-chooser', role: 'group', 'aria-label': 'Choose an object to examine' },
        ...objs.map((o) => h('button', { type: 'button', 'aria-pressed': String(o.id === this.objectId), onclick: () => { this.objectId = o.id; this.poiId = null; this.hooks.showObject(o.id); this.render('inspect'); } }, o.title))));
    }
    const obj = this.objects[this.objectId];
    const desc = this.descriptions.objects[obj.id];
    body.appendChild(h('section', { class: 'object-card', 'aria-labelledby': 'obj-h' },
      h('h4', { id: 'obj-h' }, obj.title),
      h('p', { class: 'badge real' }, 'Real object: Smithsonian Open Access 3D scan (CC0)'),
      h('p', {}, desc.summary),
      this.isText ? this.photoGrid(obj, desc) : h('p', { class: 'tool-hint' }, 'Use the tools beside the 3D view: turn, tilt and zoom, preset views, raking light, magnifier, measure, true size and compare. Every tool has buttons and keys.'),
    ));
    // Points of interest (keyboard / list access to every hotspot)
    const findings = this.def.findings.filter((f) => f.objectId === obj.id);
    body.appendChild(h('h4', { id: 'poi-h' }, 'Points of interest'));
    body.appendChild(h('ul', { class: 'poi-list', 'aria-labelledby': 'poi-h' }, ...findings.map((f) => h('li', {},
      h('button', { type: 'button', 'aria-pressed': String(f.id === this.poiId), dataset: { poi: f.id }, onclick: () => this.selectPoi(f.id) },
        `${this.engine.isDiscovered(f.id) ? '✓ ' : ''}${f.hotspot.label}`)))));
    if (this.poiId) body.appendChild(this.poiCard(this.def.findings.find((f) => f.id === this.poiId)));
    const n = this.engine.state.discovered.length;
    body.appendChild(h('p', { class: 'log-summary' }, `Observation log: ${n} of ${this.def.findings.length} findings recorded across this case.`));
    body.appendChild(this.next('archive'));
  }

  selectPoi(id) {
    this.poiId = id;
    const f = this.def.findings.find((x) => x.id === id);
    this.hooks.gotoHotspot(f.objectId, f.hotspot);
    this.render('inspect');
    this.panel.querySelector('.poi-card h4')?.focus();
  }

  photoGrid(obj, desc) {
    const photos = this.photos[obj.id] || [];
    return h('div', {},
      h('div', { class: 'photo-grid' }, ...photos.map((p) => h('figure', {},
        h('img', { src: this.hooks.asset(p.file), alt: `${obj.title}, ${this.descriptions.views[p.view]} (render of the Smithsonian 3D scan)`, loading: 'lazy', width: 800, height: 600 }),
        h('figcaption', {}, this.descriptions.views[p.view])))),
      h('h5', {}, 'Description'), h('p', {}, desc.description),
      desc.raking ? h('p', {}, h('strong', {}, 'Under raking light: '), desc.raking) : null,
      h('p', {}, h('strong', {}, 'Record measurements: '), obj.measurementsText),
    );
  }

  poiCard(f) {
    const done = this.engine.isDiscovered(f.id);
    const card = h('section', { class: 'poi-card', 'aria-labelledby': `poi-${f.id}` }, h('h4', { id: `poi-${f.id}`, tabindex: '-1' }, f.hotspot.label));
    const msg = h('div', { class: 'poi-msg', role: 'status' });
    const tryDiscover = (tool, why = null) => {
      const r = this.engine.discover(f.id, tool);
      if (r.ok) {
        this.hooks.log('experienced', { id: `finding-${f.id}`, name: f.hotspot.label }, { response: tool });
        this.hooks.announce('Finding recorded in your observation log.');
        this.hooks.save();
        this.render('inspect');
        this.panel.querySelector('.poi-card h4')?.focus();
      } else {
        clear(msg).appendChild(feedback('info', why || (this.def.assessed
          ? 'Nothing new shows up here with that. Try another tool: the magnifier, a low raking light, or measuring.'
          : `Nothing new shows up with that. Hint: this spot needs ${TOOL_NAMES[f.tool]}.`)));
      }
    };
    if (!done) {
      if (!this.def.assessed) card.appendChild(h('p', { class: 'hint' }, `Hint (tutorial): try ${TOOL_NAMES[f.tool]} here.`));
      if (this.isText) {
        card.appendChild(h('div', { class: 'look-actions', role: 'group', 'aria-label': 'How to look at this spot' },
          ...['view', 'magnify', 'raking', 'measure'].map((t) => h('button', { type: 'button', onclick: () => tryDiscover(t) },
            { view: 'Look at it', magnify: 'Look closely (magnifier)', raking: 'Low raking light', measure: 'Measure it' }[t]))));
      } else {
        card.appendChild(h('p', {}, 'The camera has moved to this spot. Use the tools, then record what you see.'));
        card.appendChild(h('button', { type: 'button', class: 'primary', onclick: () => {
          // A tool counts only if it reveals this mark now (lens over it, light low, right side up).
          // Judged synchronously on the visible state: gotoHotspot has already
          // settled any in-flight object switch before announcing the spot.
          const active = this.hooks.activeTools(f.objectId, f.hotspot);
          if (active.has(f.tool)) { tryDiscover(f.tool); return; }
          tryDiscover([...active].find((t) => t !== 'view') || 'view', this.hooks.whyNotRevealed?.(f.objectId, f.hotspot, f.tool));
        } }, 'Record what I see'));
      }
      card.appendChild(msg);
      return card;
    }
    const img = this.photos._findings?.[f.id];
    if (img) card.appendChild(h('figure', {}, h('img', { src: this.hooks.asset(img), alt: `${f.hotspot.label}: ${f.description}`, loading: 'lazy', width: 800, height: 600 })));
    card.appendChild(h('p', {}, f.description));
    if (f.transcription) card.appendChild(h('p', { class: 'transcription' }, h('strong', {}, 'Transcription: '), f.transcription));
    card.appendChild(h('h5', {}, 'Observation or inference?'));
    card.appendChild(h('p', { class: 'tool-hint' }, 'An observation is what anyone can see or measure. An inference is what you think it means.'));
    for (const s of f.statements) card.appendChild(this.classifyRow(f, s));
    return card;
  }

  classifyRow(f, s) {
    const chosen = this.engine.state.classifications[f.id]?.[s.id] || null;
    const wrap = h('div', { class: 'classify-row' });
    const out = h('div', {});
    const show = (kind) => {
      const r = this.engine.classify(f.id, s.id, kind);
      clear(out).appendChild(feedback(r.correct ? 'ok' : 'warn', h('strong', {}, r.correct ? 'Yes. ' : `Not quite. It is an ${r.expected}. `), r.why));
    };
    wrap.appendChild(radioGroup({
      legend: `“${s.text}”`, name: `cls-${this.def.id}-${f.id}-${s.id}`, value: chosen,
      options: [{ value: 'observation', label: 'Observation' }, { value: 'inference', label: 'Inference' }],
      onChange: (kind) => { show(kind); this.hooks.log('answered', { id: `classify-${f.id}-${s.id}`, name: s.text }, { response: kind, success: kind === s.kind }); this.hooks.save(); },
    }));
    wrap.appendChild(out);
    if (chosen) show(chosen);
    return wrap;
  }

  /* ---------------- Archive ---------------- */
  renderArchive(body) {
    body.append(h('h3', {}, 'The records drawer'),
      h('p', {}, 'Open each document. Before you trust it, source it: who made it, when, and why?'));
    for (const d of this.def.archive) {
      if (d.id === this.def.fictionalDocument.id) continue;
      const opened = this.engine.state.archiveOpened.includes(d.id);
      const det = h('details', { class: `doc-card ${d.kind}`, open: opened, ontoggle: (e) => { if (e.target.open && !this.engine.state.archiveOpened.includes(d.id)) { this.engine.openDoc(d.id); this.hooks.log('experienced', { id: `doc-${d.id}`, name: d.title }); this.hooks.save(); } } },
        h('summary', {}, d.title),
        h('p', { class: `badge ${d.kind === 'fictional' ? 'fiction' : 'real'}` }, d.kind === 'fictional' ? 'Fictional document created for this game' : 'Real record (Smithsonian Open Access, CC0 metadata)'),
        h('dl', { class: 'sourcing' }, h('dt', {}, 'Who made it'), h('dd', {}, d.sourcing.author), h('dt', {}, 'When'), h('dd', {}, d.sourcing.date), h('dt', {}, 'Why'), h('dd', {}, d.sourcing.purpose)),
        h('ul', { class: 'excerpts' }, ...d.excerpts.map((x) => h('li', {}, x))),
        d.objectId && this.objects[d.objectId] ? h('p', {}, h('a', { href: this.objects[d.objectId].recordUrl, target: '_blank', rel: 'noopener' }, 'Open the real Smithsonian record (new tab)')) : null,
      );
      const q = (this.def.sourcingQuestions || []).find((x) => x.docId === d.id);
      if (q) det.appendChild(this.sourcingQuestion(q));
      det.appendChild(this.def.assessed
        ? h('details', { class: 'nested' }, h('summary', {}, "Compare with a historian's sourcing"), h('p', {}, d.sourcing.reliability))
        : h('p', { class: 'model' }, h('strong', {}, 'How a historian sources this: '), d.sourcing.reliability));
      body.appendChild(det);
    }
    body.appendChild(this.next('board'));
  }

  sourcingQuestion(q) {
    const out = h('div', {});
    const chosen = this.engine.state.sourcing[q.id] || null;
    const show = (v) => { const r = this.engine.answerSourcing(q.id, v); clear(out).appendChild(feedback(r.correct ? 'ok' : 'warn', h('strong', {}, r.correct ? 'Good sourcing. ' : 'Think again. '), r.why)); };
    const group = radioGroup({ legend: q.prompt, name: `src-${q.id}`, value: chosen, options: q.options.map((o) => ({ value: o.id, label: o.text })),
      onChange: (v) => { show(v); this.hooks.log('answered', { id: `sourcing-${q.id}`, name: q.prompt }, { response: v, success: v === q.correct }); this.hooks.save(); } });
    if (chosen) show(chosen);
    return h('div', { class: 'sourcing-q' }, group, out);
  }
}
