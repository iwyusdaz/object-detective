#!/usr/bin/env node
/**
 * Render the release poster (1200x630, WebP + JPG, each <= 200 KB) from the
 * REAL scene: the game's own Engine + Gallery + Inspection + RakingLight
 * (scripts/render-page.html on the Vite dev server) with the real CC0
 * Smithsonian scan of the Morse-Vail telegraph key under a low raking light.
 * The WebGL canvas is encoded by Chromium (canvas.toDataURL) — no extra deps.
 * Usage: node scripts/render-poster.mjs
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const port = 5198;
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3500));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`http://127.0.0.1:${port}/scripts/render-page.html?q=high`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.READY && window.D.gallery.ready, null, { timeout: 60_000 });
  await page.evaluate(async () => {
    const { insp, rake, engine } = window.D;
    await insp.show('morse-vail-key');
    insp.view.yaw = -32; insp.view.elev = 16; insp.view.pose = 'upright';
    insp._applyPose();
    insp.fitDistance();
    insp.view.dist *= 0.62;
    insp.view.target.x += 0.02;
    insp._applyCamera();
    rake.setEnabled(true);
    rake.set({ azimuth: 245, elevation: 10, intensity: 5.5 });
    engine.scene.environmentIntensity = 0.32; // keep the unlit side readable
    engine.renderer.toneMappingExposure = 1.15;
  });
  await page.waitForTimeout(2500);
  const enc = async (type, q) => Buffer.from((await page.evaluate(([t, qq]) => {
    window.D.engine.renderOnce();
    return window.D.engine.renderer.domElement.toDataURL(t, qq);
  }, [type, q])).split(',')[1], 'base64');
  for (const [ext, type, quality] of [['webp', 'image/webp', 0.82], ['jpg', 'image/jpeg', 0.86]]) {
    let q = quality; let buf = await enc(type, q);
    while (buf.length > 200 * 1024 && q > 0.4) { q -= 0.06; buf = await enc(type, q); }
    const out = join(root, 'public', `poster-${VERSION}.${ext}`);
    writeFileSync(out, buf);
    console.log(`poster-${VERSION}.${ext}: ${Math.round(statSync(out).size / 1024)} KB (quality ${q.toFixed(2)})`);
    if (statSync(out).size > 200 * 1024) throw new Error(`${ext} poster over the 200 KB budget`);
  }
  console.log('poster rendered from the real scene (Smithsonian CC0 scan in the game renderer)');
} finally {
  await browser.close();
  vite.kill();
}
