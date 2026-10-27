/**
 * App controller — The Object Detective (Lantern Museum, fictional framing).
 * Chapters: 0 Welcome + pre-check → 1 Case 1 (tutorial) → 2 Case 2 (main,
 * assessed) → 3 Transfer → 4 Wrap-up. Cases run in the shared case panel
 * (same decisions in 3D and text mode); the 3D viewport adds the inspection
 * tools. Save/resume + local xAPI-shaped learning record.
 * @module app
 */
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { loadJSON, hasWebGL2, assetURL } from './core/assets.js';
import { KeyMap } from './core/keymap.js';
import { Shell } from './ui/shell.js';
import { Settings } from './ui/settings.js';
import { ProgressPage } from './ui/progress.js';
import { LearningRecord } from './learning/record.js';
import { MotionPrefs } from './a11y/motion.js';
import { announce } from './a11y/announcer.js';
import { ShotPlayer } from './cinematics/shot-player.js';
import { Gallery } from './scenes/gallery.js';
import { Inspection } from './scenes/inspection.js';
import { RakingLight } from './systems/raking-light.js';
import { Magnifier } from './systems/magnifier.js';
import { Measure } from './systems/measure.js';
import { CaseEngine } from './systems/case-engine.js';
import { CaseView } from './ui/case-view.js';
import { renderWelcome, renderTransfer, renderWrapUp } from './ui/chapters.js';
import { ToolController } from './app-tools.js';
import { openHelp } from './ui/help.js';

export const SLUG = 'object-detective';
window.__SLUG__ = SLUG;
export const CHAPTERS = ['Welcome', 'Case 1: tutorial', 'Case 2: the case label', 'On your own', 'Wrap-up'];
const CASE_FOR_CHAPTER = { 1: 'tutorial', 2: 'main' };
const SAVE_KEY = `${SLUG}:save`;

export class App {
  constructor() {
    document.body.insertAdjacentHTML('afterbegin', '<dialog id="settings-dialog" aria-label="Settings"></dialog><dialog id="progress-dialog" aria-label="My progress"></dialog><dialog id="help-dialog" aria-labelledby="help-h"></dialog>');
    this.shell = new Shell({ slug: SLUG, title: 'The Object Detective — an evening at the Lantern Museum (fictional)', moduleLabels: CHAPTERS, onModuleChange: (i) => this.gotoChapter(i) });
    this.record = new LearningRecord(SLUG);
    this.motion = new MotionPrefs(SLUG);
    this.keys = new KeyMap(SLUG);
    this.save = this._loadSave();
    this.ready = this._init().catch((e) => {
      console.error(e);
      this.shell.panel.textContent = 'Something went wrong loading the case files. Please reload the page.';
    });
  }

  _loadSave() {
    const blank = { chapter: 0, cases: {}, pre: {}, transfer: { cls: {}, verdicts: {}, label: '' }, s1Seen: false, textMode: null };
    try { return { ...blank, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return blank; }
  }

  persist() {
    for (const [id, c] of Object.entries(this.cases || {})) this.save.cases[id] = c.engine.toJSON();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* private mode */ }
  }

  asset(p) { return assetURL(p); }

  async _init() {
    const files = ['objects', 'models', 'textures', 'environment', 'items', 'rubric', 'cinematics', 'photos', 'text-mode/descriptions', 'cases/tutorial', 'cases/main'];
    const loaded = await Promise.all(files.map((f) => loadJSON(`content/${f}.json`)));
    const c = Object.fromEntries(files.map((f, i) => [f, loaded[i]]));
    this.objects = Object.fromEntries(c.objects.objects.map((o) => [o.id, o]));
    this.models = c.models; this.items = c.items; this.rubric = c.rubric; this.photos = c.photos;
    this.descriptions = c['text-mode/descriptions'];
    this.caseDefs = { tutorial: c['cases/tutorial'], main: c['cases/main'] };
    this.cases = {};
    for (const [id, def] of Object.entries(this.caseDefs)) this.cases[id] = { def, engine: new CaseEngine(def, this.save.cases[id]) };

    this.webgl = hasWebGL2();
    if (this.webgl) this._init3D(c);
    else {
      document.getElementById('viewport').insertAdjacentHTML('beforeend', '<div class="webgl-fallback" data-webgl-fallback role="alert"><p>WebGL is not available in this browser, so the 3D view is off. Every task works in <strong>Text mode</strong>, which is now on.</p></div>');
    }
    this._initDialogs();
    const startText = !this.webgl || this.save.textMode === true;
    this.shell.setTextMode(startText, { silent: true });
    this.shell.on('textmode', () => this.setTextMode(!this.shell.textMode));
    this.shell.on('replay-s1', () => this.playS1());
    this.shell.on('restart', () => this.restartAll());
    this.gotoChapter(this.save.chapter || 0, { resume: true });
    if (__TEST_HOOKS__) {
      window.__TEST__ = { app: this, engine: this.engine, cases: this.cases, inspection: this.inspection, rake: this.rake, magnifier: this.magnifier, measure: this.measure, gallery: this.gallery, player: this.player, scene: this.engine?.scene };
    }
    window.__APP_READY__ = true;
  }

