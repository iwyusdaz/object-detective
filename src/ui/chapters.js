/**
 * Non-case chapters: welcome + pre-check, transfer task, wrap-up.
 * Same content in 3D and text mode (these chapters are panel-only).
 * @module ui/chapters
 */
import { h, clear, radioGroup, feedback } from './dom.js';
import { mcItem } from '../learning/assess.js';
import { VERDICTS } from '../systems/case-engine.js';

export function renderWelcome(app, panel) {
  clear(panel);
  const pre = app.items.preCheck;
  panel.append(
    h('h2', { class: 'case-title' }, 'Welcome to the evening shift'),
    h('p', {}, 'You are a new evening intern at the Lantern Museum. The museum, its staff and its documents are ', h('strong', {}, 'fictional'), '. The objects are ', h('strong', {}, 'real'), ': 3D scans released by the Smithsonian under CC0, with their real catalog records.'),
    h('p', {}, 'Your job: check museum labels. Look closely, separate what you see from what you think it means, weigh the records, and write a label that says how sure we are.'),
    h('h3', {}, 'Pre-check (not graded)'),
    h('p', {}, pre.intro),
  );
  const host = h('div', {});
  panel.appendChild(host);
  for (const item of pre.items) {
    const prev = app.save.pre[item.id];
    const wrap = mcItem({ item, container: host, onAnswered: (a) => {
      app.save.pre[item.id] = a.chosen;
      app.record.log('answered', { id: item.id, name: item.prompt }, { response: a.chosen, success: a.correct });
      app.persist();
    } });
    if (prev) wrap.querySelectorAll('.choice-btn').forEach((b, i) => { if (item.options[i].id === prev) b.click(); });
  }
  panel.append(h('p', { class: 'next-row' },
    h('button', { type: 'button', class: 'primary', onclick: () => app.startTutorial() }, 'Start the shift: Case 1 (tutorial)')));
}

