/**
 * v3 browser tests (headless Chromium, software WebGL, Low preset): the
 * scene-first shell in the Lantern Museum, labels hidden at rest, the
 * clickable world, keyboard-only completion of all five modules, text-mode
 * parity, reduced motion, the circular magnifier (SP-03), touch and the
 * no-WebGL fallback. The GPU gates (performance, alive) run headed in
 * _tools/ui-audit.mjs.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ready, visibleLabels, pointOn, CASES, ITEMS, solveCase } from './helpers.js';
const allObjects = JSON.parse(readFileSync(new URL('../content/objects.json', import.meta.url), 'utf8')).objects;
// Only course-relevant objects (task, learn) are inspectable (owner decision 2026-11-07, DECISIONS OD-V3-10).
const COURSE_IDS = allObjects.filter((o) => o.role === 'task' || o.role === 'learn').map((o) => o.id);
const DECOR_IDS = allObjects.filter((o) => o.role === 'decorative').map((o) => o.id);
/** The first course object with a pickable point on screen. */
async function firstCoursePoint(page) {
  for (const id of COURSE_IDS) { const p = await pointOn(page, id); if (p) return { id, ...p }; }
  return null;
}

const T = (page, fn, arg) => page.evaluate(fn, arg);
const card = (page) => page.locator('[data-ui="now-card"]');
const drawer = (page) => page.locator('[data-ui="drawer"]');
const nowBtn = (page, re) => card(page).locator('button').filter({ hasText: re }).first();

/** Press Tab until `locator` has focus (the real keyboard path), then press `key`. */
async function kb(page, locator, key = 'Enter', max = 300) {
  const el = typeof locator === 'string' ? page.locator(locator).first() : locator;
  await expect(el).toBeVisible();
  for (let i = 0; i < max; i++) {
    const where = await el.evaluate((e) => { const a = document.activeElement; if (a === e) return 0; if (!a || a === document.body) return 1; return a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1; });
    if (where === 0) { if (key) await page.keyboard.press(key); return; }
    await page.keyboard.press(where > 0 ? 'Tab' : 'Shift+Tab');
  }
  throw new Error(`could not reach ${locator} by Tab`);
}
/** A radio group takes one Tab stop (its first radio when none is checked); arrow keys choose. */
async function kbRadio(page, scope, name, value) {
  const radios = scope.locator(`input[type="radio"][name="${name}"]`);
  const values = await radios.evaluateAll((rs) => rs.map((r) => r.value));
  const idx = values.indexOf(String(value));
  expect(idx, `${name}=${value}`).toBeGreaterThanOrEqual(0);
  await kb(page, radios.first(), idx === 0 ? 'Space' : null);
  for (let i = 0; i < idx; i++) await page.keyboard.press('ArrowDown');
  await expect(radios.nth(idx)).toBeChecked();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1'); } });
});

test('title, practice on the painting, then the Welcome card in the dressed gallery', async ({ page }) => {
  await ready(page);
  await expect(page.locator('[data-ui="title-screen"]')).toBeVisible();
  await page.getByRole('button', { name: /^start$/i }).click();
  await expect(card(page)).toContainText(/Practice 1 of 4/);
  await page.getByRole('button', { name: /skip practice/i }).click();
  await expect(card(page)).toContainText('Your evening shift');
  const s = await T(page, () => ({ ids: window.__TEST__.inspect.ids(), legend: document.querySelector('[data-ui="legend"]').textContent }));
  // Every registered object is course-relevant; decorative dressing is not inspectable.
  expect(s.ids.length).toBeGreaterThanOrEqual(8);
  expect(s.ids.filter((id) => !COURSE_IDS.includes(id))).toEqual([]);
});

test('labels are hidden at rest; hover shows one; a click opens the card beside the object', async ({ page }) => {
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(0));
  await page.waitForTimeout(3000);
  expect(await visibleLabels(page)).toEqual([]);
  const p = await firstCoursePoint(page);
  expect(p).not.toBeNull();
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(600);
  expect(await visibleLabels(page)).toContain(p.id);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator(`[data-ui="info-card"][data-object-id="${p.id}"]`)).toBeVisible();
  await expect(page.locator('[data-ui="discovered"]')).toContainText(/1 of \d+/);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ui="info-card"]')).toBeHidden();
  // "Show all labels" shows them all; turning it off hides them again.
  await page.locator('[data-action="menu"]').click();
  await page.locator('[data-action="show-labels"]').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  expect((await visibleLabels(page)).length).toBeGreaterThanOrEqual(3);
});

