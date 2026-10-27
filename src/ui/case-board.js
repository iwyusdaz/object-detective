/**
 * Evidence board, label writer and debrief views for a case (same in 3D and
 * text mode). No drag-only interactions: every pin is a labelled <select>.
 * @module ui/case-board
 */
import { h, clear, radioGroup, feedback } from './dom.js';
import { VERDICTS, RELATIONS, CONFIDENCE } from '../systems/case-engine.js';

const TYPE_LABEL = { finding: 'Your observation', record: 'Smithsonian record', fictional: 'Fictional document' };

export function renderBoard(view, body) {
  const eng = view.engine;
  const ev = eng.availableEvidence();
  body.append(h('h3', {}, 'Evidence board'),
    h('p', {}, 'For each claim, pin the evidence that bears on it: supports, contradicts or unclear. Then give your verdict and how sure you are.'));
  if (!ev.length) {
    body.append(feedback('warn', 'You have no evidence yet. Record findings in Inspect and open documents in the Archive first.'), view.next('inspect'));
    return;
  }
  body.appendChild(h('p', { class: 'tool-hint' }, `Evidence available: ${ev.length} item(s). Find more in Inspect and Archive at any time.`));
  for (const c of view.def.claims) {
    const pins = eng.pinsFor(c.id);
    const v = eng.state.verdicts[c.id];
    const sec = h('section', { class: 'claim-card', 'aria-labelledby': `claim-${c.id}` },
      h('h4', { id: `claim-${c.id}` }, `${c.id}: ${c.text}`));
    const summary = h('p', { class: 'pin-summary', 'aria-live': 'polite' });
    const updateSummary = () => {
      const p = eng.pinsFor(c.id);
      const counts = Object.values(p).reduce((a, r) => ({ ...a, [r]: (a[r] || 0) + 1 }), {});
      summary.textContent = Object.keys(counts).length ? `Pinned: ${Object.entries(counts).map(([r, n]) => `${n} ${RELATIONS[r].toLowerCase()}`).join(', ')}.` : 'Nothing pinned yet.';
    };
    updateSummary();
    const list = h('ul', { class: 'pin-list' });
    for (const e of ev) {
      const id = `pin-${view.def.id}-${c.id}-${e.id}`;
      const sel = h('select', { id, dataset: { claim: c.id, evidence: e.id }, onchange: (evn) => {
        const val = evn.target.value;
        if (val) eng.pin(c.id, e.id, val); else eng.unpin(c.id, e.id);
        view.hooks.log('answered', { id: `pin-${c.id}-${e.id}`, name: `Pin ${e.title} to ${c.id}` }, { response: val || 'none' });
        updateSummary();
        view.hooks.save();
      } },
      h('option', { value: '' }, 'Not linked'), ...Object.entries(RELATIONS).map(([k, label]) => h('option', { value: k, selected: pins[e.id] === k }, label)));
      list.appendChild(h('li', { class: `pin-row type-${e.type}` }, h('label', { for: id }, h('span', { class: 'pin-type' }, TYPE_LABEL[e.type]), ' ', e.title), sel));
    }
    sec.append(list, summary);
    sec.appendChild(radioGroup({
      legend: `Verdict on ${c.id}`, name: `verdict-${view.def.id}-${c.id}`, value: v?.verdict || null, className: 'verdict',
      options: Object.entries(VERDICTS).map(([value, label]) => ({ value, label })),
      onChange: (val) => { eng.setVerdict(c.id, val); view.hooks.save(); refreshSubmit(); },
    }));
    sec.appendChild(radioGroup({
      legend: `How sure are you about ${c.id}?`, name: `conf-${view.def.id}-${c.id}`, value: v ? String(v.confidence) : null, className: 'confidence',
      options: CONFIDENCE.map((x) => ({ value: String(x.level), label: x.label })),
      onChange: (val) => { eng.setConfidence(c.id, +val); view.hooks.save(); refreshSubmit(); },
    }));
    body.appendChild(sec);
  }
  const status = h('p', { class: 'submit-status', role: 'status' });
  const submit = h('button', { type: 'button', class: 'primary', onclick: () => {
    if (!eng.allVerdictsSet()) { status.textContent = 'Give a verdict for every claim first.'; return; }
    for (const c of view.def.claims) {
      const vv = eng.state.verdicts[c.id];
      view.hooks.log('answered', { id: `verdict-${view.def.id}-${c.id}`, name: c.text }, { response: `${vv.verdict}@${vv.confidence}`, success: vv.verdict === c.verdict });
    }
    view.hooks.save();
    view.go('label');
  } }, 'Save verdicts and write the label');
  const refreshSubmit = () => { status.textContent = eng.allVerdictsSet() ? 'All claims have a verdict.' : `${Object.values(eng.state.verdicts).filter((x) => x.verdict).length} of ${view.def.claims.length} claims have a verdict.`; };
  refreshSubmit();
  body.append(h('p', { class: 'next-row' }, submit), status);
}

