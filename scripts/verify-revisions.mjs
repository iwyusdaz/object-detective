#!/usr/bin/env node
/**
 * One-off builder verification for the v2 agent-review revisions (OD-V9+).
 * Probes the running app against the four findings, re-shoots the review
 * screenshots, and prints PASS/FAIL lines. Not part of CI.
 * Usage: node scripts/verify-revisions.mjs   (expects a preview server on 4374)
 *
 * Board/card maths use local coordinates on purpose: the evidence-board group
 * has no rotation or scale, so world = local + (5.97, 0, 1.7) exactly.
 */
import { chromium } from '@playwright/test';

const base = 'http://127.0.0.1:4374';
const shot = (p) => `evaluation/reviews/screenshots/${p}`;
let fails = 0;
const check = (id, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`);
  if (!ok) fails++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => { console.log('pageerror', e.message); fails++; });
await page.goto(`${base}/?revisions`);
await page.waitForFunction(() => window.__APP_READY__ === true, null, { timeout: 30_000 });
await page.waitForFunction(
  () => (window.__TEST__.gallery._caseArtefacts || []).filter(Boolean).length === 3,
  null, { timeout: 30_000 },
);
await page.waitForTimeout(2500);

// --- V2-VIS-1: cases dressed with scan copies + Special Elite label cards ---
const vis1 = await page.evaluate(() => {
  const g = window.__TEST__.gallery;
  const artefacts = (g._caseArtefacts || []).map((a) => ({
    present: Boolean(a) && a.visible,
    meshes: (() => { let n = 0; a?.traverse((o) => { if (o.isMesh) n++; }); return n; })(),
  }));
  const cards = [];
  g.cases.forEach((cg) => {
    cg.traverse((o) => {
      if (o.isMesh && o.material?.map?.isCanvasTexture) cards.push({ y: +o.position.y.toFixed(3), z: +o.position.z.toFixed(3) });
    });
  });
  return { artefacts, cards };
});
check('V2-VIS-1 artefacts', vis1.artefacts.length === 3 && vis1.artefacts.every((a) => a.present && a.meshes > 0),
  `${vis1.artefacts.filter((a) => a.present && a.meshes > 0).length}/3 dressed scan copies visible on the case decks`);
check('V2-VIS-1 label cards', vis1.cards.length === 3 && vis1.cards.every((c) => Math.abs(c.z - 0.403) < 0.01 && Math.abs(c.y - 0.74) < 0.01),
  `${vis1.cards.length}/3 canvas label cards on the plinth fronts at z=0.403, y=0.74`);

// --- V2-VIS-2: pinned cards land on the cork (local coords; group at 5.97,0,1.7) ---
const vis2 = await page.evaluate(() => {
  const g = window.__TEST__.gallery;
  const cards = [];
  g.root.children.forEach((c) => {
    if (Math.abs(c.position.x - 5.97) > 0.01 || Math.abs(c.position.z - 1.7) > 0.01) return;
    c.traverse((o) => {
      if (o.isMesh && Math.abs(o.geometry?.parameters?.width - 0.22) < 1e-4) {
        cards.push({ wx: +(o.position.x + 5.97).toFixed(3), wz: +(o.position.z + 1.7).toFixed(3), wy: +o.position.y.toFixed(3) });
      }
    });
  });
  return cards;
});
const onBoard = vis2.length === 4 && vis2.every((c) => Math.abs(c.wx - 5.934) <= 0.08 && c.wz > 1.15 && c.wz < 2.25 && c.wy > 1.17 && c.wy < 2.27);
check('V2-VIS-2 cards on cork', onBoard,
  `4 pinned cards at world x=${vis2.map((c) => c.wx).join('/')} (cork face 5.934 +-0.08), z=${vis2.map((c) => c.wz).join('/')} (cork 1.15..2.25), y=${vis2.map((c) => c.wy).join('/')} (cork 1.17..2.27)`);

// screenshots: welcome (dressed cases), evidence board arrival, archive arrival
await page.screenshot({ path: shot('v2-welcome.png') });
await page.evaluate(() => window.__TEST__.app.iw.glideTo([4.1, 1.5, 1.7], [5.95, 1.7, 1.7], 0.01));
await page.waitForTimeout(800);
await page.screenshot({ path: shot('v2-evidence-board.png') });
const arch = await page.evaluate(() => {
  const app = window.__TEST__.app;
  const entry = [...app.iw.items.values()].find((e) => e.id === 'hotspot-archive');
  app.iw.glideTo(entry.cameraPos, entry.cameraTarget, 0.01);
  return { pos: entry.cameraPos.toArray().map((v) => +v.toFixed(2)), tgt: entry.cameraTarget.toArray().map((v) => +v.toFixed(2)) };
});
await page.waitForTimeout(800);
await page.screenshot({ path: shot('v2-archive-corner.png') });
check('V2-INT-1 archive pose', arch.pos[0] === 6.9 && arch.pos[2] === -1.2,
  `arrival pose ${JSON.stringify(arch.pos)} inside the doorway mouth, target ${JSON.stringify(arch.tgt)}`);

// --- V2-INT-2: drawer collapse gives the width back + engine.resize() ---
const before = await page.evaluate(() => ({ cw: document.getElementById('app').clientWidth, rw: window.__TEST__.engine.renderer.domElement.width }));
await page.locator('button[data-action="toggle-drawer"]').click();
await page.waitForTimeout(600);
const collapsed = await page.evaluate(() => ({
  flag: document.documentElement.dataset.drawerCollapsed,
  cw: document.getElementById('app').clientWidth,
  rw: window.__TEST__.engine.renderer.domElement.width,
  panelPos: getComputedStyle(document.getElementById('panel')).position,
  vw: document.getElementById('viewport').clientWidth,
}));
await page.screenshot({ path: shot('v2-drawer-collapsed.png') });
await page.locator('button[data-action="toggle-drawer"]').click();
await page.waitForTimeout(600);
const expanded = await page.evaluate(() => ({ cw: document.getElementById('app').clientWidth, rw: window.__TEST__.engine.renderer.domElement.width }));
const fullBleed = collapsed.flag === 'true' && collapsed.panelPos === 'absolute' && collapsed.cw === collapsed.vw
  && Math.abs(collapsed.rw / collapsed.cw - before.rw / before.cw) < 0.06;
check('V2-INT-2 full-bleed collapse', fullBleed,
  `canvas ${before.cw}px -> ${collapsed.cw}px (viewport ${collapsed.vw}px), buffer ${before.rw}px -> ${collapsed.rw}px, panel position ${collapsed.panelPos}; expand restores ${expanded.cw}px / buffer ${expanded.rw}px`);

// magnifier measures correctly at the new size (rect-based, resize-safe)
const mag = await page.evaluate(() => {
  const t = window.__TEST__;
  t.magnifier.setEnabled(true);
  t.magnifier.moveTo(0.5, 0.5);
  const ok = t.magnifier.covers({ x: 0.5, y: 0.5 });
  const rect = document.getElementById('app').getBoundingClientRect();
  const el = t.magnifier.el.getBoundingClientRect();
  const onCentre = Math.abs((el.left + el.width / 2) - (rect.left + rect.width / 2)) < 3;
  const r = Math.min(t.magnifier.radiusPx, rect.width * 0.22, rect.height * 0.3);
  const sizeOk = Math.abs(el.width - 2 * r) < 3;
  t.magnifier.setEnabled(false);
  return { ok, onCentre, sizeOk };
});
check('V2-INT-2 magnifier resize-safe', mag.ok && mag.onCentre && mag.sizeOk,
  `lens covers (0.5,0.5) after the collapse/expand cycle, element centred on the canvas: ${mag.onCentre}, radius matches min(110, 22%W, 30%H): ${mag.sizeOk}`);

// --- V2-VIS-4: torch aim syncs the pad slider label in place (case chapter only:
//     the aim handler runs while the inspection camera owns the view) ---
const torch = await page.evaluate(async () => {
  const t = window.__TEST__;
  await t.app.gotoChapter(1, { resume: true });
  await new Promise((r) => setTimeout(r, 1200));
  t.rake.setEnabled(true);
  t.app.tools.refresh();
  const canvas = document.getElementById('app');
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left + rect.width * 0.31, clientY: rect.top + rect.height * 0.4, buttons: 0, bubbles: true }));
  return { az: t.rake.state.azimuth, slider: +document.getElementById('rake-az').value, label: document.querySelector('output[for="rake-az"]').textContent };
});
check('V2-VIS-4 torch label sync', torch.az !== 300 && torch.az === torch.slider && torch.label.startsWith(String(torch.az)),
  `after a mouse aim the state is ${torch.az}deg == slider ${torch.slider}deg == pad label "${torch.label}" (was 300 before the aim)`);

// --- V2-MOT-1: reduced-motion glide is instant (verify-only) ---
const rm = await page.evaluate(() => {
  const t = window.__TEST__;
  t.iw.reducedMotion = true;
  t.iw.camera.position.set(0, 1.5, 2);
  t.iw.glideTo([0, 1.5, -1.5], [0, 1.2, -4.2], 1.15);
  const instant = !t.iw.glide && Math.abs(t.iw.camera.position.z - -1.5) < 0.01;
  t.iw.reducedMotion = false;
  return instant;
});
check('V2-MOT glide instant under reduced motion', rm, 'glideTo() snaps to the destination when reducedMotion is set');

console.log(fails ? `\n${fails} FAILURES` : '\nAll revision checks pass');
await browser.close();
process.exit(fails ? 1 : 0);
