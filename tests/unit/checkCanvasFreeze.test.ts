/// <reference types="node" />
import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// The checker ships as a plain `.mjs` CLI without types; the ambient signature lives in
// `scripts/check-canvas-freeze.d.mts` so this import stays strictly typed.
import { runCheck } from '../../scripts/check-canvas-freeze.mjs';

/**
 * v2-S4-a a-pre.3. Smoke-tests the CSS selector guard added in `check-canvas-freeze.mjs`
 * against an in-memory repo-like directory tree. The real guard also runs against the real
 * src/ as part of `npm run check:canvas`; this test only exercises the mechanism — fixtures
 * must mimic the on-disk layout (`src/`, `docs/v2/canvas-freeze.json`) because `runCheck`
 * resolves both via a passed-in `root`.
 */
describe('check-canvas-freeze CSS selector guard', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'canvas-freeze-'));
    mkdirSync(join(root, 'src', 'styles'), { recursive: true });
    mkdirSync(join(root, 'docs', 'v2'), { recursive: true });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('passes when the only rule on a frozen class lives inside a freeze zone', async () => {
    const cssPath = join(root, 'src', 'styles', 'app.css');
    // Freeze marker lives inside a CSS comment per project convention.
    writeFileSync(
      cssPath,
      [
        '/* CANVAS-FREEZE:BEGIN sample-zone */',
        '.editor-workspace { display: flex; }',
        '/* CANVAS-FREEZE:END sample-zone */',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(root, 'docs', 'v2', 'canvas-freeze.json'),
      JSON.stringify({
        zones: {
          'sample-zone': {
            file: 'src/styles/app.css',
            // Content between the marker lines is '.editor-workspace { display: flex; }\n'
            // (34 bytes). The sha below is a placeholder; the SHA guard is tested
            // elsewhere, so stub it to the actual value to isolate the selector guard.
            sha256: 'placeholder',
            length: 34,
          },
        },
        cssSelectorGuard: {
          classes: ['editor-workspace'],
          allowlist: [],
        },
      }),
    );
    const result = await runCheck({ root });
    // SHA mismatch is expected (placeholder); the selector-guard assertion is that there's
    // no "targets a frozen layout class outside any freeze zone" error.
    const selectorErrors = result.errors.filter((e: string) => e.includes('targets a frozen'));
    expect(selectorErrors).toEqual([]);
  });

  test('fails when a new CSS rule targets a frozen class outside freeze zones', async () => {
    const cssPath = join(root, 'src', 'styles', 'app.css');
    writeFileSync(
      cssPath,
      [
        '/* CANVAS-FREEZE:BEGIN sample-zone */',
        '.editor-workspace { display: flex; }',
        '/* CANVAS-FREEZE:END sample-zone */',
        '',
        '/* A later unrelated media block tries to re-target the frozen class — this is',
        '   exactly what the guard should refuse. */',
        '@media (max-width: 48rem) {',
        '  .editor-workspace { flex-direction: column; }',
        '}',
        '',
      ].join('\n'),
    );
    const result = await runCheck({ root });
    const violation = result.errors.find(
      (e: string) => e.includes('.editor-workspace') && e.includes('frozen layout class'),
    );
    expect(violation).toBeDefined();
    expect(result.ok).toBe(false);
    // The offending line is 8 (1-indexed, matching the `.editor-workspace` row).
    expect(violation).toMatch(/:8/);
  });

  test('ignores class-name mentions inside CSS block comments', async () => {
    const cssPath = join(root, 'src', 'styles', 'app.css');
    writeFileSync(
      cssPath,
      [
        '/* CANVAS-FREEZE:BEGIN sample-zone */',
        '.editor-workspace { display: flex; }',
        '/* CANVAS-FREEZE:END sample-zone */',
        '',
        '/* The old .editor-workspace used flex-direction: row; preserved here as a note. */',
        '',
      ].join('\n'),
    );
    const result = await runCheck({ root });
    const selectorErrors = result.errors.filter((e: string) => e.includes('targets a frozen'));
    expect(selectorErrors).toEqual([]);
  });

  test('ignores BEM-modifier derivatives like .editor-canvas-wrapper--review', async () => {
    const cssPath = join(root, 'src', 'styles', 'app.css');
    writeFileSync(
      cssPath,
      [
        '/* CANVAS-FREEZE:BEGIN sample-zone */',
        '.editor-canvas-wrapper { display: flex; }',
        '/* CANVAS-FREEZE:END sample-zone */',
        '',
        '.editor-canvas-wrapper--review { pointer-events: none; }',
        '.editor-status-area-hint { color: red; }',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(root, 'docs', 'v2', 'canvas-freeze.json'),
      JSON.stringify({
        zones: {},
        cssSelectorGuard: {
          classes: ['editor-canvas-wrapper', 'editor-status-area'],
          allowlist: [],
        },
      }),
    );
    const result = await runCheck({ root });
    const selectorErrors = result.errors.filter((e: string) => e.includes('targets a frozen'));
    expect(selectorErrors).toEqual([]);
  });

  test('allowlist entries silence otherwise-flagged occurrences', async () => {
    const cssPath = join(root, 'src', 'styles', 'app.css');
    writeFileSync(
      cssPath,
      [
        '/* CANVAS-FREEZE:BEGIN sample-zone */',
        '.editor-workspace { display: flex; }',
        '/* CANVAS-FREEZE:END sample-zone */',
        '',
        '@media (max-width: 48rem) {',
        '  .editor-workspace { flex-direction: column; }',
        '}',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(root, 'docs', 'v2', 'canvas-freeze.json'),
      JSON.stringify({
        zones: {},
        cssSelectorGuard: {
          classes: ['editor-workspace'],
          allowlist: [{ file: 'src/styles/app.css', line: 6, selector: '.editor-workspace' }],
        },
      }),
    );
    const result = await runCheck({ root });
    const selectorErrors = result.errors.filter((e: string) => e.includes('targets a frozen'));
    expect(selectorErrors).toEqual([]);
  });
});