test('every course object is in the keyboard list or opens by id; the list opens a card by Enter', async ({ page }) => {
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(0));
  await page.waitForTimeout(2500);
  await T(page, () => window.__TEST__.scene.museum.streamDetail());
  await page.waitForFunction((n) => window.__TEST__.inspect.ids().length >= n, COURSE_IDS.length, { timeout: 120_000 });
  const ids = await T(page, () => window.__TEST__.inspect.ids());
  expect(COURSE_IDS.filter((id) => !ids.includes(id))).toEqual([]);
  expect(ids.filter((id) => DECOR_IDS.includes(id))).toEqual([]);
  await page.locator('[data-action="menu"]').click();
  await page.locator('[data-ui="objects-list-toggle"]').click();
  const list = page.locator('[data-ui="objects-list"] [data-object-id]');
  const listed = await list.evaluateAll((els) => els.map((e) => e.dataset.objectId));
  expect(listed.filter((id) => DECOR_IDS.includes(id))).toEqual([]);
  expect(listed.length).toBeGreaterThanOrEqual(3);
  const first = list.first();
  const id = await first.getAttribute('data-object-id');
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-ui="info-card"][data-object-id="${id}"]`)).toBeVisible();
});

/** Case flow through the Now card and the drawers, keyboard only. */
async function kbCase(page, caseId) {
  const def = CASES[caseId];
  // Step 1: the draft card (drawer), closed with Esc.
  await kb(page, nowBtn(page, /Open the draft card/));
  await expect(drawer(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await kb(page, nowBtn(page, /^Next step$/));
  // Step 2: every spot, with the tool it needs, then each statement.
  await expect(card(page)).toContainText(`Step 2 of`);
  for (const objId of def.objects) {
    if (def.objects.length > 1) {
      await kb(page, card(page).locator(`button[aria-label^="${(await T(page, (o) => window.__TEST__.lessons.records[o].title, objId)).replace(/"/g, '\\"')}"]`));
      await page.waitForFunction((o) => window.__TEST__.lessons.stage.primary?.id === o, objId, { timeout: 60_000 });
    }
    const spots = def.findings.filter((f) => f.objectId === objId);
    for (const [k, f] of spots.entries()) {
      await kb(page, card(page).locator(`button[aria-label^="Spot ${k + 1}:"]`));
      await page.waitForTimeout(1500);
      if (f.tool === 'magnify') await kb(page, card(page).locator('button[aria-label="Lens (magnifier)"]'));
      if (f.tool === 'raking') {
        await kb(page, card(page).locator('button[aria-label="Raking light"]'));
        await kb(page, card(page).locator('input[aria-label="Light height"]'), 'Home');
      }
      if (f.tool === 'measure') await kb(page, card(page).locator('button[aria-label="Measure the longest side"]'));
      await page.waitForTimeout(400);
      await kb(page, nowBtn(page, /Record what I see/));
      await expect(card(page)).toContainText('Observation or inference?');
      for (const [si, s] of f.statements.entries()) {
        await kb(page, card(page).locator(`[data-choice="${s.kind}"]`));
        await expect(card(page).locator('.v3-feedback')).toBeVisible();
        await kb(page, nowBtn(page, si < f.statements.length - 1 ? /Next statement/ : /Back to the spots/));
      }
      if (f.tool === 'magnify') await kb(page, card(page).locator('button[aria-label="Lens (magnifier)"]'));
      if (f.tool === 'raking') await kb(page, card(page).locator('button[aria-label="Raking light"]'));
    }
  }
  expect(await T(page, (c) => window.__TEST__.lessons.cases[c].engine.state.discovered.length, caseId)).toBe(def.findings.length);
  await kb(page, nowBtn(page, /^Next step$/));
  // Step 3: the records drawer: open every document, answer the sourcing questions.
  await kb(page, nowBtn(page, /Open the records drawer/));
  for (const s of await drawer(page).locator('details.doc-card > summary').all()) await kb(page, s);
  for (const q of def.sourcingQuestions || []) await kbRadio(page, drawer(page), `src-${q.id}`, q.correct);
  await page.keyboard.press('Escape');
  await kb(page, nowBtn(page, /^Next step$/));
  // Step 4: the evidence board opens in the drawer: pins by typing on the select, verdicts and confidence by arrows.
  await expect(drawer(page)).toContainText('Evidence board');
  for (const c of def.claims) {
    const m = def.expertMap[c.id];
    for (const [rel, ids] of [['s', m.supports || []], ['c', m.contradicts || []], ['u', m.unclear || []]]) {
      for (const id of ids) { await kb(page, drawer(page).locator(`select[data-claim="${c.id}"][data-evidence="${id}"]`), rel); }
    }
    await kbRadio(page, drawer(page), `verdict-${def.id}-${c.id}`, c.verdict);
    await kbRadio(page, drawer(page), `conf-${def.id}-${c.id}`, 3);
  }
  await kb(page, drawer(page).getByRole('button', { name: 'Save verdicts and write the label' }));
  // Step 5: the label writer.
  await expect(drawer(page)).toContainText('Write the corrected label');
  await kb(page, drawer(page).locator(`#label-${def.id}`), null);
  await page.keyboard.type(def.label.exemplar);
  for (const crit of ['accuracy', 'evidence', 'uncertainty', 'clarity']) await kbRadio(page, drawer(page), `rub-${def.id}-${crit}`, 3);
  await kb(page, drawer(page).getByRole('button', { name: 'Submit the case' }));
  await expect(drawer(page)).toContainText("The curator's debrief");
  return def;
}