export function renderLabel(view, body) {
  const eng = view.engine;
  const r = view.rubric;
  const ta = h('textarea', { id: `label-${view.def.id}`, rows: 7, maxlength: 2000, 'aria-describedby': `label-help-${view.def.id}`, oninput: (e) => { eng.setLabel(e.target.value); view.hooks.save(); } });
  ta.value = eng.state.label || '';
  const insert = (s) => {
    const start = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + (start && !/\s$/.test(ta.value.slice(0, start)) ? ' ' : '') + s + ta.value.slice(ta.selectionEnd ?? start);
    eng.setLabel(ta.value); view.hooks.save(); ta.focus();
  };
  body.append(
    h('h3', {}, 'Write the corrected label'),
    h('p', { id: `label-help-${view.def.id}` }, 'Write for museum visitors. State what the evidence supports, hedge where it is weak, and say what we cannot tell yet. Nobody grades this text automatically: you check it yourself against the rubric and the curator\'s example.'),
    h('div', { class: 'starters', role: 'group', 'aria-label': 'Sentence starters (insert at the cursor)' }, ...r.starters.map((s) => h('button', { type: 'button', onclick: () => insert(s) }, s.trim()))),
    h('label', { for: ta.id }, 'Your label'), ta,
    h('h4', {}, 'Self-check with the rubric'),
  );
  for (const c of r.criteria) {
    body.appendChild(radioGroup({ legend: c.name, name: `rub-${view.def.id}-${c.id}`, value: eng.state.selfCheck[c.id] || null, className: 'rubric',
      options: c.levels.map((l) => ({ value: l.id, label: `${l.id}: ${l.text}` })),
      onChange: (val) => { eng.setSelfCheck(c.id, val); view.hooks.save(); } }));
  }
  body.appendChild(h('ul', { class: 'selfcheck' }, ...r.selfCheck.map((q) => h('li', {}, q))));
  const ex = h('details', { class: 'exemplar' }, h('summary', {}, "Compare with the curator's example label"), h('p', {}, view.def.label.exemplar), h('p', { class: 'doc-meta' }, view.def.label.objectLine));
  body.appendChild(ex);
  const status = h('p', { role: 'status' });
  body.appendChild(h('p', { class: 'next-row' }, h('button', { type: 'button', class: 'primary', onclick: () => {
    if ((eng.state.label || '').trim().length < 20) { status.textContent = 'Write at least a sentence or two first.'; ta.focus(); return; }
    eng.state.submitted = true;
    view.hooks.log('completed', { id: `case-${view.def.id}`, name: view.def.title }, { response: eng.state.label.slice(0, 500), extensions: { selfCheck: eng.state.selfCheck } });
    view.hooks.save();
    view.hooks.onSubmitted?.();
    view.go('debrief');
  } }, 'Submit the case')), status);
}

export function renderDebrief(view, body) {
  const eng = view.engine;
  const s = eng.score();
  const verdictName = (v) => (v ? VERDICTS[v] : '—');
  body.append(h('h3', {}, "The curator's debrief"));
  if (view.def.assessed) {
    body.append(h('ul', { class: 'scores' },
      h('li', {}, `Verdicts matching the expert: ${s.verdictCorrect} of ${s.total}`),
      h('li', {}, `Claims with the key evidence linked correctly: ${s.linked} of ${s.total}`),
      h('li', {}, `Calibration: ${s.calibration.summary}${s.calibration.brier !== null ? ` (Brier score ${s.calibration.brier}; 0 is perfect)` : ''}`),
      s.overconfident.length ? h('li', {}, `Very sure but wrong on: ${s.overconfident.join(', ')}. Those are the claims to revisit.`) : null,
      h('li', {}, `Observation vs inference: ${s.classification.correct} of ${s.classification.total} classified like a historian`),
    ));
  } else {
    body.append(h('p', {}, 'This tutorial case is not scored. Compare your reasoning with the expert path below.'));
  }
  const table = h('table', { class: 'debrief-table' }, h('caption', {}, 'Your verdicts compared with the expert reasoning path'),
    h('thead', {}, h('tr', {}, ...['Claim', 'Your verdict', 'How sure', 'Expert verdict', 'Why'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, ...s.perClaim.map((r) => h('tr', { class: r.correct ? 'row-ok' : 'row-miss' },
      h('th', { scope: 'row' }, `${r.claimId}: ${view.def.claims.find((c) => c.id === r.claimId).text}`),
      h('td', {}, `${r.correct ? '✓ ' : '✗ '}${verdictName(r.chosen)}`),
      h('td', {}, r.confidence ? CONFIDENCE[r.confidence - 1].label : '—'),
      h('td', {}, verdictName(r.expected)),
      h('td', {}, r.expert, view.def.assessed ? h('span', { class: 'linked' }, r.linked ? ' Your evidence: key evidence linked.' : ' Your evidence: the key evidence was not linked this way.') : null),
    ))));
  body.appendChild(table);
  body.append(h('h4', {}, 'Your label and the curator\'s'),
    h('div', { class: 'label-compare' },
      h('figure', {}, h('figcaption', {}, 'Your label'), h('blockquote', {}, eng.state.label || '(empty)')),
      h('figure', {}, h('figcaption', {}, "Curator's example"), h('blockquote', {}, view.def.label.exemplar))));
  body.append(h('h4', {}, 'See the real records'), h('ul', {}, ...view.def.objects.map((id) => {
    const o = view.objects[id];
    return h('li', {}, h('a', { href: o.recordUrl, target: '_blank', rel: 'noopener' }, `${o.title}: Smithsonian record (new tab)`), ' · ', h('a', { href: o.voyagerUrl, target: '_blank', rel: 'noopener' }, '3D scan in the Smithsonian viewer (new tab)'));
  })));
  const actions = h('p', { class: 'next-row' });
  if (view.hooks.canPlayReveal()) actions.appendChild(h('button', { type: 'button', onclick: () => view.hooks.playReveal() }, 'Play the reveal (S2): your label in the case'));
  actions.appendChild(h('button', { type: 'button', class: 'primary', onclick: () => view.hooks.nextChapter() }, view.def.id === 'tutorial' ? 'Next: Case 2' : 'Next: on your own (transfer task)'));
  actions.appendChild(h('button', { type: 'button', onclick: () => view.hooks.restartCase() }, 'Try this case again'));
  body.appendChild(actions);
}