  _init3D(c) {
    const canvas = document.getElementById('app');
    this.engine = new Engine(canvas, { preserveDrawingBuffer: new URLSearchParams(location.search).has('poster') });
    this.engine.quality.restore();
    this.gallery = new Gallery(this.engine.scene, this.engine.renderer, c.textures, c.environment.hdri);
    this.inspection = new Inspection(this.engine, this.models, this.objects);
    this.rake = new RakingLight(this.engine.scene, this.gallery);
    this.magnifier = new Magnifier(this.engine, this.inspection, this.shell.overlays);
    this.measure = new Measure(this.engine, this.inspection);
    this.tools = new ToolController(this);
    const applyQuality = () => {
      const p = this.engine.quality.presetDef;
      this.engine.renderer.shadowMap.enabled = true; // raking-light shadows are a learning cue on every preset
      this.gallery.setShadowSize(p.shadowMapSize);
      this.rake.light.shadow.mapSize.setScalar(Math.max(1024, p.shadowMapSize));
      this.rake.light.shadow.map?.dispose(); this.rake.light.shadow.map = null;
    };
    applyQuality();
    this.engine.quality.onChange(applyQuality);
    this.player = new ShotPlayer({ container: document.getElementById('cinematic-host'), camera: this.engine.camera, motion: this.motion, onDone: () => this._afterCinematic(), onSkip: (id) => this.record.log('experienced', { id: `cinematic-${id}-skipped`, name: 'Cinematic skipped' }),
      captionsOn: () => this.settings?.state.captions !== false,
      inertTargets: () => [this.shell.panel, document.querySelector('.tool-pad'), this.shell.moduleNav, document.querySelector('.app-header, header')] });
    this.cinematics = c.cinematics;
    this.engine.start();
  }

  _initDialogs() {
    this.settings = new Settings({ slug: SLUG, dialog: document.getElementById('settings-dialog'), quality: this.engine?.quality, motion: this.motion,
      onFov: (fov) => this.applyFov(fov) });
    // Saved text size / contrast / FOV apply at start-up without moving the camera.
    this.settings.applyDisplay();
    this.applyFov(this.settings.state.fov, { restage: false });
    this.shell.on('settings', (btn) => this.settings.open(btn));
    this.progressPage = new ProgressPage({ slug: SLUG, dialog: document.getElementById('progress-dialog'), record: this.record });
    this.shell.on('progress', (btn) => this.progressPage.open(btn));
    this.shell.on('help', (btn) => openHelp(this, document.getElementById('help-dialog'), btn));
  }

  /** True when the inspection camera owns the view (a case or the transfer task). */
  inInspection() { return Boolean(CASE_FOR_CHAPTER[this.chapter]) || this.chapter === 3; }

  /**
   * FOV comfort setting. Re-frames the inspection camera only inside a case;
   * on Welcome / Wrap-up it keeps the gallery hero view (agent review V3).
   */
  applyFov(fov, { restage = true } = {}) {
    if (!this.engine) return;
    this.engine.camera.fov = Math.min(70, Math.max(30, fov * 0.75));
    this.engine.camera.updateProjectionMatrix();
    if (!restage || this.player?.playing) return;
    if (this.inInspection()) { this.inspection.fitDistance(); this.inspection._applyCamera(); } else this._stageGallery();
  }

  setTextMode(on) {
    this.shell.setTextMode(on);
    this.save.textMode = on;
    this.persist();
    if (this.player?.playing) this.player.skip();
    this.magnifier?.setEnabled(false);
    this.gotoChapter(this.chapter, { keepStep: true });
  }

  /* ---------------- chapters ---------------- */
  gotoChapter(i, { resume = false, keepStep = false } = {}) {
    const prevStep = this.view?.step;
    this.chapter = i;
    this.save.chapter = i;
    this.shell.setModule(i);
    this.record.log('experienced', { id: `chapter-${i}`, name: CHAPTERS[i] });
    const caseId = CASE_FOR_CHAPTER[i];
    this.tools?.setVisible(Boolean(caseId) || i === 3);
    if (caseId) {
      const { def, engine } = this.cases[caseId];
      this.view = new CaseView({ panel: this.shell.panel, def, engine, objects: this.objects, photos: this.photos, descriptions: this.descriptions, rubric: this.rubric, hooks: this._hooks(caseId) });
      const step = keepStep && prevStep ? prevStep : engine.state.submitted ? 'debrief' : resume && engine.state.discovered.length ? 'inspect' : 'brief';
      this._stage(def.objects[0]);
      this.view.render(step);
      this.tools?.refresh();
      this.shell.setStatus(`${CHAPTERS[i]}: ${def.claims.length} claims to check.`);
    } else {
      this.view = null;
      if (i === 0) { renderWelcome(this, this.shell.panel); this._stageGallery(); }
      if (i === 3) { renderTransfer(this, this.shell.panel); this._stage(this.items.transfer.objectId); this.tools?.refresh(); }
      if (i === 4) { renderWrapUp(this, this.shell.panel); this._stageGallery(); }
      this.shell.setStatus(CHAPTERS[i]);
    }
    this.persist();
    if (!resume) this.shell.panel.focus({ preventScroll: true });
  }

