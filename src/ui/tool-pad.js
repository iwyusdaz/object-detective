/**
 * Inspection tool pad (3D mode): every pointer gesture has a button / slider
 * alternative (WCAG 2.5.1), and every control is a native, labelled form
 * element (keyboard operable). Groups: View, Raking light, Magnifier, Measure,
 * True size, Compare. The keyboard shortcuts shown are the CURRENT bindings.
 * The whole pad can be collapsed behind a toggle; on narrow screens it starts
 * collapsed so it does not cover the object (agent review SP6).
 * @module ui/tool-pad
 */
import { h, clear } from './dom.js';
import { PRESET_VIEWS } from '../scenes/inspection.js';
import { KeyMap } from '../core/keymap.js';

/** Visible legend naming the true-size references (agent review SP8). */
export const TRUE_SIZE_LEGEND = 'References: 30 cm ruler (ticks in cm) · US quarter, 24.26 mm across · bank card, 85.6 × 54 mm.';

export class ToolPad {
  /**
   * @param {HTMLElement} host
   * @param {object} api  { do(actionId), setRaking(partial), toggleRaking(on), toggleMagnifier(on),
   *                        cycleMag(), moveLens(dx,dy), measurePreset(), setPointMeasure(on),
   *                        toggleTrueSize(on), setCompare(id|null), preset(name), keys: KeyMap }
   */
  constructor(host, api) {
    this.api = api;
    this.root = h('aside', { class: 'tool-pad', 'aria-label': 'Inspection tools' });
    host.appendChild(this.root);
    this.collapsed = null; // decided on first render (narrow screens start collapsed)
    this._lastArgs = {};
    this.render({});
  }

  k(id) { return KeyMap.pretty(this.api.keys.map[id]); }

  /**
   * Sync the raking sliders + outputs in place (agent review V2-VIS-4): the
   * torch-aim pointermove would otherwise leave the pad showing a stale
   * direction/height while the state has moved. No re-render per move — the
   * values update on the live controls only.
   */
  syncRaking(raking = {}) {
    const rows = { azimuth: ['rake-az', '°'], elevation: ['rake-el', '°'], intensity: ['rake-in', ''] };
    for (const [key, [id, unit]] of Object.entries(rows)) {
      if (!(key in raking)) continue;
      const input = this.root.querySelector(`input#${id}`);
      if (input && +input.value !== raking[key]) {
        input.value = raking[key];
        input.setAttribute('value', String(raking[key]));
      }
      const out = this.root.querySelector(`output[for="${id}"]`);
      if (out) out.textContent = `${raking[key]}${unit}`;
    }
  }

