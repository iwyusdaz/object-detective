/**
 * Tiny DOM helper: h('button', { type: 'button', onclick }, 'text', child...).
 * Strings become text nodes (never innerHTML), so learner text and content
 * strings cannot inject markup.
 * @module ui/dom
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

let uid = 0;
export const nextId = (p = 'id') => `${p}-${++uid}`;

/** A labelled radio group (fieldset + legend). onChange(value). */
export function radioGroup({ legend, name, options, value = null, onChange, className = '' }) {
  const fs = h('fieldset', { class: `radio-group ${className}` }, h('legend', {}, legend));
  for (const o of options) {
    const id = nextId(name);
    const input = h('input', { type: 'radio', name, id, value: o.value, checked: o.value === value, onchange: () => onChange?.(o.value) });
    fs.appendChild(h('div', { class: 'radio-row' }, input, h('label', { for: id }, o.label)));
  }
  return fs;
}

/** Visible feedback block that is also announced (role=status). */
export function feedback(kind, ...content) {
  return h('div', { class: `feedback feedback-${kind}`, role: 'status' }, ...content);
}