test('keyboard-only completion of all five modules', async ({ page }) => {
  test.setTimeout(1_500_000);
  await ready(page);
  await kb(page, page.getByRole('button', { name: /^start$/i }));
  await kb(page, page.getByRole('button', { name: /skip practice/i }));
  // Module 1: four warm-up questions, one at a time.
  await kb(page, nowBtn(page, /^Next step$/));
  for (let q = 0; q < ITEMS.preCheck.items.length; q++) {
    await kb(page, card(page).locator('[data-choice]').first());
    await kb(page, nowBtn(page, q < ITEMS.preCheck.items.length - 1 ? /Next question/ : /^Next step$/));
  }
  await kb(page, nowBtn(page, /Start Case 1/));
  // Module 2 and 3: the two cases.
  await expect(card(page)).toContainText('Read the draft card');
  await kbCase(page, 'tutorial');
  await kb(page, drawer(page).getByRole('button', { name: 'Next: Case 2' }));
  await expect(card(page)).toContainText('Read the draft card');
  const main = await kbCase(page, 'main');
  const score = await T(page, () => window.__TEST__.lessons.cases.main.engine.score());
  expect(score.verdictCorrect).toBe(main.claims.length);
  await kb(page, drawer(page).getByRole('button', { name: /Next: on your own/ }));
  // Module 4: the visitor card, the statements and claims, one label sentence.
  await kb(page, nowBtn(page, /Open the visitor card/));
  await page.keyboard.press('Escape');
  await kb(page, nowBtn(page, /^Next step$/));
  const t = ITEMS.transfer;
  for (const s of t.statements) {
    await kb(page, nowBtn(page, s.kind === 'observation' ? /^Observation$/ : /^Inference$/));
    await kb(page, nowBtn(page, /Next question|^Next step$/));
  }
  const VLABEL = { confirmed: /^Confirmed$/, refuted: /^Refuted$/, 'cant-tell': /^Can't tell yet$/ };
  for (const c of t.claims) {
    await kb(page, nowBtn(page, VLABEL[c.verdict]));
    await kb(page, nowBtn(page, /Next question|^Next step$/));
  }
  await kb(page, nowBtn(page, /Open the label sentence/));
  await kb(page, drawer(page).locator('#transfer-label'), null);
  await page.keyboard.type(t.exemplar);
  await kb(page, drawer(page).getByRole('button', { name: 'Check my answers' }));
  await expect(drawer(page)).toContainText(`${t.statements.length + t.claims.length} of ${t.statements.length + t.claims.length} match`);
  await kb(page, drawer(page).getByRole('button', { name: /Finish: wrap-up/ }));
  // Module 5: the shift report.
  await kb(page, nowBtn(page, /Open the shift report/));
  await expect(drawer(page)).toBeVisible();
  await page.keyboard.press('Escape');
  const done = await T(page, () => [...window.__TEST__.shell.done].sort());
  expect(done).toEqual([0, 1, 2, 3, 4]);
});

test('text mode: every module renders, every course object is listed and no decorative one, Case 2 solved with the same engine (parity)', async ({ page }) => {
  test.setTimeout(600_000);
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(2));
  await page.waitForTimeout(2000);
  await T(page, () => window.__TEST__.ui.toggleTextMode());
  const tm = page.locator('#textmode');
  await expect(tm).toBeVisible();
  // Course objects (task, learn) have text-mode cards; decorative ones do not (T-29).
  const names = await T(page, () => window.__TEST__.catalog.inspectable.map((o) => o.name));
  const text = await tm.innerText();
  for (const n of names) expect(text).toContain(n);
  const cardIds = await tm.locator('[data-object-id]').evaluateAll((els) => els.map((e) => e.dataset.objectId));
  for (const id of DECOR_IDS) expect(cardIds).not.toContain(id);
  await solveCase(page, 'main', { text: true });
  const s = await T(page, () => window.__TEST__.lessons.cases.main.engine.score());
  expect(s.verdictCorrect).toBe(CASES.main.claims.length);
  for (const [i, re] of [[0, /warm-up|pre-check/i], [1, /draft card|Inspect/i], [3, /galvanometer/i], [4, /shift report|wrap-up/i]]) {
    await T(page, (n) => window.__TEST__.app.goModule(n), i);
    await page.waitForTimeout(1200);
    await expect(tm).toContainText(re);
  }
});

