#!/usr/bin/env node
/**
 * check-content.mjs — content audits that need no browser:
 *  1. alignment coverage: every objective (design/alignment-matrix.md) has
 *     practice + feedback + assessment present in content/;
 *  2. text-mode parity: every finding has a text-mode "look" path (tool),
 *     a description, and a close-up photo; every object has a photo set and a
 *     description;
 *  3. fiction labelling: every fictional document says so;
 *  4. cinematic budget: total <= 90 s, each shot <= 25 s, captions + description
 *     + reduced-motion version present.
 * Exits non-zero on any problem. Usage: node scripts/check-content.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const j = (p) => JSON.parse(readFileSync(join(root, 'content', p), 'utf8'));
const cases = [j('cases/tutorial.json'), j('cases/main.json')];
const items = j('items.json');
const photos = j('photos.json');
const desc = j('text-mode/descriptions.json');
const cine = j('cinematics.json');
const objects = j('objects.json').objects;
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); };

// 1. alignment coverage
const main = cases[1];
const allStatements = cases.flatMap((c) => c.findings.flatMap((f) => f.statements));
ok(allStatements.length >= 20 && allStatements.every((s) => s.why), 'O1: classify items with why-feedback');
ok(items.transfer.statements.length >= 3, 'O1: transfer classify items');
ok((main.sourcingQuestions || []).length >= 2 && main.archive.every((d) => d.sourcing?.author && d.sourcing?.date && d.sourcing?.purpose && d.sourcing?.reliability), 'O2: sourcing for every document + sourcing questions');
ok(Object.keys(main.expertMap).length === main.claims.length && main.claims.every((c) => c.expert), 'O3/O4: expert map + expert reasoning for every claim');
ok(items.transfer.claims.length >= 3 && items.transfer.exemplar, 'O4: transfer claims + exemplar');
ok(items.preCheck.items.length === 4, 'pre-check covers the 4 objectives');
for (const c of cases) ok(c.label?.exemplar, `${c.id}: exemplar label`);

// 2. text-mode parity
for (const c of cases) {
  for (const f of c.findings) {
    ok(['view', 'magnify', 'raking', 'measure'].includes(f.tool), `${f.id}: tool`);
    ok(f.description?.length > 30, `${f.id}: description`);
    ok(photos._findings?.[f.id], `${f.id}: close-up photo (run scripts/render-views.mjs public/assets/photos)`);
  }
}
for (const o of objects) {
  ok((photos[o.id] || []).length >= 8, `${o.id}: photo set (>= 8 views)`);
  ok(desc.objects[o.id]?.description, `${o.id}: text-mode description`);
}

// 3. fiction labelling
for (const c of cases) {
  ok(/fictional document created for this game/i.test(c.fictionalDocument.title), `${c.id}: claim card labelled fictional`);
  for (const d of c.archive.filter((x) => x.kind === 'fictional')) ok(/fictional document created for this game/i.test(d.title), `${d.id}: labelled fictional`);
}
ok(/fictional/i.test(items.transfer.card.title), 'transfer card labelled fictional');

// 4. cinematics
const total = cine.shots.reduce((s, x) => s + x.duration, 0);
ok(total <= 90, `cinematic total ${total}s > 90s`);
for (const s of cine.shots) {
  ok(s.duration <= 25, `${s.id}: > 25 s`);
  ok(s.captions?.length && s.description && s.reducedMotion && s.purpose, `${s.id}: captions/description/reducedMotion/purpose`);
}

if (problems.length) { console.error('content check FAILED:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log(`content check passed: ${cases.reduce((n, c) => n + c.findings.length, 0)} findings, ${allStatements.length} classify items, cinematics ${total}s / 90s`);