export function renderTransfer(app, panel) {
  clear(panel);
  const t = app.items.transfer;
  const obj = app.objects[t.objectId];
  const desc = app.descriptions.objects[t.objectId];
  const state = app.save.transfer;
  panel.append(
    h('h2', { class: 'case-title' }, 'On your own: a new object'),
    h('p', {}, t.intro),
    h('article', { class: 'doc-card fictional' }, h('p', { class: 'badge fiction' }, 'Fictional document created for this game'), h('h3', {}, t.card.title), h('blockquote', {}, t.card.body)),
    h('h3', {}, obj.title),
    h('p', { class: 'badge real' }, 'Real object: Smithsonian Open Access 3D scan (CC0). Photos are renders of the scan.'),
    h('div', { class: 'photo-grid' }, ...(app.photos[obj.id] || []).filter((p) => ['front', 'left', 'top', 'bottom'].includes(p.view)).map((p) => h('figure', {},
      h('img', { src: app.asset(p.file), alt: `${obj.title}, ${app.descriptions.views[p.view]} (render of the Smithsonian 3D scan)`, loading: 'lazy', width: 800, height: 600 }),
      h('figcaption', {}, app.descriptions.views[p.view])))),
    h('p', {}, desc.description),
    h('section', { class: 'doc-card record' }, h('p', { class: 'badge real' }, 'Real record excerpt (Smithsonian Open Access)'),
      h('ul', { class: 'excerpts' }, ...t.recordExcerpt.map((x) => h('li', {}, x))),
      h('p', {}, h('a', { href: obj.recordUrl, target: '_blank', rel: 'noopener' }, 'Open the real Smithsonian record (new tab)'))),
    h('h3', {}, 'Observation or inference?'),
  );
  for (const s of t.statements) {
    panel.appendChild(radioGroup({ legend: `“${s.text}”`, name: `tr-${s.id}`, value: state.cls[s.id] || null,
      options: [{ value: 'observation', label: 'Observation' }, { value: 'inference', label: 'Inference' }],
      onChange: (v) => { state.cls[s.id] = v; app.persist(); } }));
  }
  panel.appendChild(h('h3', {}, 'Verdicts on the card\'s claims'));
  for (const c of t.claims) {
    panel.appendChild(radioGroup({ legend: `${c.id}: ${c.text}`, name: `tr-${c.id}`, value: state.verdicts[c.id] || null,
      options: Object.entries(VERDICTS).map(([value, label]) => ({ value, label })),
      onChange: (v) => { state.verdicts[c.id] = v; app.persist(); } }));
  }
  const ta = h('textarea', { id: 'transfer-label', rows: 3, maxlength: 600, oninput: (e) => { state.label = e.target.value; app.persist(); } });
  ta.value = state.label || '';
  panel.append(h('label', { for: 'transfer-label' }, t.labelPrompt), ta);
  const out = h('div', { class: 'transfer-results' });
  panel.append(h('p', { class: 'next-row' }, h('button', { type: 'button', class: 'primary', onclick: () => {
    clear(out);
    const missing = t.statements.filter((s) => !state.cls[s.id]).length + t.claims.filter((c) => !state.verdicts[c.id]).length;
    if (missing) { out.appendChild(feedback('warn', `Answer every question first (${missing} left).`)); return; }
    let right = 0; let total = 0;
    const list = h('ul', {});
    for (const s of t.statements) { total++; const ok = state.cls[s.id] === s.kind; if (ok) right++; list.appendChild(h('li', {}, `${ok ? '✓' : '✗'} “${s.text}” is an ${s.kind}. ${s.why}`)); app.record.log('answered', { id: `transfer-${s.id}`, name: s.text }, { response: state.cls[s.id], success: ok }); }
    for (const c of t.claims) { total++; const ok = state.verdicts[c.id] === c.verdict; if (ok) right++; list.appendChild(h('li', {}, `${ok ? '✓' : '✗'} ${c.id}: ${VERDICTS[c.verdict]}. ${c.why}`)); app.record.log('answered', { id: `transfer-${c.id}`, name: c.text }, { response: state.verdicts[c.id], success: ok }); }
    state.checked = { right, total };
    app.record.log('completed', { id: 'transfer', name: 'Transfer task' }, { score: { raw: right, max: total }, response: (state.label || '').slice(0, 300) });
    app.persist();
    out.append(feedback(right === total ? 'ok' : 'info', h('strong', {}, `${right} of ${total} match the expert reading.`)), list,
      h('details', { class: 'exemplar', open: true }, h('summary', {}, 'An example label sentence'), h('p', {}, t.exemplar)),
      h('p', { class: 'next-row' }, h('button', { type: 'button', class: 'primary', onclick: () => app.gotoChapter(4) }, 'Finish: wrap-up')));
  } }, 'Check my answers')), out);
}

export function renderWrapUp(app, panel) {
  clear(panel);
  const score = (id) => app.cases[id].engine.score();
  const main = score('main');
  const tr = app.save.transfer.checked;
  panel.append(
    h('h2', { class: 'case-title' }, 'Shift complete'),
    h('ul', { class: 'scores' },
      h('li', {}, `Case 2 verdicts matching the expert: ${main.verdictCorrect} of ${main.total}; key evidence linked: ${main.linked} of ${main.total}.`),
      h('li', {}, `Calibration: ${main.calibration.summary}`),
      h('li', {}, tr ? `Transfer task: ${tr.right} of ${tr.total}.` : 'Transfer task: not checked yet.'),
    ),
    h('h3', {}, 'What historians do (and you just did)'),
    h('ul', {},
      h('li', {}, h('strong', {}, 'Close reading of objects: '), 'separate what you can see from what you infer.'),
      h('li', {}, h('strong', {}, 'Sourcing: '), 'ask who made a document, when and why, before trusting it.'),
      h('li', {}, h('strong', {}, 'Corroboration: '), 'check claims against more than one source, the object included.'),
      h('li', {}, h('strong', {}, 'Calibrated claims: '), '"can\'t tell yet" is an honest answer, and a label can say so.'),
    ),
    h('p', {}, 'These skills follow the historical-thinking approach of the Digital Inquiry Group (formerly the Stanford History Education Group), whose "Reading Like a Historian" lessons teach sourcing, contextualization, corroboration and close reading.'),
    h('p', {}, 'Your learning record stays in this browser. Open ', h('button', { type: 'button', class: 'linklike', onclick: (e) => app.progressPage.open(e.currentTarget) }, 'My progress'), ' to view it, download it as JSON, or clear it.'),
    h('p', {}, h('a', { href: '/' }, 'Back to all projects')),
  );
}