test('magnifier: a circular lens composited in the scene, no square behind it (SP-03)', async ({ page }) => {
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(1));
  await page.waitForTimeout(3000);
  await T(page, async () => { const L = window.__TEST__.lessons; L._setCaseStep('tutorial', 'inspect'); await L.chooseSpot('f-number'); L.toggle('lens'); });
  await page.waitForTimeout(1500);
  const r = await T(page, () => { const m = window.__TEST__.lessons.stage.magnifier; return { on: m.on, visible: m.lens.visible, shader: m.mat.fragmentShader.includes('discard'), dom: document.querySelectorAll('.magnifier-lens').length, covers: m.covers(window.__TEST__.lessons.stage.hotspotScreen('morse-vail-key', window.__TEST__.lessons.cases.tutorial.def.findings[0].hotspot)) }; });
  expect(r).toEqual({ on: true, visible: true, shader: true, dom: 0, covers: true });
});

test('reduced motion stops the pendulum, the rain and the guard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(0));
  await page.waitForTimeout(3000);
  const snap = () => T(page, () => { const M = window.__TEST__.scene.museum; return [M.clock?.pendulum?.rotation.z ?? null, M.rainMats[0].uniforms.uTime.value]; });
  const a = await snap();
  await page.waitForTimeout(2000);
  expect(await snap()).toEqual(a);
  expect(await T(page, () => window.__TEST__.motion.factor)).toBe(0);
});

test('motion report: at least eight systems on four layers, every label on a card', async ({ page }) => {
  await ready(page);
  const r = await T(page, () => ({ rep: window.__TEST__.motion.report(), problems: window.__TEST__.motion.checkLabels(window.__TEST__.catalog) }));
  expect(r.rep.ok).toBe(true);
  expect(r.rep.total).toBeGreaterThanOrEqual(8);
  expect(r.problems).toEqual([]);
});

// Plan 10 §3: an object on the inspection table is framed at >= 35% of the view height.
async function framedShare(page, module) {
  await T(page, (m) => window.__TEST__.app.goModule(m), module);
  await page.waitForFunction(() => { const S = window.__TEST__.lessons.stage; return S.slots.length && !S.worldBox().isEmpty() && !window.__TEST__.rig.anim; }, null, { timeout: 120_000 });
  await page.waitForTimeout(500);
  return T(page, () => {
    const S = window.__TEST__.lessons.stage; const b = S.worldBox(); const cam = window.__TEST__.engine.camera;
    let y0 = 9, y1 = -9;
    for (let i = 0; i < 8; i++) { const p = b.min.clone().set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(cam); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    return (y1 - y0) / 2;
  });
}
test('case objects on the table fill at least 35% of the view height; true size frames the references too', async ({ page }) => {
  await ready(page);
  for (const m of [1, 2, 3]) expect(await framedShare(page, m)).toBeGreaterThanOrEqual(0.35);
  await framedShare(page, 1);
  await T(page, () => { const L = window.__TEST__.lessons; L._setCaseStep('tutorial', 'inspect'); L.toggle('size'); });
  await page.waitForFunction(() => window.__TEST__.lessons.stage.trueSize && !window.__TEST__.rig.anim, null, { timeout: 30_000 });
  await expect(card(page)).toContainText(/True size: ruler, quarter and card at the same scale/);
});

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('phone held upright: case objects fill at least 35% of the view height', async ({ page }) => {
    await ready(page);
    for (const m of [1, 2, 3]) expect(await framedShare(page, m)).toBeGreaterThanOrEqual(0.35);
  });
  test('a tap on an object opens its card in the bottom sheet', async ({ page }) => {
    await ready(page);
    await T(page, () => window.__TEST__.app.goModule(0));
    await page.waitForTimeout(3000);
    const p = await firstCoursePoint(page);
    expect(p).not.toBeNull();
    await page.touchscreen.tap(p.x, p.y);
    await expect(page.locator(`[data-ui="info-card"][data-object-id="${p.id}"]`)).toBeVisible();
  });
});

