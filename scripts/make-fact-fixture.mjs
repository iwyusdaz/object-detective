#!/usr/bin/env node
/**
 * make-fact-fixture.mjs — write tests/fixtures/si-records.json, a trimmed copy
 * of the six Smithsonian Open Access records the game uses, holding only the
 * fields the fact audit reads (record ID, title, freetext, CC0 usage/licence
 * fields, and the 3D media entries' type + usage). The records are CC0
 * (metadata_usage.access = "CC0"), so they can be committed; the licence
 * fields are kept so the audit can keep checking them.
 *
 * Source: data/raw/si3d.json (gitignored; saved by fetch-smithsonian-models.mjs).
 * Usage: node scripts/make-fact-fixture.mjs   (optional refresh; CI uses the fixture)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(join(root, 'data', 'raw', 'si3d.json'), 'utf8'));
const objects = JSON.parse(readFileSync(join(root, 'content', 'objects.json'), 'utf8')).objects;
const wanted = new Set(objects.map((o) => o.record.recordId));

const rows = raw.response.rows
  .filter((r) => wanted.has(r.content.descriptiveNonRepeating.record_ID))
  .map((r) => {
    const d = r.content.descriptiveNonRepeating;
    return {
      id: r.id,
      content: {
        freetext: r.content.freetext,
        descriptiveNonRepeating: {
          record_ID: d.record_ID,
          title: d.title,
          guid: d.guid,
          unit_code: d.unit_code,
          data_source: d.data_source,
          metadata_usage: d.metadata_usage,
          online_media: { media: (d.online_media?.media || []).filter((m) => m.type === '3d_voyager').map((m) => ({ type: m.type, idsId: m.idsId, usage: m.usage })) },
        },
      },
    };
  });

if (rows.length !== wanted.size) throw new Error(`expected ${wanted.size} records, found ${rows.length}`);
const out = {
  note: 'Trimmed copy of six Smithsonian Open Access records (CC0) used by the fact audit in tests/unit/tools-and-facts.test.js. Regenerate with node scripts/make-fact-fixture.mjs.',
  source: 'https://api.si.edu/openaccess/api/v1.0/ (saved response data/raw/si3d.json)',
  retrieved: '2026-10-27',
  license: 'CC0 1.0 (metadata_usage.access = "CC0" on every record)',
  response: { rows },
};
mkdirSync(join(root, 'tests', 'fixtures'), { recursive: true });
writeFileSync(join(root, 'tests', 'fixtures', 'si-records.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`tests/fixtures/si-records.json: ${rows.length} records`);