  render({ compareOptions = [], compareId = null, raking = { azimuth: 300, elevation: 12, intensity: 3.2 }, rakingOn = false, magOn = false, magZoom = 4, trueSize = false, pointMeasure = false, measureText = '', trueSizeText = '' } = {}) {
    this._lastArgs = arguments[0] || {};
    if (this.collapsed === null) this.collapsed = window.matchMedia('(max-width: 760px)').matches;
    clear(this.root);
    const btn = (label, action, aria) => h('button', { type: 'button', 'aria-label': aria || label, title: aria || label, onclick: () => this.api.do(action) }, label);

    const view = h('details', { class: 'tool-group', open: true },
      h('summary', {}, 'View'),
      h('div', { class: 'pad-grid', role: 'group', 'aria-label': 'Turn, tilt and zoom' },
        btn('◀', 'turnLeft', `Turn object left (${this.k('turnLeft')})`),
        btn('▶', 'turnRight', `Turn object right (${this.k('turnRight')})`),
        btn('▲', 'tiltUp', `View from higher (${this.k('tiltUp')})`),
        btn('▼', 'tiltDown', `View from lower (${this.k('tiltDown')})`),
        btn('+', 'zoomIn', `Zoom in (${this.k('zoomIn')})`),
        btn('−', 'zoomOut', `Zoom out (${this.k('zoomOut')})`),
      ),
      h('div', { class: 'preset-row', role: 'group', 'aria-label': 'Preset views' },
        ...Object.entries(PRESET_VIEWS).map(([id, p]) => h('button', { type: 'button', onclick: () => this.api.preset(id) }, p.label.replace(' (turned over)', ''))),
      ),
      btn(`Turn over (${this.k('flip')})`, 'flip'),
    );

    const range = (id, label, min, max, step, value, key, unit) => {
      const out = h('output', { for: id }, `${value}${unit}`);
      const input = h('input', {
        type: 'range', id, min, max, step, value,
        oninput: (e) => { out.textContent = `${e.target.value}${unit}`; this.api.setRaking({ [key]: +e.target.value }); },
      });
      return h('div', { class: 'range-row' }, h('label', { for: id }, label, ' ', out), input);
    };
    const rakingGroup = h('details', { class: 'tool-group', open: rakingOn },
      h('summary', {}, 'Raking light'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: rakingOn, onchange: (e) => this.api.toggleRaking(e.target.checked) }), ` Raking light on (${this.k('raking')})`),
      range('rake-az', 'Direction around', 0, 359, 1, raking.azimuth, 'azimuth', '°'),
      range('rake-el', 'Height above table', 2, 60, 1, raking.elevation, 'elevation', '°'),
      range('rake-in', 'Brightness', 0.5, 6, 0.1, raking.intensity, 'intensity', ''),
      h('p', { class: 'tool-hint' }, `Low angles (20° or less) reveal relief and faint marks. Keys: ${this.k('rakeAzLeft')} ${this.k('rakeAzRight')} move it around, ${this.k('rakeLower')} ${this.k('rakeHigher')} lower/raise.`),
    );

    const mag = h('details', { class: 'tool-group', open: magOn },
      h('summary', {}, 'Magnifier'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: magOn, onchange: (e) => this.api.toggleMagnifier(e.target.checked) }), ` Magnifier on (${this.k('magnifier')})`),
      h('button', { type: 'button', onclick: () => this.api.cycleMag() }, `Power: ${magZoom}× (${this.k('magZoom')})`),
      h('div', { class: 'pad-grid', role: 'group', 'aria-label': 'Move the lens' },
        h('button', { type: 'button', 'aria-label': 'Move lens left', onclick: () => this.api.moveLens(-0.04, 0) }, '◀'),
        h('button', { type: 'button', 'aria-label': 'Move lens right', onclick: () => this.api.moveLens(0.04, 0) }, '▶'),
        h('button', { type: 'button', 'aria-label': 'Move lens up', onclick: () => this.api.moveLens(0, -0.04) }, '▲'),
        h('button', { type: 'button', 'aria-label': 'Move lens down', onclick: () => this.api.moveLens(0, 0.04) }, '▼'),
      ),
      h('p', { class: 'tool-hint' }, 'The lens follows the pointer over the 3D view. It loads a sharper 4096-pixel texture where one is available.'),
    );

    const measure = h('details', { class: 'tool-group', open: Boolean(measureText) || pointMeasure },
      h('summary', {}, 'Measure'),
      h('button', { type: 'button', onclick: () => this.api.measurePreset() }, `Measure the longest side (${this.k('measure')})`),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: pointMeasure, onchange: (e) => this.api.setPointMeasure(e.target.checked) }), ' Two-point mode: click two points on the object'),
      h('p', { class: 'measure-out', 'aria-live': 'polite' }, measureText || 'No measurement yet.'),
    );

    const size = h('details', { class: 'tool-group', open: trueSize },
      h('summary', {}, 'True size'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: trueSize, onchange: (e) => this.api.toggleTrueSize(e.target.checked) }), ` Show beside a ruler, a coin and a card (${this.k('trueSize')})`),
      // The references are named in visible text, not only in the live region,
      // and the record's dimensions are stated in text (agent review SP8).
      h('p', { class: 'tool-hint' }, TRUE_SIZE_LEGEND),
      trueSizeText ? h('p', { class: 'true-size-out', 'aria-live': 'polite' }, trueSizeText) : null,
    );

    // Collapse toggle: the pad must not cover the object on small screens.
    const toggle = h('button', {
      type: 'button',
      class: 'pad-toggle',
      'aria-expanded': String(!this.collapsed),
      onclick: () => { this.collapsed = !this.collapsed; this.render(this._lastArgs); },
    }, `${this.collapsed ? '▸' : '▾'} Inspection tools`);

    const body = h('div', { class: 'pad-body' }, view, rakingGroup, mag, measure, size);
    if (compareOptions.length) {
      const sel = h('select', { id: 'compare-select', onchange: (e) => this.api.setCompare(e.target.value || null) },
        h('option', { value: '' }, 'No comparison (one object)'),
        ...compareOptions.map((o) => h('option', { value: o.id, selected: o.id === compareId }, o.title)),
      );
      body.append(h('details', { class: 'tool-group', open: Boolean(compareId) },
        h('summary', {}, 'Compare'),
        h('label', { for: 'compare-select' }, 'Put a second object beside this one (both turn together):'),
        sel,
      ));
    }
    this.root.classList.toggle('collapsed', this.collapsed);
    this.root.append(toggle, body);
  }
}