  startTutorial() {
    this.gotoChapter(1);
    if (!this.save.s1Seen && this.engine && !this.shell.textMode) this.playS1();
  }

  _stageGallery() {
    if (!this.engine) return;
    this.gallery.setMode('gallery');
    this.gallery.setCard(true);
    this.inspection.setVisible(true);
    this.engine.camera.position.set(2.6, 1.7, 2.2);
    this.engine.camera.lookAt(0, 1.0, -2.6);
  }

  async _stage(objectId) {
    if (!this.engine) return;
    this.gallery.setCard(this.chapter === 1 || this.chapter === 2);
    this.rake.setEnabled(this.rake.on);
    if (!this.rake.on) this.gallery.setMode('inspect');
    if (this.inspection.primary?.id !== objectId || this.inspection.slots.length !== 1) await this.inspection.show(objectId);
    else { this.inspection.fitDistance(); this.inspection._applyCamera(); }
    this.tools?.refresh();
  }

  _hooks(caseId) {
    return {
      isTextMode: () => this.shell.textMode,
      asset: (p) => this.asset(p),
      save: () => this.persist(),
      log: (verb, obj, result) => this.record.log(verb, obj, result),
      announce: (m) => announce(m),
      showObject: (id) => this._stage(id),
      gotoHotspot: async (id, hs) => {
        if (!this.engine || this.shell.textMode) return;
        if (this.inspection.primary?.id !== id || this.inspection.slots.length !== 1) await this.inspection.show(id);
        this.inspection.hotspot(id, hs);
        this.tools.lensToHotspot();
        announce(`Camera moved to: ${hs.label}`);
        this.tools.refresh();
      },
      activeTools: (id, hs) => this.tools ? this.tools.activeFor(id, hs) : new Set(['view']),
      whyNotRevealed: (id, hs, tool) => this.tools?.whyNotRevealed(id, hs, tool) || null,
      onSubmitted: () => { if (caseId === 'main') this.shell.setStatus('Case 2 submitted. See the debrief.'); },
      canPlayReveal: () => caseId === 'main' && Boolean(this.engine) && !this.shell.textMode,
      playReveal: () => this.playS2(),
      nextChapter: () => this.gotoChapter(caseId === 'tutorial' ? 2 : 3),
      restartCase: () => { this.cases[caseId].engine = new CaseEngine(this.caseDefs[caseId]); this.persist(); this.gotoChapter(this.chapter); },
    };
  }

  restartAll() {
    for (const id of Object.keys(this.cases)) this.cases[id].engine = new CaseEngine(this.caseDefs[id]);
    this.save = { ...this._loadSave(), chapter: 0, cases: {}, pre: {}, transfer: { cls: {}, verdicts: {}, label: '' }, s1Seen: false };
    this.persist();
    this.gotoChapter(0);
    announce('The game has been restarted.');
  }

  /* ---------------- cinematics (S1 orient, S2 reveal) ---------------- */
  playS1() {
    if (!this.player) return;
    this._cine = 'S1';
    this.inspection.cameraLocked = true;
    this.magnifier.setEnabled(false);
    this.gallery.setMode('gallery');
    this.gallery.setCard(true);
    this.player.load({ id: 'S1', shots: this.cinematics.shots.filter((s) => s.id === 'S1') });
    this.record.log('experienced', { id: 'cinematic-S1', name: 'After hours (cinematic)' });
    this.player.play();
  }

  playS2() {
    if (!this.player) return;
    const slot = this.inspection.primary;
    const engine = this.cases.main.engine;
    this.gallery.showInCase(slot?.model || null, engine.state.label || this.caseDefs.main.label.exemplar);
    this._cine = 'S2';
    this.inspection.cameraLocked = true;
    this.magnifier.setEnabled(false);
    this.gallery.setMode('gallery');
    this.player.load({ id: 'S2', shots: this.cinematics.shots.filter((s) => s.id === 'S2') });
    this.record.log('experienced', { id: 'cinematic-S2', name: 'The reveal (cinematic)' });
    this.player.play();
  }

  _afterCinematic() {
    if (this._cine === 'S1') { this.save.s1Seen = true; this.persist(); }
    this._cine = null;
    if (!this.engine) return;
    this.inspection.cameraLocked = false;
    this.gallery.showInCase(null);
    if (CASE_FOR_CHAPTER[this.chapter] || this.chapter === 3) {
      this.gallery.setMode(this.rake.on ? 'raking' : 'inspect');
      this.inspection.fitDistance();
      this.inspection._applyCamera();
    } else this._stageGallery();
    this.shell.panel.focus({ preventScroll: true });
  }
}

export { THREE };
