#!/usr/bin/env node
/**
 * capture-cc0-proof.mjs — CC0 proof screenshots for research/object-verification-log.md.
 *
 * Recon (2026-10-27): 3d.si.edu, collections.si.edu and si.edu return HTTP 403
 * to automated browsers from this machine (tried headless Chromium with a
 * realistic User-Agent). The two Smithsonian endpoints that DO respond are:
 *   1. the Open Access API record (api.si.edu) — machine-readable licence fields,
 *   2. the Voyager 3D viewer page for the 3D package (3d-api.si.edu).
 * For each object this script screenshots both. On the API page it wraps the
 * literal text `"access": "CC0"` occurrences in <mark> (visual highlight only;
 * the response text is not changed) and scrolls the first one into view.
 * Output: research/cc0-proof/<slug>-api.jpg, <slug>-voyager.jpg, capture-log.json.
 * Usage: SI_API_KEY=DEMO_KEY node scripts/capture-cc0-proof.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'research', 'cc0-proof');
mkdirSync(OUT, { recursive: true });
const KEY = process.env.SI_API_KEY || 'DEMO_KEY';
const CACHE = join(root, 'data', 'raw', 'si3d.json');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const TARGETS = [
  { slug: 'morse-vail-key', id: 'ld1-1643398853934-1643398870277-0', pkg: 'ed99f44d-3c60-4111-b666-e2908e1b64ef' },
  { slug: 'davenport-motor', id: 'ld1-1643398853934-1643398870885-0', pkg: 'a18922b9-a00f-4c9e-988a-f526382b15cc' },
  { slug: 'henry-trough-battery', id: 'ld1-1643398853934-1643398870231-1', pkg: '1f7d20f0-6b3f-4780-b754-91c2f9f91602' },
  { slug: 'chester-relay', id: 'ld1-1643398853934-1643398876321-0', pkg: 'd44e9327-834b-47b7-aad6-6c416c9e1cbb' },
  { slug: 'page-induction-coil', id: 'ld1-1643398853934-1643398871180-0', pkg: '40cf5b52-0b21-4063-95fc-aa07998eb4dd' },
  { slug: 'tangent-galvanometer', id: 'ld1-1643398853934-1643398875223-0', pkg: 'b8360103-172b-4ab2-a6ac-ab7ee9786876' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1100, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
const log = [];
const prevLog = existsSync(join(OUT, 'capture-log.json')) ? JSON.parse(readFileSync(join(OUT, 'capture-log.json'), 'utf8')) : [];
for (const t of TARGETS) {
  if (ONLY && !ONLY.includes(t.slug)) { const p = prevLog.find((e) => e.slug === t.slug); if (p) log.push(p); continue; }
  // 1) Open Access API record (licence fields)
  const apiUrl = `https://api.si.edu/openaccess/api/v1.0/content/${t.id}?api_key=${KEY}`;
  const entry = { slug: t.slug, apiUrl: apiUrl.replace(KEY, 'DEMO_KEY'), voyagerUrl: `https://3d-api.si.edu/voyager/3d_package:${t.pkg}`, capturedAt: new Date().toISOString() };
  try {
    const res = await page.goto(apiUrl, { waitUntil: 'load', timeout: 45_000 });
    entry.apiStatus = res?.status();
    let json;
    if (res?.status() === 429 && existsSync(CACHE)) {
      // DEMO_KEY rate limit: use the response saved earlier from the same API
      // (the category search, retrieved 2026-10-27) and say so on the image.
      const row = JSON.parse(readFileSync(CACHE, 'utf8')).response.rows.find((r) => r.id === t.id);
      json = { cachedFrom: 'api.si.edu/openaccess/api/v1.0/category/history_culture/search (saved 2026-10-27, data/raw/si3d.json)', response: row };
      entry.source = 'cached search response';
      await page.setContent('<body></body>');
      await page.evaluate((txt) => { document.body.innerText = txt; }, JSON.stringify(json));
    } else {
      json = JSON.parse(await page.evaluate(() => document.body.innerText));
      entry.source = 'live content endpoint';
    }
    const dn = json.response.content.descriptiveNonRepeating;
    entry.recordId = dn.record_ID;
    entry.recordAccess = dn.metadata_usage?.access;
    entry.media3dAccess = (dn.online_media?.media || []).filter((m) => m.type === '3d_voyager').map((m) => m.usage?.access);
    // pretty-print the real response and highlight the licence fields
    await page.evaluate((txt) => {
      const pretty = JSON.stringify(JSON.parse(txt), null, 2);
      const esc = pretty.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      document.body.innerHTML = `<pre style="font:12px/1.35 monospace;white-space:pre-wrap">${esc.replace(/"access": "CC0"/g, '<mark>"access": "CC0"</mark>')}</pre>`;
      const first = document.querySelector('mark');
      first?.scrollIntoView({ block: 'center' });
    }, await page.evaluate(() => document.body.innerText));
    await page.screenshot({ path: join(OUT, `${t.slug}-api.jpg`), type: 'jpeg', quality: 60 });
  } catch (e) { entry.apiError = String(e.message || e).slice(0, 200); }
  // 2) Voyager 3D viewer page (the downloadable 3D package)
  try {
    const res = await page.goto(entry.voyagerUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    entry.voyagerStatus = res?.status();
    await page.waitForTimeout(9000);
    await page.screenshot({ path: join(OUT, `${t.slug}-voyager.jpg`), type: 'jpeg', quality: 60 });
  } catch (e) { entry.voyagerError = String(e.message || e).slice(0, 200); }
  log.push(entry);
  console.log(t.slug, entry.apiStatus, entry.recordAccess, entry.media3dAccess, entry.voyagerStatus, entry.apiError || entry.voyagerError || '');
  await page.waitForTimeout(2500);
}
writeFileSync(join(OUT, 'capture-log.json'), JSON.stringify(log, null, 2) + '\n');
await browser.close();