test('without WebGL2 the app runs in text mode with every objective', async ({ page }) => {
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' ? null : g.call(this, t, ...a); }; });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => window.__APP_READY__, null, { timeout: 60_000 });
  await expect(page.locator('#textmode')).toBeVisible();
  expect(errors).toEqual([]);
});
test('Back steps back inside a case and closes a card first; Back to start shows the title; no link to all projects', async ({ page }) => {
  await ready(page);
  await expect(page.getByRole('link', { name: /all projects/i })).toHaveCount(0);
  await T(page, () => window.__TEST__.app.goModule(1));
  await page.waitForTimeout(2500);
  await T(page, () => window.__TEST__.lessons._setCaseStep('tutorial', 'inspect'));
  await expect(card(page)).toContainText(/Step 2 of/);
  await T(page, () => window.__TEST__.inspect.open('magnifier'));
  await expect(page.locator('[data-ui="info-card"]')).toBeVisible();
  await page.locator('[data-ui="back"]').click();
  await expect(page.locator('[data-ui="info-card"]')).toBeHidden();
  await expect(card(page)).toContainText(/Step 2 of/);
  await page.locator('[data-ui="back"]').click();
  await expect(card(page)).toContainText(/Step 1 of/);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Back to start' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-ui="title-screen"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /^start$/i })).toBeFocused();
});
test('decorative dressing has no label, card or list entry, and a click on it opens nothing', async ({ page }) => {
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(0));
  await page.waitForTimeout(3000);
  expect(await T(page, () => window.__TEST__.journal.total)).toBe(COURSE_IDS.length);
  const spot = await T(page, (ids) => {
    const T = window.__TEST__;
    const r = T.shell.canvas.getBoundingClientRect();
    const roots = new Map();
    T.engine.scene.traverse((o) => { if (o.userData?.decorative && ids.includes(o.userData.objectId) && !roots.has(o.userData.objectId)) roots.set(o.userData.objectId, o); });
    for (const [id, root] of roots) {
      const box = new (Object.getPrototypeOf(T.inspect._box).constructor)().setFromObject(root);
      const p = box.getCenter(root.position.clone()).project(T.engine.camera);
      if (p.z < -1 || p.z > 1) continue;
      const x = r.left + (p.x + 1) / 2 * r.width, y = r.top + (1 - p.y) / 2 * r.height;
      if (x < 20 || y < 80 || x > r.right - 20 || y > r.bottom - 20 || document.elementFromPoint(x, y)?.id !== 'app') continue;
      const ray = new T.inspect.raycaster.constructor();
      ray.setFromCamera({ x: p.x, y: p.y }, T.engine.camera);
      const hit = ray.intersectObjects(T.engine.scene.children, true).find((h) => h.object.isMesh && !h.object.userData.outlineHull);
      let o = hit?.object; while (o && !o.userData?.objectId) o = o.parent;
      if (o?.userData.objectId === id) return { id, x, y, pick: T.inspect.pick(x, y) };
    }
    return null;
  }, DECOR_IDS);
  expect(spot, 'a decorative object on screen').not.toBeNull();
  expect(spot.pick).toBeNull();
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(400);
  expect(await visibleLabels(page)).toEqual([]);
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(600);
  await expect(page.locator('[data-ui="info-card"]')).toBeHidden();
});
