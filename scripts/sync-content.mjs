/**
 * sync-content.mjs — copy content/** (JSON) into public/content/ before
 * `vite dev` / `vite build`, so the app can fetch it at runtime while content/
 * stays the canonical, designer-editable location (standards 4.2).
 * public/content/ is gitignored.
 */
import { mkdirSync, copyFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'content');
const DEST = join(root, 'public', 'content');
rmSync(DEST, { recursive: true, force: true });

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(src)) {
    const s = join(src, f);
    if (statSync(s).isDirectory()) copyDir(s, join(dest, f));
    else if (f.endsWith('.json')) copyFileSync(s, join(dest, f));
  }
}
copyDir(SRC, DEST);
console.log('content synced to public/content/');
