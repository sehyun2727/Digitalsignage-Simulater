#!/usr/bin/env node
// v2-S4 Step 0-3 / a-pre: canvas freeze guard.
//
// Two orthogonal checks, both backed by docs/v2/canvas-freeze.json:
//
//   1. SHA guard. Scans the repository for `CANVAS-FREEZE:BEGIN <id>` /
//      `CANVAS-FREEZE:END <id>` markers (comment syntax varies by file: `//` for .ts/.tsx,
//      `/* */` for .css), hashes the exact bytes between each pair with SHA-256, and
//      compares against the canonical `zones` table.
//   2. CSS selector guard (added in v2-S4-a). Scans src/**/*.css for selectors that target
//      the frozen layout classes (`.editor-workspace`, `.editor-canvas-{column,wrapper,
//      measure,container}`, `.editor-status-area`). Any match outside a freeze zone and not
//      listed in `cssSelectorGuard.allowlist` is a violation — new rules on these elements
//      would quietly override pinned layout and bypass §4bis.
//
// Both checks exit 1 on mismatch so the push CI gate blocks the push.
//
// Updating any freeze zone or adding a new rule to a frozen class requires a user-approved
// change: edit the code AND re-record docs/v2/canvas-freeze.json in the same commit, with
// `[canvas-approved]` in the message (see CLAUDE.md §5-3bis "캔버스 동결").

import { readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Lazy getter so vitest can import this module in a jsdom environment where
// `import.meta.url` is not a file:// URL (file-URL conversion throws there).
function getDefaultRoot() {
  return fileURLToPath(new URL('..', import.meta.url));
}
const EXT_RE = /\.(ts|tsx|css)$/;
const CSS_EXT_RE = /\.css$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-oitemiru', '.git']);

/** Default list of frozen CSS classes. Kept in sync with canvas-freeze.json so a unit test
 *  can inject a different list without touching the on-disk JSON. */
export const CHECK_CANVAS_FROZEN_CLASSES = [
  'editor-workspace',
  'editor-canvas-column',
  'editor-canvas-wrapper',
  'editor-canvas-measure',
  'editor-canvas-container',
  'editor-status-area',
];

/** Yield every file under `dir` whose extension matches `extRe`. */
async function* walk(dir, extRe) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, extRe);
    } else if (entry.isFile() && extRe.test(entry.name)) {
      yield full;
    }
  }
}

/** Returns the exact bytes between the opening and closing marker, excluding both marker
 *  lines themselves. Marker lines are the full lines on which `CANVAS-FREEZE:BEGIN <id>`
 *  / `CANVAS-FREEZE:END <id>` appear. */
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

/** Replace every character inside a CSS block comment (`/*` … `* /`) with a space of the
 *  same width, preserving the original source's byte offsets and line layout. Newlines are
 *  left alone so lineStart math still works. */
function stripCssComments(source) {
  const out = [...source];
  let i = 0;
  while (i < out.length - 1) {
    if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? out.length : end + 2;
      for (let j = i; j < stop; j++) {
        if (out[j] !== '\n' && out[j] !== '\r') out[j] = ' ';
      }
      i = stop;
    } else {
      i++;
    }
  }
  return out.join('');
}

/** Returns per-file freeze-zone spans as `{beginOffset, endOffset}` byte ranges in the
 *  source. Used by the CSS selector guard to decide whether a hit is inside a freeze zone. */
function collectFreezeSpans(source) {
  const beginRe = /CANVAS-FREEZE:BEGIN\s+([A-Za-z0-9_-]+)/g;
  const spans = [];
  let m;
  while ((m = beginRe.exec(source)) !== null) {
    const id = m[1];
    const endRe = new RegExp(`CANVAS-FREEZE:END\\s+${id}`);
    const after = source.slice(m.index);
    const end = after.match(endRe);
    if (!end) continue;
    spans.push({ begin: m.index, end: m.index + end.index + end[0].length });
  }
  return spans;
}

/** Scan every candidate file under `root/src` for freeze markers. */
async function collectFrozenZones(root, scanRoots) {
  const found = new Map();
  for (const scanRoot of scanRoots) {
    const absRoot = join(root, scanRoot);
    try {
      statSync(absRoot);
    } catch {
      continue;
    }
    for await (const file of walk(absRoot, EXT_RE)) {
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
        const rel = relative(root, file).split(sep).join('/');
        found.set(id, { file: rel, sha, length: Buffer.byteLength(content, 'utf8') });
      }
    }
  }
  return found;
}

/** Scan every CSS file under the scan roots for `.classname` selectors that target one of
 *  the frozen classes, outside freeze zones. Returns an array of violation records. Lines
 *  are 1-indexed; `line` points at the row where the matched `.` character sits.
 *
 *  Match contract: `.editor-workspace` matches the exact class; a trailing `-` or word
 *  character disqualifies the hit (so `.editor-status-area-hint` is NOT a match, nor is
 *  `.editor-canvas-wrapper--review`). The regex uses a negative lookahead `(?![\w-])` to
 *  enforce that. */
