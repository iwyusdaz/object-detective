/**
 * Visible, remappable key bindings (standards 5.3). Defaults below; learners
 * can change any binding in Settings. Stored per project
 * (`object-detective:keys`). Keys never fire while typing in a form field.
 * @module core/keymap
 */
export const ACTIONS = [
  { id: 'turnLeft', label: 'Turn object left', key: 'ArrowLeft' },
  { id: 'turnRight', label: 'Turn object right', key: 'ArrowRight' },
  { id: 'tiltUp', label: 'View from higher', key: 'ArrowUp' },
  { id: 'tiltDown', label: 'View from lower', key: 'ArrowDown' },
  { id: 'zoomIn', label: 'Zoom in', key: 'Equal' },
  { id: 'zoomOut', label: 'Zoom out', key: 'Minus' },
  { id: 'flip', label: 'Turn object over', key: 'KeyF' },
  { id: 'raking', label: 'Raking light on/off', key: 'KeyR' },
  { id: 'rakeAzLeft', label: 'Raking light: move around (left)', key: 'BracketLeft' },
  { id: 'rakeAzRight', label: 'Raking light: move around (right)', key: 'BracketRight' },
  { id: 'rakeLower', label: 'Raking light: lower', key: 'Comma' },
  { id: 'rakeHigher', label: 'Raking light: higher', key: 'Period' },
  { id: 'magnifier', label: 'Magnifier on/off', key: 'KeyM' },
  { id: 'magZoom', label: 'Magnifier: change power', key: 'KeyN' },
  { id: 'measure', label: 'Measure the longest side', key: 'KeyT' },
  { id: 'trueSize', label: 'True-size view on/off', key: 'KeyG' },
];

export class KeyMap {
  constructor(slug) {
    this.key = `${slug}:keys`;
    this.map = Object.fromEntries(ACTIONS.map((a) => [a.id, a.key]));
    try { Object.assign(this.map, JSON.parse(localStorage.getItem(this.key) || '{}')); } catch { /* ignore */ }
  }
  actionFor(code) { return Object.keys(this.map).find((id) => this.map[id] === code) || null; }
  set(actionId, code) {
    // swap if the key is already used, so no binding is lost
    const other = this.actionFor(code);
    if (other && other !== actionId) this.map[other] = this.map[actionId];
    this.map[actionId] = code;
    try { localStorage.setItem(this.key, JSON.stringify(this.map)); } catch { /* ignore */ }
  }
  reset() { this.map = Object.fromEntries(ACTIONS.map((a) => [a.id, a.key])); try { localStorage.removeItem(this.key); } catch { /* ignore */ } }
  static pretty(code) {
    return ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.' })[code] || code.replace(/^Key|^Digit/, '');
  }
}
