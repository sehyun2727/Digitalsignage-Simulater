#!/usr/bin/env node
// v2-S4 Step 0-3: canvas freeze guard.
//
// Scans the repository for `CANVAS-FREEZE:BEGIN <id>` / `CANVAS-FREEZE:END <id>` markers
// (comment syntax varies by file: `//` for .ts/.tsx, `/* */` for .css), hashes the exact
// bytes between each pair with SHA-256, and compares against the canonical table in
// docs/v2/canvas-freeze.json. Any mismatch — content drift, duplicate marker, orphan
// marker, missing id in the table — exits 1 so the push CI gate blocks it.
//
// Updating a canvas-freeze zone requires a user-approved change: edit the code AND
// re-record docs/v2/canvas-freeze.json in the same commit, with `[canvas-approved]` in
// the message (see CLAUDE.md §5-3bis "캔버스 동결").

import { readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TABLE_PATH = join(ROOT, 'docs', 'v2', 'canvas-freeze.json');
// Scan src/ and keep the search cheap. All current freeze zones live under src/.
const SCAN_ROOTS = ['src'];
const EXT_RE = /\.(ts|tsx|css)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-oitemiru', '.git']);

/** Yield every file under the scan roots whose extension matches EXT_RE. */
async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && EXT_RE.test(entry.name)) {
      yield full;
    }
  }
}

/** Returns the exact bytes between the opening and closing marker, excluding both marker
 *  lines themselves. Marker lines are the full lines on which `CANVAS-FREEZE:BEGIN <id>`
 *  / `CANVAS-FREEZE:END <id>` appear. The caller passes the newline style so the output
 *  faithfully reproduces the file's own line endings. */
function extractBetween(source, id) {
  const beginRe = new RegExp(`[^\\n]*CANVAS-FREEZE:BEGIN\\s+${id}[^\\n]*\\n`);
  const endRe = new RegExp(`[^\\n]*CANVAS-FREEZE:END\\s+${id}[^\\n]*`);
  const begin = source.match(beginRe);
  if (!begin) return null;
  const afterBegin = source.slice(begin.index + begin[0].length);
  const end = afterBegin.match(endRe);
  if (!end) return null;
  return afterBegin.slice(0, end.index);
}

/** Scan every candidate file for freeze markers. For each unique id, record the file it
 *  came from and the content hash. Duplicate ids across files are errors. */
async function collectFrozenZones() {
  const found = new Map();
  for (const scanRoot of SCAN_ROOTS) {
    const absRoot = join(ROOT, scanRoot);
    try {
      statSync(absRoot);
    } catch {
      continue;
    }
    for await (const file of walk(absRoot)) {
      const source = readFileSync(file, 'utf8');
      const idRe = /CANVAS-FREEZE:BEGIN\s+([A-Za-z0-9_-]+)/g;
      const seen = new Set();
      let match;
      while ((match = idRe.exec(source)) !== null) {
        const id = match[1];
        if (seen.has(id)) {
          throw new Error(`duplicate CANVAS-FREEZE:BEGIN ${id} in ${file}`);
        }
        seen.add(id);
        if (found.has(id)) {
          throw new Error(
            `duplicate CANVAS-FREEZE id "${id}" in ${file} and ${found.get(id).file}`,
          );
        }
        const content = extractBetween(source, id);
        if (content === null) {
          throw new Error(`CANVAS-FREEZE:BEGIN ${id} without matching END in ${file}`);
        }
        const sha = createHash('sha256').update(content, 'utf8').digest('hex');
        const rel = relative(ROOT, file).split(sep).join('/');
        found.set(id, { file: rel, sha, length: Buffer.byteLength(content, 'utf8') });
      }
    }
  }
  return found;
}

const liveZones = await collectFrozenZones();

let table;
try {
  table = JSON.parse(readFileSync(TABLE_PATH, 'utf8'));
} catch (error) {
  console.error(`check-canvas-freeze: cannot read ${relative(ROOT, TABLE_PATH)}: ${error.message}`);
  process.exit(1);
}

const expectedIds = new Set(Object.keys(table.zones ?? {}));
const liveIds = new Set(liveZones.keys());
let ok = true;

// Missing live zones (declared in table but absent from source).
for (const id of expectedIds) {
  if (!liveIds.has(id)) {
    console.error(
      `check-canvas-freeze: id "${id}" declared in canvas-freeze.json but no markers found in source`,
    );
    ok = false;
  }
}

// Unexpected zones (markers in source but no entry in table).
for (const id of liveIds) {
  if (!expectedIds.has(id)) {
    console.error(
      `check-canvas-freeze: id "${id}" has markers in ${liveZones.get(id).file} but no entry in canvas-freeze.json`,
    );
    ok = false;
  }
}

// Content mismatch for shared ids.
for (const id of liveIds) {
  if (!expectedIds.has(id)) continue;
  const live = liveZones.get(id);
  const want = table.zones[id];
  if (want.file !== live.file) {
    console.error(`check-canvas-freeze: id "${id}" moved from ${want.file} to ${live.file}`);
    ok = false;
  }
  if (want.sha256 !== live.sha) {
    console.error(
      `check-canvas-freeze: id "${id}" content drift in ${live.file}\n` +
        `  expected sha256 = ${want.sha256}\n` +
        `  actual   sha256 = ${live.sha}\n` +
        `  (bytes between markers: ${live.length})`,
    );
    ok = false;
  }
}

if (!ok) {
  console.error('check-canvas-freeze: FAIL — see CLAUDE.md §5-3bis for the approval procedure.');
  process.exit(1);
}

console.log(
  `check-canvas-freeze: OK — ${liveZones.size} zones match ${relative(ROOT, TABLE_PATH)}`,
);
