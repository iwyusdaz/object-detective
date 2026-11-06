/**
 * axe-core checks (0 critical or serious, WCAG 2.0/2.1/2.2 A + AA tags) on the
 * v3 states: title, practice, the Welcome card, an open info card, each module,
 * the Case 1 inspect card with its tools, every case drawer (draft card,
 * records, evidence board, label writer, debrief, tools help), the transfer
 * drawers, the shift report, the menu, the objects list and text mode.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ready } from './helpers.js';

async function scan(page, label) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = r.violations.filter((v) => ['critical', 'serious'].includes(v.impact));
  expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
const T = (page, fn, arg) => page.evaluate(fn, arg);

test('axe: 0 critical/serious on every v3 state', async ({ page }) => {
  test.setTimeout(600_000);
  await page.addInitScript(() => { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1'); } });
  await ready(page);
  await scan(page, 'title');
  await page.getByRole('button', { name: /^start$/i }).click();
  await scan(page, 'practice');
  await page.getByRole('button', { name: /skip practice/i }).click();
  await page.waitForTimeout(1500);
  await scan(page, 'welcome');
  await T(page, () => window.__TEST__.inspect.open('wall-painting'));
  await page.waitForTimeout(800);
  await scan(page, 'info card');
  await page.keyboard.press('Escape');
  for (const i of [1, 2, 3, 4]) {
    await T(page, (n) => window.__TEST__.app.goModule(n), i);
    await page.waitForTimeout(2500);
    await scan(page, `m${i + 1}`);
  }
  // Case 1: the inspect card with the lens and the light sliders, then each drawer.
  await T(page, () => window.__TEST__.app.goModule(1));
  await page.waitForTimeout(2500);
  await T(page, async () => { const L = window.__TEST__.lessons; L._setCaseStep('tutorial', 'inspect'); await L.chooseSpot('f-underside'); L.toggle('light'); L.toggle('lens'); });
  await page.waitForTimeout(800);
  await scan(page, 'case 1 inspect tools');
  await T(page, () => { const L = window.__TEST__.lessons; L.toggle('light'); L.toggle('lens'); });
  for (const step of ['brief', 'archive', 'board', 'label', 'debrief', 'tools']) {
    await T(page, (s) => window.__TEST__.lessons.openCaseDrawer('tutorial', s), step);
    await page.waitForTimeout(700);
    await scan(page, `case 1 drawer ${step}`);
    await page.keyboard.press('Escape');
  }
  await T(page, () => window.__TEST__.app.goModule(3));
  await page.waitForTimeout(2000);
  await T(page, () => window.__TEST__.lessons._openTransferCard());
  await page.waitForTimeout(600);
  await scan(page, 'visitor card');
  await page.keyboard.press('Escape');
  await T(page, () => window.__TEST__.lessons._openTransferSentence());
  await page.waitForTimeout(600);
  await scan(page, 'label sentence');
  await page.keyboard.press('Escape');
  await T(page, () => window.__TEST__.app.goModule(4));
  await page.waitForTimeout(2000);
  await page.locator('[data-ui="now-card"] [data-action="now-primary"]').click();
  await page.waitForTimeout(600);
  await scan(page, 'shift report');
  await page.keyboard.press('Escape');
  await page.locator('[data-action="menu"]').click();
  await scan(page, 'menu');
  await page.locator('[data-ui="objects-list-toggle"]').click();
  await page.waitForTimeout(600);
  await scan(page, 'objects list');
  await page.keyboard.press('Escape');
  await T(page, () => window.__TEST__.ui.toggleTextMode());
  await page.waitForTimeout(1200);
  await scan(page, 'text mode');
});
