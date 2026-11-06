/**
 * Shared Playwright helpers. v3: ready(), toModule(), visibleLabels(), pointOn()
 * (same as the template). solveCase() drives a whole case through text mode
 * ("look" actions and the same case views), using the expert answers from
 * content/ (case solvability check).
 */
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const load = (p) => JSON.parse(readFileSync(new URL(`../content/${p}`, import.meta.url), 'utf8'));
export const CASES = { tutorial: load('cases/tutorial.json'), main: load('cases/main.json') };
export const OBJECTS = Object.fromEntries(load('records.json').objects.map((o) => [o.id, o]));
export const ITEMS = load('items.json');

// Software WebGL is slow: functional tests force the Low preset (test-hooks builds only).
export async function ready(page, path = '/?preset=low') {
  await page.goto(path);
  await page.waitForFunction(() => window.__TEST__ && window.__APP_READY__, null, { timeout: 60_000 });
}

/** Jump straight to a module (skips title and practice) and wait for the chapter card and flight. */
export async function toModule(page, i) {
  await page.evaluate((n) => window.__TEST__.app.goModule(n), i);
  await page.waitForTimeout(2200);
}

/** Ids of the in-world labels that are visible now. */
export function visibleLabels(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-ui="world-label"]')]
    .filter((e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    .map((e) => e.dataset.objectId));
}

/** A screen point on the canvas where the inspect pick returns `id` (null when not on screen). */
export function pointOn(page, id) {
  return page.evaluate((oid) => {
    const T = window.__TEST__;
    const s = T.inspect._screenBox(T.inspect.items.get(oid));
    if (!s) return null;
    for (let gy = 2; gy < 10; gy++) for (let gx = 2; gx < 9; gx++) {
      const x = s.left + ((s.right - s.left) * gx) / 10, y = s.top + ((s.bottom - s.top) * gy) / 10;
      if (document.elementFromPoint(x, y)?.id !== 'app') continue;
      if (T.inspect.pick(x, y) === oid) return { x, y };
    }
    return null;
  }, id);
}


export async function boot(page, { textMode = false } = {}) {
  await page.addInitScript((tm) => {
    if (!sessionStorage.getItem('od-test-init')) {
      sessionStorage.setItem('od-test-init', '1');
      for (const k of Object.keys(localStorage)) if (k.startsWith('object-detective:')) localStorage.removeItem(k);
      // skip S1 in most tests; the cinematic tests opt back in
      localStorage.setItem('object-detective:save', JSON.stringify({ s1Seen: true, textMode: tm }));
    }
  }, textMode);
  await page.goto('/');
  await page.waitForFunction(() => window.__APP_READY__ === true, null, { timeout: 30_000 });
}

const LOOK = { view: 'Look at it', magnify: 'Look closely (magnifier)', raking: 'Low raking light', measure: 'Measure it' };
const TOGGLE_KEY = { magnify: 'KeyM', raking: 'KeyR' };

async function use3DTool(page, tool) {
  if (tool === 'measure') { await page.keyboard.press('KeyT'); await expect(page.locator('.measure-out')).toContainText('cm'); return; }
  if (TOGGLE_KEY[tool]) await page.keyboard.press(TOGGLE_KEY[tool]);
}

/** Inspect every finding, classify every statement, open every document, pin, verdict, label, submit. */
export async function solveCase(page, caseId, { text = false, wrongClaim = null } = {}) {
  const def = CASES[caseId];
  await page.locator('.step-nav button', { hasText: 'Inspect' }).click();
  for (const objId of def.objects) {
    if (def.objects.length > 1) await page.locator('.object-chooser button', { hasText: OBJECTS[objId].title }).click();
    for (const f of def.findings.filter((x) => x.objectId === objId)) {
      await page.locator(`.poi-list button[data-poi="${f.id}"]`).click();
      if (text) {
        await page.locator('.look-actions button', { hasText: LOOK[f.tool] }).click();
      } else {
        // A POI clicked right after choosing an object can land mid-load: wait
        // until the staged object is on the table and the camera has actually
        // moved to this spot ("Camera moved to:" announce state) before recording.
        await page.waitForFunction(([oid, hid]) => {
          const i = window.__TEST__?.inspection;
          return i?.primary?.id === oid && i?.view?.hotspot === hid;
        }, [f.objectId, f.hotspot.id], { timeout: 30_000 });
        await use3DTool(page, f.tool);
        await page.getByRole('button', { name: 'Record what I see' }).click();
        if (TOGGLE_KEY[f.tool]) await page.keyboard.press(TOGGLE_KEY[f.tool]); // tool off again
      }
      await expect(page.locator('.poi-card .classify-row').first()).toBeVisible();
      for (const s of f.statements) {
        await page.locator(`input[name="cls-${def.id}-${f.id}-${s.id}"][value="${s.kind}"]`).check();
        await expect(page.locator('.poi-card .feedback-ok').nth(f.statements.indexOf(s))).toBeVisible();
      }
    }
  }
  // Archive: open every document and answer the sourcing questions
  await page.locator('.step-nav button', { hasText: 'Archive' }).click();
  const docs = page.locator('.step-body details.doc-card > summary');
  for (let i = 0; i < await docs.count(); i++) await docs.nth(i).click();
  for (const q of def.sourcingQuestions || []) await page.locator(`input[name="src-${q.id}"][value="${q.correct}"]`).check();
  // Evidence board
  await page.locator('.step-nav button', { hasText: 'Evidence board' }).click();
  for (const c of def.claims) {
    const m = def.expertMap[c.id];
    for (const [rel, ids] of [['supports', m.supports || []], ['contradicts', m.contradicts || []], ['unclear', m.unclear || []]]) {
      for (const id of ids) await page.locator(`select[data-claim="${c.id}"][data-evidence="${id}"]`).selectOption(rel);
    }
    const verdict = c.id === wrongClaim ? (c.verdict === 'confirmed' ? 'refuted' : 'confirmed') : c.verdict;
    await page.locator(`input[name="verdict-${def.id}-${c.id}"][value="${verdict}"]`).check();
    await page.locator(`input[name="conf-${def.id}-${c.id}"][value="${c.id === wrongClaim ? 4 : 3}"]`).check();
  }
  await page.getByRole('button', { name: 'Save verdicts and write the label' }).click();
  // Label writer
  await page.locator('.starters button').first().click();
  await page.locator(`#label-${def.id}`).fill(def.label.exemplar);
  for (const crit of ['accuracy', 'evidence', 'uncertainty', 'clarity']) await page.locator(`input[name="rub-${def.id}-${crit}"][value="3"]`).check();
  await page.getByRole('button', { name: 'Submit the case' }).click();
  await expect(page.getByRole('heading', { name: "The curator's debrief" })).toBeVisible();
  return def;
}