export async function collectCssSelectorHits({
  root = getDefaultRoot(),
  scanRoots = ['src'],
  classes = CHECK_CANVAS_FROZEN_CLASSES,
}) {
  const classAlternation = classes.map((c) => c.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
  const hitRe = new RegExp(`\\.(?:${classAlternation})(?![\\w-])`, 'g');
  const hits = [];
  for (const scanRoot of scanRoots) {
    const absRoot = join(root, scanRoot);
    try {
      statSync(absRoot);
    } catch {
      continue;
    }
    for await (const file of walk(absRoot, CSS_EXT_RE)) {
      const source = readFileSync(file, 'utf8');
      // CSS block comments can contain the exact class names in prose (e.g. "collapses
      // `.editor-canvas-wrapper` toward zero"). Those are not CSS selectors — a selector
      // only lives in a rule-list head. Zero-out comment bodies by replacing their characters
      // (except freeze markers) with spaces so offsets and line numbers survive untouched,
      // then run the hit regex against the stripped text. Freeze markers themselves live
      // inside comments too but are detected before stripping via `collectFreezeSpans`.
      const stripped = stripCssComments(source);
      const spans = collectFreezeSpans(source);
      const rel = relative(root, file).split(sep).join('/');
      // Pre-compute line start offsets for a fast byte-offset → line-number conversion.
      const lineStarts = [0];
      for (let i = 0; i < source.length; i++) {
        if (source.charCodeAt(i) === 10) lineStarts.push(i + 1);
      }
      let m;
      while ((m = hitRe.exec(stripped)) !== null) {
        const offset = m.index;
        const inFreeze = spans.some((s) => offset >= s.begin && offset < s.end);
        if (inFreeze) continue;
        // Binary search for the matching line.
        let lo = 0;
        let hi = lineStarts.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (lineStarts[mid] <= offset) lo = mid;
          else hi = mid - 1;
        }
        hits.push({ file: rel, line: lo + 1, selector: m[0] });
      }
    }
  }
  return hits;
}

/** The checker's exported entry point. Returns a `{ ok, errors, zonesChecked }` object so
 *  unit tests can assert on individual outcomes without parsing stderr. The CLI driver below
 *  calls this with the real repo root; the vitest fixtures pass a tmp root. */
export async function runCheck({ root = getDefaultRoot(), scanRoots = ['src'] } = {}) {
  const errors = [];
  const tablePath = join(root, 'docs', 'v2', 'canvas-freeze.json');
  let table;
  try {
    table = JSON.parse(readFileSync(tablePath, 'utf8'));
  } catch (error) {
    return {
      ok: false,
      errors: [`cannot read ${relative(root, tablePath)}: ${error.message}`],
      zonesChecked: 0,
    };
  }

  // ---- 1. SHA guard ----
  const liveZones = await collectFrozenZones(root, scanRoots);
  const expectedIds = new Set(Object.keys(table.zones ?? {}));
  const liveIds = new Set(liveZones.keys());
  for (const id of expectedIds) {
    if (!liveIds.has(id)) {
      errors.push(`id "${id}" declared in canvas-freeze.json but no markers found in source`);
    }
  }
  for (const id of liveIds) {
    if (!expectedIds.has(id)) {
      errors.push(
        `id "${id}" has markers in ${liveZones.get(id).file} but no entry in canvas-freeze.json`,
      );
    }
  }
  for (const id of liveIds) {
    if (!expectedIds.has(id)) continue;
    const live = liveZones.get(id);
    const want = table.zones[id];
    if (want.file !== live.file) {
      errors.push(`id "${id}" moved from ${want.file} to ${live.file}`);
    }
    if (want.sha256 !== live.sha) {
      errors.push(
        `id "${id}" content drift in ${live.file}\n` +
          `  expected sha256 = ${want.sha256}\n` +
          `  actual   sha256 = ${live.sha}\n` +
          `  (bytes between markers: ${live.length})`,
      );
    }
  }

  // ---- 2. CSS selector guard ----
  const guard = table.cssSelectorGuard;
  if (guard) {
    const classes = guard.classes ?? CHECK_CANVAS_FROZEN_CLASSES;
    const allowlist = guard.allowlist ?? [];
    const hits = await collectCssSelectorHits({ root, scanRoots, classes });
    const allowKey = (e) => `${e.file}:${e.line}:${e.selector}`;
    const allowSet = new Set(allowlist.map(allowKey));
    for (const hit of hits) {
      if (allowSet.has(allowKey(hit))) continue;
      errors.push(
        `CSS selector ${hit.selector} at ${hit.file}:${hit.line} targets a frozen layout ` +
          `class outside any freeze zone and is not on cssSelectorGuard.allowlist`,
      );
    }
  }

  return { ok: errors.length === 0, errors, zonesChecked: liveZones.size };
}

/** Standalone CLI entry — invoked when this file is run directly (not when imported). */
async function cli() {
  const result = await runCheck();
  if (!result.ok) {
    for (const error of result.errors) console.error(`check-canvas-freeze: ${error}`);
    console.error('check-canvas-freeze: FAIL — see CLAUDE.md §5-3bis for the approval procedure.');
    process.exit(1);
  }
  console.log(
    `check-canvas-freeze: OK — ${result.zonesChecked} zones + CSS selector allowlist clean`,
  );
}

const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedAsScript) {
  await cli();
}
