/**
 * The Object Detective v3 — entry point (plan 10, scene-first revamp).
 * The v3 template shell (src/v3/, synced with _tools/sync-v3-core.mjs) runs the
 * Lantern Museum after hours (src/od/museum.js), the inspection table and its
 * tools (src/od/stage.js), the five modules (src/od/lessons.js) and the object
 * catalog (content/objects.json). The case logic and its v2 views are unchanged
 * (src/systems/case-engine.js, src/ui/case-*.js) and serve the drawer and text mode.
 */
import './v3/layers.css';
import './v3/type.css';
import './v3/shell.css';
import './styles/case-fonts.css';
import './styles/od-v3.css';
import { createSceneApp } from './v3/app.js';
import catalog from '../content/objects.json';
import records from '../content/records.json';
import models from '../content/models.json';
import textures from '../content/textures.json';
import assets from '../content/assets-v3.json';
import items from '../content/items.json';
import rubric from '../content/rubric.json';
import photos from '../content/photos.json';
import descriptions from '../content/text-mode/descriptions.json';
import cinematics from '../content/cinematics.json';
import tutorial from '../content/cases/tutorial.json';
import main from '../content/cases/main.json';
import { Lessons } from './od/lessons.js';
import { Museum } from './od/museum.js';
import { Stage } from './od/stage.js';
import { url } from './od/kit.js';

const SLUG = window.__SLUG__ || 'object-detective';
window.__SLUG__ = SLUG;

const lessons = new Lessons({ slug: SLUG, content: { records, cases: { tutorial, main }, items, rubric, photos, descriptions, cinematics } });
const mods = lessons.modules();
const app = await createSceneApp({
  slug: SLUG,
  title: 'The Object Detective',
  shortTitle: 'Object Detective',
  lut: url('lut/lantern-night-33.png'),
  modules: mods,
  catalog,
  home: mods[0].view,
  walkable: true,
  titleScreen: { kicker: 'The Lantern Museum (fictional) · real Smithsonian objects', oneLiner: 'An evening shift at a museum after closing. Examine real 3D scans, check the records, and correct a label that claims too much.' },
  practiceObject: 'wall-painting',
  limits: { minRadius: 0.09, maxRadius: 9, minPhi: 0.12, maxPhi: 1.5, minEye: 0.35, eyeHeight: 1.6 },
  buildScene: async (a) => {
    const props = await fetch(url('assets/models/manifest.json')).then((r) => r.json());
    const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
    const museum = new Museum(a, { assets, textures, models, props });
    await museum.build({ phone });
    const stage = new Stage(a, museum, { records: lessons.records, models });
    museum.addMotion(a.motion);
    lessons.bind(a, { museum, stage });
    a.scene = { museum, stage };
    a.lessons = lessons;
    // Detail streams after the learner's first interaction (plan §7 download gate).
    // 'click' too: a screen reader's virtual cursor activates buttons with a click and no pointerdown or keydown.
    const FIRST = ['pointerdown', 'keydown', 'click'];
    // Text mode hides the 3D view, so choosing it is not a reason to stream 3D detail.
    // Decide after this event's own handlers ran (the title's "Use text mode" turns it on);
    // if text mode is on, keep listening and stream on the first interaction after leaving it.
    const textModeOn = () => document.documentElement.dataset.textmode === 'on' || !!document.getElementById('textmode')?.checkVisibility?.();
    const first = () => setTimeout(() => {
      if (textModeOn()) return;
      museum.streamDetail();
      for (const ev of FIRST) window.removeEventListener(ev, first, true);
    }, 0);
    for (const ev of FIRST) window.addEventListener(ev, first, true);
    return {
      colliders: museum.colliders,
      bounds: [-5.6, 9.3, -7.6, 3.6],
      legend: museum.legend(),
      update: () => stage.update(),
    };
  },
});

// Camera controls and tools in the cheat sheet.
app.shell.setControlsHelp([
  ['Inspection tools', 'In a case, the Now card has spot numbers, Lens, Light, Measure, Turn over, True size and Compare. "How the tools work" explains each one.'],
]);

if (__TEST_HOOKS__ && window.__TEST__) Object.assign(window.__TEST__, { lessons, scene: app.scene });
window.__app = app;
