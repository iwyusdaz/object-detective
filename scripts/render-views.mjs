#!/usr/bin/env node
/**
 * render-views.mjs — render each real scan from 6 standard views plus 2 raking-
 * light views through the game's own renderer (Vite dev server +
 * scripts/render-page.html), with the same lighting as the 3D mode.
 * Two uses:
 *  1. builder verification (default, tmp/views): look at the scans before
 *     writing any observation text — only features visible in these renders
 *     are described in content/;
 *  2. text-mode photo sets: `node scripts/render-views.mjs public/assets/photos`
 *     writes content-hashed JPEGs and content/photos.json.
 * Usage: node scripts/render-views.mjs [outDir]   (ONLY=id1,id2 to limit)
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
if (PUBLISH && !ONLY) for (const f of readdirSync(OUT)) rmSync(join(OUT, f));

const objects = JSON.parse(readFileSync(join(root, 'content', 'objects.json'), 'utf8')).objects;
export const VIEWS = [
  ['front', { preset: 'front' }],
  ['back', { preset: 'back' }],
  ['left', { preset: 'left' }],
  ['right', { preset: 'right' }],
  ['top', { preset: 'top' }],
  ['bottom', { preset: 'bottom' }],
  ['raking-top', { preset: 'top', rake: { azimuth: 270, elevation: 8, intensity: 3.5 } }],
  ['raking-front', { preset: 'front', rake: { azimuth: 20, elevation: 10, intensity: 3.5 } }],
];

const port = 5199;
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3500));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: PUBLISH ? { width: 800, height: 600 } : { width: 960, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
try {
  await page.goto(`http://127.0.0.1:${port}/scripts/render-page.html?q=medium`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.READY && window.D.gallery.ready, null, { timeout: 60_000 });
  const photosPath = join(root, 'content', 'photos.json');
  let photos = {};
  try { photos = JSON.parse(readFileSync(photosPath, 'utf8')); } catch { /* first run */ }
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
      const tmp = join(OUT, `${obj.id}-${name}.jpg`);
      await page.screenshot({ path: tmp, type: 'jpeg', quality: PUBLISH ? 72 : 80 });
      if (PUBLISH) {
        const hash = createHash('sha256').update(readFileSync(tmp)).digest('hex').slice(0, 10);
        const final = `${obj.id}-${name}-${hash}.jpg`;
        renameSync(tmp, join(OUT, final));
        photos[obj.id].push({ view: name, file: `assets/photos/${final}` });
      }
      console.log(obj.id, name);
    }
  }
  // Finding close-ups (the evidence each hotspot reveals), for text mode and verification.
  photos._findings ||= {};
  for (const caseId of ['tutorial', 'main']) {
    const cdef = JSON.parse(readFileSync(join(root, 'content', 'cases', `${caseId}.json`), 'utf8'));
    for (const f of cdef.findings) {
      if (ONLY && !ONLY.includes(f.objectId) && !ONLY.includes(f.id)) continue;
      await page.evaluate(async ({ f, front }) => {
        const { insp, rake, gallery } = window.D;
        insp.meta = { [f.objectId]: { frontYaw: front } };
        if (insp.primary?.id !== f.objectId) await insp.show(f.objectId);
        insp.hotspot(f.objectId, f.hotspot);
        if (f.tool === 'raking') { rake.setEnabled(true); rake.set(f.rake || { azimuth: 300, elevation: 9, intensity: 3.5 }); } else { rake.setEnabled(false); gallery.setMode('inspect'); }
      }, { f, front: objects.find((o) => o.id === f.objectId)?.frontYaw || 0 });
      await page.waitForTimeout(700);
      const tmp = join(OUT, `finding-${f.id}.jpg`);
      await page.screenshot({ path: tmp, type: 'jpeg', quality: PUBLISH ? 74 : 80 });
      if (PUBLISH) {
        const hash = createHash('sha256').update(readFileSync(tmp)).digest('hex').slice(0, 10);
        const final = `finding-${f.id}-${hash}.jpg`;
        renameSync(tmp, join(OUT, final));
        photos._findings[f.id] = `assets/photos/${final}`;
      }
      console.log('finding', f.id);
    }
  }
  if (PUBLISH) writeFileSync(photosPath, JSON.stringify(photos, null, 2) + '\n');
} finally {
  await browser.close();
  vite.kill();
}
