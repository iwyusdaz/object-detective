#!/usr/bin/env node
/**
 * Render the release poster (1200x630, WebP + JPG, each <= 200 KB) from the
 * REAL scene: the game's own Engine + Gallery + Inspection + RakingLight
 * (scripts/render-page.html on the Vite dev server) with the real CC0
 * Smithsonian scan of the Morse-Vail telegraph key under a low raking light.
 * The WebGL canvas is encoded by Chromium (canvas.toDataURL) — no extra deps.
 * A blank/flat frame (renderer never painted, or the scan failed to load) is
 * detected from pixel variance and the render is retried, up to 3 attempts.
 * Stale posters from earlier releases are removed.
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
    const { insp, engine, gallery } = window.D;
    // v2 poster: the living gallery hero view — cases with the real CC0 scans
    // under their spotlights, glowing hotspot rings, moonlit rainy windows.
    await insp.show('morse-vail-key'); // the tutorial object waits on the inspection table
    gallery.setMode('gallery');
    gallery.setCard(true);
    // the harness has no app shell, so build the interaction layer for the rings
    const { InWorldInteractionManager } = await import('/src/v2/in-world-interaction.js');
    const iw = new InWorldInteractionManager({ canvas: document.getElementById('app'), camera: engine.camera, scene: engine.scene, overlayRoot: document.body });
    gallery.registerHotspots(iw, {});
    gallery.setHotspotsVisible(true);
    engine.camera.position.set(2.3, 1.75, 2.4);
    engine.camera.lookAt(-0.4, 1.0, -3.2);
    engine.renderer.toneMappingExposure = 1.12;
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
  // Remove posters from earlier releases so public/ only ships the current pair.
  const { readdirSync, unlinkSync } = await import('node:fs');
  for (const f of readdirSync(join(root, 'public'))) {
    if (/^poster-\d+\.\d+\.\d+\.(webp|jpg)$/.test(f) && !f.startsWith(`poster-${VERSION}.`)) {
      unlinkSync(join(root, 'public', f));
      console.log(`removed stale poster: ${f}`);
    }
  }
  console.log('poster rendered from the real scene (Smithsonian CC0 scan in the game renderer)');
} finally {
  await browser.close();
  vite.kill();
}
