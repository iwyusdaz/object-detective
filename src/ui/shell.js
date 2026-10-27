/**
 * HTML overlay shell (template shell adapted for a side-panel game layout):
 * header with Menu / Settings / Text mode / "All projects" (-> `/`), module
 * navigation, status HUD, and a stage that holds the 3D canvas, a view-control
 * pad, the cinematic host and the learning PANEL (all semantic HTML).
 * Text mode = panel full width, canvas hidden (html[data-textmode="on"]).
 * @module ui/shell
 */
import { openDialog, closeDialog } from '../a11y/focus.js';
import { announce } from '../a11y/announcer.js';

export class Shell {
  constructor({ slug, title, moduleLabels, onModuleChange }) {
    this.slug = slug;
    this.onModuleChange = onModuleChange;
    this.root = document.getElementById('ui');
    this.root.innerHTML = `
      <header class="app-header">
        <p class="app-title"></p>
        <nav aria-label="Main">
          <button type="button" data-action="menu">Menu</button>
          <button type="button" data-action="settings">Settings</button>
          <button type="button" data-action="textmode" aria-pressed="false">Text mode</button>
          <a class="all-projects" href="/">All projects</a>
        </nav>
      </header>
      <nav class="module-nav" aria-label="Chapters"></nav>
      <div class="hud" role="status" aria-live="polite"></div>
      <main class="stage" id="stage">
        <div class="viewport" id="viewport">
          <canvas id="app" role="img"></canvas>
          <div id="overlays"></div>
          <div id="cinematic-host"></div>
        </div>
        <section id="panel" class="panel" tabindex="-1" aria-label="Case file"></section>
      </main>
      <dialog id="menu-dialog" aria-labelledby="menu-dialog-title">
        <h2 id="menu-dialog-title">Menu</h2>
        <ul class="menu-list">
          <li><button type="button" data-action="resume">Resume</button></li>
          <li><button type="button" data-action="replay-s1">Replay opening cinematic (S1)</button></li>
          <li><button type="button" data-action="textmode">Text mode on/off</button></li>
          <li><button type="button" data-action="settings">Settings</button></li>
          <li><button type="button" data-action="help">Controls and keys</button></li>
          <li><button type="button" data-action="progress">My progress</button></li>
          <li><button type="button" data-action="restart">Restart the whole game</button></li>
          <li><a href="/">All projects</a></li>
        </ul>
      </dialog>
    `;
    this.root.querySelector('.app-title').textContent = title;
    this.root.querySelector('#app').setAttribute('aria-label', `${title}: 3D view of the object on the inspection table. Every task can also be done from the case file panel and in text mode.`);
    this.hud = this.root.querySelector('.hud');
    this.moduleNav = this.root.querySelector('.module-nav');
    this.overlays = this.root.querySelector('#overlays');
    this.panel = this.root.querySelector('#panel');
    this.menuDialog = this.root.querySelector('#menu-dialog');
    this._labels = moduleLabels;
    this.listeners = {};
    this._buildModuleNav(0);
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'menu') { openDialog(this.menuDialog, btn); return; }
      if (btn.closest('#menu-dialog')) closeDialog(this.menuDialog);
      this.listeners[action]?.(btn);
    });
  }

  _buildModuleNav(active) {
    this.moduleNav.innerHTML = '';
    this._labels.forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => this.onModuleChange?.(i));
      this.moduleNav.appendChild(b);
    });
    this.setModule(active);
  }

  setModule(i) {
    [...this.moduleNav.children].forEach((b, j) => {
      b.classList.toggle('active', i === j);
      if (i === j) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }

  on(action, fn) { this.listeners[action] = fn; }

  get textMode() { return document.documentElement.dataset.textmode === 'on'; }

  setTextMode(on, { silent = false } = {}) {
    document.documentElement.dataset.textmode = on ? 'on' : 'off';
    for (const b of this.root.querySelectorAll('.app-header [data-action="textmode"]')) b.setAttribute('aria-pressed', String(on));
    document.getElementById('app').style.visibility = on ? 'hidden' : 'visible';
    if (!silent) announce(on ? 'Text mode on. Photos and descriptions replace the 3D view; every decision is the same.' : 'Text mode off. 3D view on.');
  }

  setStatus(text, { announce: doAnnounce = false } = {}) {
    this.hud.textContent = text;
    if (doAnnounce) announce(text);
  }
}
