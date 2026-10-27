/**
 * Functional tests (scripted playthroughs, standards section 7):
 *  - chapters reachable by keyboard; "All projects" link
 *  - pre-check feedback
 *  - BOTH cases solvable through the UI: tutorial in 3D mode (tools via keys),
 *    main case in 3D mode AND in text mode (parity), with expert scores
 *  - wrong + overconfident verdict is flagged in the debrief (calibration)
 *  - transfer task, wrap-up, save/resume, cinematics (skip, reduced motion)
 *  - tools: raking light, magnifier, measure (cm + in), true size, compare
 * Requires a build made with VITE_TEST_HOOKS=1 for the state checks.
 */
import { test, expect } from '@playwright/test';
import { boot, solveCase, CASES, ITEMS } from './helpers.js';

test('chapters are reachable by keyboard and "All projects" points to /', async ({ page }) => {
  await boot(page);
  const tabs = page.locator('.module-nav button');
  await expect(tabs).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await tabs.nth(i).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.module-nav button').nth(i)).toHaveAttribute('aria-current', 'step');
  }
  await expect(page.getByRole('link', { name: 'All projects' }).first()).toHaveAttribute('href', '/');
});

test('pre-check items give why-feedback and are logged', async ({ page }) => {
  await boot(page);
  const first = page.locator('.assessment-item').first();
  await first.locator('.choice-btn').nth(1).click();
  await expect(first.locator('.feedback')).toContainText('Correct');
  const n = await page.evaluate(() => window.__TEST__.app.record.events.filter((e) => e.verb.display['en-US'] === 'answered').length);
  expect(n).toBeGreaterThan(0);
});

test('tutorial case is solvable in 3D mode with the inspection tools', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: /Start the shift/ }).click();
  await expect(page.locator('canvas#app')).toBeVisible();
  await solveCase(page, 'tutorial');
  await expect(page.locator('.debrief-table tbody tr.row-ok')).toHaveCount(CASES.tutorial.claims.length);
  await expect(page.getByText('This tutorial case is not scored')).toBeVisible();
});

test('main case is solvable in 3D mode: full expert score', async ({ page }) => {
  // Headless Chromium renders WebGL in software; 10 hotspots x tool toggles is slow.
  test.setTimeout(360_000);
  await boot(page);
  await page.locator('.module-nav button').nth(2).click();
  await solveCase(page, 'main');
  const n = CASES.main.claims.length;
  await expect(page.getByText(`Verdicts matching the expert: ${n} of ${n}`)).toBeVisible();
  await expect(page.getByText(`Claims with the key evidence linked correctly: ${n} of ${n}`)).toBeVisible();
  await expect(page.getByText(/Well calibrated|Underconfident/)).toBeVisible();
});

test('main case is solvable in TEXT mode with the same decisions (parity)', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, { textMode: true });
  await expect(page.locator('html')).toHaveAttribute('data-textmode', 'on');
  await page.locator('.module-nav button').nth(2).click();
  await page.locator('.step-nav button', { hasText: 'Inspect' }).click();
  await expect(page.locator('.photo-grid img').first()).toBeVisible();
  await solveCase(page, 'main', { text: true, wrongClaim: 'M5' });
  const n = CASES.main.claims.length;
  await expect(page.getByText(`Verdicts matching the expert: ${n - 1} of ${n}`)).toBeVisible();
  await expect(page.getByText(/Very sure but wrong on: M5/)).toBeVisible();
});

test('text mode: tutorial hints name the right tool; wrong tool gives feedback, not a finding', async ({ page }) => {
  await boot(page, { textMode: true });
  await page.locator('.module-nav button').nth(1).click();
  await page.locator('.step-nav button', { hasText: 'Inspect' }).click();
  await page.locator('.poi-list button[data-poi="f-number"]').click();
  await expect(page.locator('.poi-card .hint')).toContainText('magnifier');
  await page.locator('.look-actions button', { hasText: 'Low raking light' }).click();
  await expect(page.locator('.poi-msg .feedback')).toContainText('Nothing new');
  await page.locator('.look-actions button', { hasText: 'Look closely (magnifier)' }).click();
  await expect(page.locator('.poi-card .transcription')).toContainText('181411');
});

test('transfer task and wrap-up', async ({ page }) => {
  await boot(page, { textMode: true });
  await page.locator('.module-nav button').nth(3).click();
  for (const s of ITEMS.transfer.statements) await page.locator(`input[name="tr-${s.id}"][value="${s.kind}"]`).check();
  for (const c of ITEMS.transfer.claims) await page.locator(`input[name="tr-${c.id}"][value="${c.verdict}"]`).check();
  await page.locator('#transfer-label').fill('Tangent galvanometer, Western Electric, about 1870.');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  const total = ITEMS.transfer.statements.length + ITEMS.transfer.claims.length;
  await expect(page.getByText(`${total} of ${total} match the expert reading.`)).toBeVisible();
  await page.getByRole('button', { name: 'Finish: wrap-up' }).click();
  await expect(page.getByRole('heading', { name: 'Shift complete' })).toBeVisible();
  await expect(page.getByText(`Transfer task: ${total} of ${total}.`)).toBeVisible();
});

