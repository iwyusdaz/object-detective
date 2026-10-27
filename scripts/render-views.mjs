#!/usr/bin/env node
/**
 * render-views.mjs — render each real scan from standard views (and under a
 * low raking light) through the game's own renderer, using the Vite dev server
 * and a debug page. Two uses:
 *  1. builder verification: look at the scans before writing any observation
 *     text (only features visible in these renders are described);
 *  2. text-mode photo sets: with OUT=public/assets/photos the images are
 *     written as content-hashed WebP files + content/photos.json.
 * Usage: node scripts/render-views.mjs [outDir]   (default tmp/views)
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, process.argv[2] || 'tmp/views');
const PUBLISH = OUT.includes(join('public', 'assets'));
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
mkdirSync(OUT, { recursive: true });
if (PUBLISH) for (const f of readdirSync(OUT)) rmSync(join(OUT, f));

const models = JSON.parse(readFileSync(join(root, 'content', 'models.json'), 'utf8'));
const objects = JSON.parse(readFileSync(join(root, 'content', 'objects.json'), 'utf8')).objects;
const VIEWS = [
  ['front', { preset: 'front' }],
  ['back', { preset: 'back' }],
  ['left', { preset: 'left' }],
  ['right', { preset: 'right' }],
  ['top', { preset: 'top' }],
  ['bottom', { preset: 'bottom' }],
  ['raking-a', { preset: 'top', rake: { azimuth: 270, elevation: 8, intensity: 3.5 } }],
  ['raking-b', { preset: 'front', rake: { azimuth: 20, elevation: 10, intensity: 3.5 } }],
];

const port = 5199;
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3500));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://127.0.0.1:${port}/tmp/debug.html?q=medium`, { waitUntil: 'load' });
await page.waitForFunction(() => window.READY && window.D.gallery.ready, null, { timeout: 60_000 });
const photos = {};
for (const obj of objects) {
  if (ONLY && !ONLY.includes(obj.id)) continue;
  await page.evaluate(async ({ id, front }) => { window.D.insp.meta = { [id]: { frontYaw: front } }; await window.D.insp.show(id); }, { id: obj.id, front: obj.frontYaw || 0 });
  photos[obj.id] = [];
  for (const [name, v] of VIEWS) {
    await page.evaluate((v) => {
      const { insp, rake, gallery } = window.D;
      insp.preset(v.preset);
      if (v.rake) { rake.setEnabled(true); rake.set(v.rake); } else { rake.setEnabled(false); gallery.setMode('inspect'); }
    }, v);
    await page.waitForTimeout(700);
    const tmp = join(OUT, `${obj.id}-${name}.${PUBLISH ? 'webp' : 'jpg'}`);
    await page.screenshot({ path: tmp, type: PUBLISH ? 'png' : 'jpeg', ...(PUBLISH ? {} : { quality: 80 }) });
    if (PUBLISH) {
      // Chromium screenshots are PNG; re-encode via cwebp-free path: canvas toDataURL
      const dataUrl = await page.evaluate(() => window.D.engine.renderer.domElement.toDataURL('image/webp', 0.8));
      const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
      const hash = createHash('sha256').update(buf).digest('hex').slice(0, 10);
      const final = `${obj.id}-${name}-${hash}.webp`;
      writeFileSync(join(OUT, final), buf);
      rmSync(tmp);
      photos[obj.id].push({ view: name, file: `assets/photos/${final}` });
    }
    console.log(obj.id, name);
  }
}
if (PUBLISH) writeFileSync(join(root, 'content', 'photos.json'), JSON.stringify(photos, null, 2) + '\n');
await browser.close();
vite.kill();
