/**
 * Sub-path test (build contract 08 5.6): dist/ copied to tmp/play/<slug>/ and
 * served from /play/<slug>/ on a local static server (port 4380):
 * no failed requests, no console errors, canvas or WebGL fallback, text mode
 * opens, "All projects" links to `/`. Then Case 1 loads a scan and the
 * streamed KTX2 exhibits and paintings from the sub-path.
 * Run: npm run build && SLUG=object-detective npx playwright test tests/sub-path.spec.js
 */
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { cpSync, mkdirSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const SLUG = process.env.SLUG || 'object-detective';
const ROOT = 'tmp';
const DIST = 'dist';
const PLAY_DIR = join(ROOT, 'play', SLUG);
const PORT = 4380;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.hdr': 'image/vnd.radiance', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
};

let server;
test.beforeAll(async () => {
  expect(existsSync(DIST), 'dist/ must exist — run `npm run build` first').toBe(true);
  rmSync(join(ROOT, 'play'), { recursive: true, force: true });
  mkdirSync(PLAY_DIR, { recursive: true });
  cpSync(DIST, PLAY_DIR, { recursive: true });
  server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(ROOT, urlPath.replace(/^\/+/, '') || 'index.html');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
});
test.afterAll(() => new Promise((r) => server.close(r)));

test(`sub-path /play/${SLUG}/ loads with no failed requests or console errors`, async ({ page }) => {
  test.setTimeout(90_000);
  const failed = []; const errors = [];
  page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.url()} -> ${r.status()}`); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://127.0.0.1:${PORT}/play/${SLUG}/`, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.waitForFunction(() => window.__APP_READY__ === true, null, { timeout: 30_000 });

  const canvas = page.locator('canvas');
  const fallback = page.locator('[data-webgl-fallback]');
  const canvasOk = (await canvas.count()) > 0 && ((await canvas.first().boundingBox())?.height ?? 0) > 0;
  expect(canvasOk || (await fallback.count()) > 0).toBe(true);

  // Text mode opens (from the title screen).
  await page.getByRole('button', { name: /text mode/i }).first().click();
  await expect(page.locator('#textmode')).toBeVisible();
  await expect(page.locator('#textmode')).not.toBeEmpty();

  const link = page.getByRole('link', { name: /all projects/i }).first();
  await expect(link).toHaveAttribute('href', '/');

  // v3: Case 1 loads a real scan (Draco, self-hosted decoders) and the streamed
  // exhibits and paintings (KTX2 through the patched Basis transcoder) from the sub-path.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://127.0.0.1:${PORT}/play/${SLUG}/`, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.getByRole('button', { name: /^start$/i }).click();
  await page.getByRole('button', { name: /skip practice/i }).click();
  await page.locator('[data-ui="module-step"]').nth(1).click();
  await page.waitForTimeout(8000);
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  expect(failed, `failed requests:\n${failed.join('\n')}`).toEqual([]);
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