test('save and resume: progress survives a reload', async ({ page }) => {
  await boot(page, { textMode: true });
  await page.locator('.module-nav button').nth(1).click();
  await page.locator('.step-nav button', { hasText: 'Inspect' }).click();
  await page.locator('.poi-list button[data-poi="f-materials"]').click();
  await page.locator('.look-actions button', { hasText: 'Look at it' }).click();
  await page.locator('input[name="cls-tutorial-f-materials-s1"][value="observation"]').check();
  await page.reload();
  await page.waitForFunction(() => window.__APP_READY__ === true);
  await expect(page.locator('.module-nav button').nth(1)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.poi-list button[data-poi="f-materials"]')).toContainText('✓');
  const saved = await page.evaluate(() => window.__TEST__.cases.tutorial.engine.state.classifications['f-materials']);
  expect(saved).toEqual({ s1: 'observation' });
});

test('My progress: record is local, downloadable, and Clear my data clears only this project', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.setItem('other-project:progress', '[1]'));
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'My progress' }).click();
  await expect(page.getByText('Nothing is sent anywhere')).toBeVisible();
  await page.getByRole('button', { name: 'Clear my data' }).click();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain('other-project:progress');
  expect(keys.filter((k) => k.startsWith('object-detective:') && k !== 'object-detective:progress')).toEqual([]);
});

test('cinematic S1: captioned, skippable with Esc from the first frame', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { const a = window.__TEST__.app; a.save.s1Seen = false; });
  await page.getByRole('button', { name: /Start the shift/ }).click();
  const overlay = page.locator('.cinematic-overlay');
  await expect(overlay).toBeVisible();
  await expect(page.locator('.cinematic-caption')).toContainText('Lantern Museum (a fictional museum)');
  await expect(page.locator('.cinematic-progress')).toContainText('purpose: orient');
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  // the panel stays usable
  await page.locator('.step-nav button', { hasText: 'Inspect' }).click();
  await expect(page.locator('.poi-list')).toBeVisible();
});

test('reduced motion: cinematics become still frames (no camera flight)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page);
  await page.evaluate(() => { window.__TEST__.app.save.s1Seen = false; });
  await page.getByRole('button', { name: /Start the shift/ }).click();
  await expect(page.locator('.cinematic-overlay')).toBeVisible();
  const samples = [];
  for (let i = 0; i < 3; i++) { samples.push(await page.evaluate(() => window.__TEST__.engine.camera.position.toArray().map((n) => +n.toFixed(4)))); await page.waitForTimeout(300); }
  expect(samples[0]).toEqual(samples[1]);
  expect(samples[1]).toEqual(samples[2]);
  await page.getByRole('button', { name: /Skip cinematic/ }).click();
  await expect(page.locator('.cinematic-overlay')).toBeHidden();
});

test('tools: raking light, magnifier, measure in cm and inches, true size, compare', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.locator('.module-nav button').nth(2).click();
  await page.waitForFunction(() => window.__TEST__.inspection.primary?.id === 'davenport-motor');
  // raking light via sliders
  await page.locator('.tool-pad summary', { hasText: 'Raking light' }).click();
  await page.locator('.tool-pad input[type="checkbox"]').first().check();
  await page.locator('#rake-el').fill('8');
  expect(await page.evaluate(() => window.__TEST__.rake.revealing)).toBe(true);
  // measure (open the collapsed tool group, as a learner would)
  await page.locator('.tool-pad summary', { hasText: 'Measure' }).click();
  await page.getByRole('button', { name: /Measure the longest side/ }).click();
  await expect(page.locator('.measure-out')).toContainText(/cm \(\d+\.\d+ in\)/);
  const m = await page.evaluate(() => window.__TEST__.measure.last.cm);
  expect(Math.abs(m - 38.1) / 38.1).toBeLessThan(0.05); // record: 15 in (38.1 cm)
  // magnifier
  await page.keyboard.press('KeyM');
  expect(await page.evaluate(() => window.__TEST__.magnifier.on)).toBe(true);
  await expect(page.locator('.magnifier-lens')).toBeVisible();
  await page.keyboard.press('KeyM');
  // true size
  await page.keyboard.press('KeyG');
  expect(await page.evaluate(() => window.__TEST__.app.tools.refs.group.visible)).toBe(true);
  await page.keyboard.press('KeyG');
  // compare: two objects, synchronized rotation
  const cmp = page.locator('.tool-pad details', { has: page.locator('summary', { hasText: 'Compare' }) });
  if (!(await cmp.evaluate((d) => d.open))) await cmp.locator('summary').click();
  await page.locator('#compare-select').selectOption('chester-relay');
  await page.waitForFunction(() => window.__TEST__.inspection.slots.length === 2);
  await page.getByRole('button', { name: /Turn object right/ }).click();
  const yaws = await page.evaluate(() => window.__TEST__.inspection.slots.map((s) => +s.holder.rotation.y.toFixed(4)));
  expect(yaws[0]).toBe(yaws[1]);
});

test('mobile emulation (390x844, touch): stacked layout, tools and case panel usable', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await boot(page);
  await page.getByRole('button', { name: /Start the shift/ }).tap();
  await expect(page.locator('.module-nav button').nth(1)).toHaveAttribute('aria-current', 'step');
  const vp = await page.locator('#viewport').boundingBox();
  const panel = await page.locator('#panel').boundingBox();
  expect(panel.y).toBeGreaterThanOrEqual(vp.y + vp.height - 1); // panel stacked below the 3D view
  await page.locator('.step-nav button', { hasText: 'Inspect' }).tap();
  await page.locator('.poi-list button[data-poi="f-materials"]').tap();
  await page.getByRole('button', { name: 'Record what I see' }).tap();
  await expect(page.locator('.poi-card .classify-row').first()).toBeVisible();
  expect(await page.evaluate(() => window.__TEST__.engine.quality.name)).toBe('low');
  await ctx.close();
});

test('WebGL unavailable: fallback message and text mode', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === 'webgl2' ? null : orig.call(this, type, ...rest); };
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__APP_READY__ === true);
  await expect(page.locator('[data-webgl-fallback]')).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('data-textmode', 'on');
  await expect(page.locator('#panel')).toContainText('Welcome to the evening shift');
  await ctx.close();
});
