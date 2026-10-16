#!/usr/bin/env node
// v2-P3 A1 check: assert production build artifacts never leak the e2e-only backdoor
// symbols. `src/main.tsx` gates the accessor on `import.meta.env.VITE_E2E` so a
// default `npm run build` or `npm run build:oitemiru` tree-shakes that branch; this
// script enforces the invariant by grepping dist/ and dist-oitemiru/.
//
// Also forbids the dev-only portable debug overlay flag (VITE_DEBUG_PORTABLE_QUAD) and
// any `?debugPortableQuad=1` URL probe from leaking into prod bundles.
//
// Usage: `npm run check:prod-build` (run after `npm run build` + `npm run build:oitemiru`).
// Exit 1 if any forbidden symbol appears in dist/* or dist-oitemiru/*. CI gates push on it.

import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));

const FORBIDDEN = [
  '__editorStoreGetState',
  '__uiStoreGetState',
  'VITE_DEBUG_PORTABLE_QUAD',
  'debugPortableQuad',
];

const TARGETS = ['dist', 'dist-oitemiru'];

/** @param {string} dir  @param {string[]} out */
async function listFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await listFiles(p, out);
    else out.push(p);
  }
  return out;
}

let violations = 0;
for (const target of TARGETS) {
  const files = await listFiles(join(repo, target));
  if (files.length === 0) {
    console.log(`check-prod-build: SKIP — ${target}/ not built`);
    continue;
  }
  for (const file of files) {
    // Only scan text-ish bundles (JS/CSS/HTML/JSON); skip binary assets.
    if (!/\.(js|mjs|cjs|css|html|json|map|txt|svg)$/i.test(file)) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const sym of FORBIDDEN) {
      if (text.includes(sym)) {
        console.log(`check-prod-build: FAIL ${file} contains "${sym}"`);
        violations++;
      }
    }
  }
}
if (violations === 0) {
  console.log(
    `check-prod-build: OK — ${FORBIDDEN.length} forbidden symbols checked across ${TARGETS.join(', ')}, 0 occurrences.`,
  );
  process.exit(0);
}
console.log(`check-prod-build: FAIL — ${violations} violations.`);
process.exit(1);
