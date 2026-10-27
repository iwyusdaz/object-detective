/**
 * "Controls and keys" dialog: lists every key binding (visible) and lets the
 * learner remap any of them (press a new key). Bindings persist per project.
 * @module ui/help
 */
import { h, clear } from './dom.js';
import { ACTIONS, KeyMap } from '../core/keymap.js';
import { openDialog, closeDialog } from '../a11y/focus.js';
import { announce } from '../a11y/announcer.js';

export function openHelp(app, dialog, trigger) {
  const build = () => {
    clear(dialog);
    const rows = ACTIONS.map((a) => {
      const btn = h('button', { type: 'button', 'aria-label': `Change key for ${a.label} (now ${KeyMap.pretty(app.keys.map[a.id])})`, onclick: () => {
        btn.textContent = 'Press a key…';
        const onKey = (e) => {
          e.preventDefault(); e.stopPropagation();
          window.removeEventListener('keydown', onKey, true);
          if (e.code !== 'Escape' && e.code !== 'Tab') { app.keys.set(a.id, e.code); announce(`${a.label}: ${KeyMap.pretty(e.code)}`); }
          build();
          app.tools?.refresh();
          dialog.querySelector(`[data-action-id="${a.id}"]`)?.focus();
        };
        window.addEventListener('keydown', onKey, true);
      } }, KeyMap.pretty(app.keys.map[a.id]));
      btn.dataset.actionId = a.id;
      return h('tr', {}, h('th', { scope: 'row' }, a.label), h('td', {}, btn));
    });
    dialog.append(
      h('h2', { id: 'help-h' }, 'Controls and keys'),
      h('p', {}, 'Every tool also has on-screen buttons and sliders beside the 3D view. Drag on the object to turn it; use the mouse wheel to zoom. In text mode the same decisions use photos and descriptions.'),
      h('table', { class: 'keys-table' }, h('caption', {}, 'Key bindings (select a key to change it)'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Action'), h('th', { scope: 'col' }, 'Key'))), h('tbody', {}, ...rows)),
      h('p', {}, 'Esc skips a cinematic or closes a dialog. Keys do nothing while you are typing in a text box.'),
      h('menu', {},
        h('button', { type: 'button', onclick: () => { app.keys.reset(); build(); app.tools?.refresh(); announce('Keys reset to defaults'); } }, 'Reset to defaults'),
        h('button', { type: 'button', onclick: () => closeDialog(dialog) }, 'Close')),
    );
  };
  build();
  openDialog(dialog, trigger);
}
