/**
 * Accessibility: axe-core on the HTML overlay in every major state (welcome,
 * each case step, tool pad, dialogs, text mode, transfer, wrap-up).
 * Gate: zero critical or serious violations (WCAG 2.0/2.1 A + AA tags).
 * Also: keyboard-only start of a case, and focus moves into the panel.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boot } from './helpers.js';

async function scan(page, label) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('canvas').analyze();
  const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  if (bad.length) console.log(`axe violations (${label}):`, JSON.stringify(bad.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })), null, 2));
  expect(bad, label).toEqual([]);
}

test('3D mode overlay: no critical or serious axe issues in any state', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await scan(page, 'welcome + pre-check');
  await page.locator('.assessment-item .choice-btn').first().click();
  await scan(page, 'pre-check feedback');
  await page.locator('.module-nav button').nth(2).click();
  await scan(page, 'case brief');
  await page.locator('.step-nav button', { hasText: 'Inspect' }).click();
  await page.locator('.poi-list button').first().click();
  await page.getByRole('button', { name: 'Record what I see' }).click();
  for (const s of ['Raking light', 'Magnifier', 'Measure', 'True size', 'Compare']) await page.locator('.tool-pad summary', { hasText: s }).click();
  await scan(page, 'inspect + tool pad expanded');
  await page.locator('.step-nav button', { hasText: 'Archive' }).click();
  const docs = page.locator('.step-body details.doc-card > summary');
  for (let i = 0; i < await docs.count(); i++) await docs.nth(i).click();
  await scan(page, 'archive with documents open');
  await page.locator('.step-nav button', { hasText: 'Evidence board' }).click();
  await scan(page, 'evidence board');
  await page.locator('.step-nav button', { hasText: 'Label' }).click();
  await scan(page, 'label writer');
  for (const [btn, label] of [['Settings', 'settings dialog']]) {
    await page.getByRole('button', { name: btn }).first().click();
    await scan(page, label);
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Menu' }).click();
  await scan(page, 'menu dialog');
  await page.getByRole('button', { name: 'Controls and keys' }).click();
  await scan(page, 'controls and keys dialog');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'My progress' }).click();
  await scan(page, 'progress dialog');
});

test('text mode: no critical or serious axe issues (inspect, transfer, wrap-up)', async ({ page }) => {
  await boot(page, { textMode: true });
  await page.locator('.module-nav button').nth(1).click();
  await page.locator('.step-nav button', { hasText: 'Inspect' }).click();
  await page.locator('.poi-list button').first().click();
  await page.locator('.look-actions button').nth(1).click();
  await scan(page, 'text-mode inspect with finding');
  await page.locator('.module-nav button').nth(3).click();
  await scan(page, 'transfer task');
  await page.locator('.module-nav button').nth(4).click();
  await scan(page, 'wrap-up');
});

test('high contrast + large text settings: no critical or serious axe issues', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { document.documentElement.dataset.contrast = 'high'; document.documentElement.dataset.textSize = 'xlarge'; });
  await page.locator('.module-nav button').nth(1).click();
  await scan(page, 'high contrast case brief');
});

// Stand-in for a screen-reader pass (none was run): the accessibility tree a
// screen reader would get in text mode exposes the finding, its transcription
// and the classify controls with names. This is NOT a real screen-reader test.
test('text mode accessibility tree (ariaSnapshot): finding, transcription and controls are named', async ({ page }) => {
  await boot(page, { textMode: true });
  await page.locator('.module-nav button').nth(1).click();
  await page.locator('.step-nav button', { hasText: 'Inspect' }).click();
  await page.locator('.poi-list button[data-poi="f-number"]').click();
  await page.locator('.look-actions button', { hasText: 'Look closely (magnifier)' }).click();
  const tree = await page.locator('#panel').ariaSnapshot();
  expect(tree).toContain('heading "End of the wooden base (painted number)"');
  expect(tree).toMatch(/strong: "Transcription:"\s*\n\s*- text: 181411/);
  expect(tree).toMatch(/radio "Observation"/);
  expect(tree).toMatch(/radio "Inference"/);
  expect(tree).toMatch(/img "End of the wooden base/);
});

test('keyboard only: start the game and reach the case file', async ({ page }) => {
  await boot(page);
  const start = page.getByRole('button', { name: /Start the shift/ });
  await start.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.module-nav button').nth(1)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#panel')).toBeFocused();
  // Tab reaches the step navigation inside the panel
  await page.keyboard.press('Tab');
  const tag = await page.evaluate(() => document.activeElement.closest('#panel') !== null);
  expect(tag).toBe(true);
});
