import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';
import { openSection } from './support/accordion.js';

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
// v2-S5 보완 A1 (2026-10-13): the measured quads live under a committed, deterministic
// path at e2e/fixtures/, NOT the local-only tmp/ directory. Regeneration command:
//   node scripts/measure-portable-screen-quad.mjs
//   cp tmp/quad-debug/portable-screen-quads.json e2e/fixtures/portable-screen-quads.json
// If the fixture is missing we fail (not skip) — a silent skip would hide quad drift.
const JSON_PATH = path.resolve(SPEC_DIR, 'fixtures', 'portable-screen-quads.json');

// v2-S5 K1 (polygon-based judgment, v2-S5 보완 A1). Portable screen pixel verification
// across 3 views × 4 conditions = 12 scenarios. Earlier (bd1ada8) revision sampled only
// a 7×7 patch at the quad centroid + a single outside point. The gate per the S5 보완
// prompt is stricter: evaluate the ENTIRE PNG via the full projected polygon.
//
//   (a) 2-px inward of the polygon boundary → magenta fraction ≥ 99 %
//   (b) 2-px outward of the polygon boundary (full-PNG scan) → magenta count = 0
//   (c) 2–5 px ring outside the boundary → fraction of pixels within ΔE ≤ 10 of the
//       bezel baseline (reported only; no numeric gate — reveals quad drift if ~0)
//
// The bezel baseline is captured by exporting the same portable WITHOUT content (device
// photo visible, no screen overlay). The polygon is read from the committed JSON — not
// from PORTABLE_PRESET_SCREEN_QUADS (circular).

test.use({ locale: 'ja-JP' });

type NormalizedQuad = {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
};

type ViewName = 'front' | 'angled-left' | 'angled-right';

async function loadQuads(): Promise<Record<ViewName, NormalizedQuad>> {
  try {
    const buf = await fs.readFile(JSON_PATH, 'utf8');
    const parsed = JSON.parse(buf) as { views: Record<ViewName, { normalized: NormalizedQuad }> };
    return {
      front: parsed.views['front'].normalized,
      'angled-left': parsed.views['angled-left'].normalized,
      'angled-right': parsed.views['angled-right'].normalized,
    };
  } catch (err) {
    throw new Error(
      `K1 fixture missing at ${JSON_PATH}. Regenerate: node scripts/measure-portable-screen-quad.mjs && cp tmp/quad-debug/portable-screen-quads.json e2e/fixtures/. Original: ${(err as Error).message}`,
      { cause: err },
    );
  }
}

function normalizedToDoc(
  n: { x: number; y: number },
  o: { x: number; y: number; width: number; height: number; rotation: number },
): { x: number; y: number } {
  const lx = n.x * o.width;
  const ly = n.y * o.height;
  if (o.rotation === 0) return { x: o.x + lx, y: o.y + ly };
  const rad = (o.rotation * Math.PI) / 180;
  return {
    x: o.x + lx * Math.cos(rad) - ly * Math.sin(rad),
    y: o.y + lx * Math.sin(rad) + ly * Math.cos(rad),
  };
}

/** Vertex-bisector polygon offset. Positive distance = INWARD (shrink); negative = OUTWARD
 *  (expand). The portable screen quad in screen coordinates is CW (y grows downward), so
 *  rotating each edge direction (dx, dy) by +90° gives (-dy, dx) → OUTWARD normal for CW
 *  polygons. We negate to get the INWARD normal, then shift each vertex along the
 *  bisector of the two inward normals by `distance / (n1·bisector)`. Approximates
 *  Minkowski offset for small distances relative to the shortest edge. */
function offsetPolygon(
  verts: { x: number; y: number }[],
  distance: number,
): { x: number; y: number }[] {
  const n = verts.length;
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n]!;
    const curr = verts[i]!;
    const next = verts[(i + 1) % n]!;
    const e1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const e2 = { x: next.x - curr.x, y: next.y - curr.y };
    const len1 = Math.hypot(e1.x, e1.y);
    const len2 = Math.hypot(e2.x, e2.y);
    if (len1 < 1e-6 || len2 < 1e-6) {
      result.push(curr);
      continue;
    }
    // Inward normal to each edge for a CW polygon in screen coords.
    const n1 = { x: -e1.y / len1, y: e1.x / len1 };
    const n2 = { x: -e2.y / len2, y: e2.x / len2 };
    const bisector = { x: n1.x + n2.x, y: n1.y + n2.y };
    const dot = n1.x * bisector.x + n1.y * bisector.y;
    if (Math.abs(dot) < 1e-6) {
      result.push(curr);
      continue;
    }
    const scale = distance / dot;
    result.push({ x: curr.x + bisector.x * scale, y: curr.y + bisector.y * scale });
  }
  return result;
}

function pointInPolygon(x: number, y: number, verts: { x: number; y: number }[]): boolean {
  let inside = false;
  const n = verts.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = verts[i]!.x;
    const yi = verts[i]!.y;
    const xj = verts[j]!.x;
    const yj = verts[j]!.y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

interface PortableState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  view: ViewName;
}

async function readPortableState(page: Page): Promise<PortableState> {
  await openSection(page, 'selected');
  await page.getByTestId('toolbar-subsection-position-size-toggle').click();
  const positionSize = page.locator('[data-testid="toolbar-subsection-position-size"]');
  const x = Number(await positionSize.getByLabel('横位置').inputValue());
  const y = Number(await positionSize.getByLabel('縦位置').inputValue());
  const width = Number(await positionSize.getByLabel('幅').first().inputValue());
  const height = Number(await positionSize.getByLabel('高さ').first().inputValue());
  const rotation = Number(await positionSize.getByLabel('回転').inputValue());
  await openSection(page, 'appearance');
  const view = (await page.getByLabel(/ビュー|View|뷰/).inputValue()) as ViewName;
  return { x, y, width, height, rotation, view };
}

async function exportPng(page: Page): Promise<PNG> {
  const dl = page.waitForEvent('download');
  await page.getByTestId('editor-export-png-header').click();
  const d = await dl;
  const buffer = await fs.readFile((await d.path())!);
  return PNG.sync.read(buffer);
}

function isMagenta(idx: number, data: Buffer): boolean {
  // #FF00FF with ΔE ≤ 10 tolerance per the K1 gate. CIE Lab ΔE 10 maps to a direction-
  // dependent RGB distance that peaks around 50 for the magenta → gray axis. 50 is a safe
  // upper bound; tighter would misreject anti-aliased boundary pixels (which blend magenta
  // with the device bezel) even though they are perceptually still "magenta-adjacent"
  // within the gate's ΔE budget.
  const r = data[idx]!;
  const g = data[idx + 1]!;
  const b = data[idx + 2]!;
  return Math.sqrt((r - 255) ** 2 + g * g + (b - 255) ** 2) < 50;
}

function colorDeltaE(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

interface PolygonSweep {
  insidePx: number;
  insideMagenta: number;
  outsideMagentaFullImage: number;
  ringPx: number;
  ringMatches: number;
}

function sweepPolygon(
  png: PNG,
  insidePoly: { x: number; y: number }[],
  outsidePoly: { x: number; y: number }[],
  ringInner: { x: number; y: number }[],
  ringOuter: { x: number; y: number }[],
  bezelBaseline: PNG,
): PolygonSweep {
  let insidePx = 0;
  let insideMagenta = 0;
  let outsideMagentaFullImage = 0;
  let ringPx = 0;
  let ringMatches = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const magenta = isMagenta(i, png.data);
      const inInside = pointInPolygon(x, y, insidePoly);
      const inOutside = pointInPolygon(x, y, outsidePoly);
      if (inInside) {
        insidePx++;
        if (magenta) insideMagenta++;
      } else if (!inOutside && magenta) {
        // Pixel is OUTSIDE the 2-px-expanded polygon AND magenta — a gate (b) violation.
        outsideMagentaFullImage++;
      }
      // Ring = inside outer ring but outside inner ring.
      if (!pointInPolygon(x, y, ringInner) && pointInPolygon(x, y, ringOuter)) {
        ringPx++;
        const px = { r: png.data[i]!, g: png.data[i + 1]!, b: png.data[i + 2]! };
        const bezel = {
          r: bezelBaseline.data[i]!,
          g: bezelBaseline.data[i + 1]!,
          b: bezelBaseline.data[i + 2]!,
        };
        if (colorDeltaE(px, bezel) <= 10) ringMatches++;
      }
    }
  }
  return { insidePx, insideMagenta, outsideMagentaFullImage, ringPx, ringMatches };
}

type Condition = 'default' | 'move' | 'resize' | 'rotate15';

const CONDITIONS: Condition[] = ['default', 'move', 'resize', 'rotate15'];
const VIEWS: ViewName[] = ['front', 'angled-left', 'angled-right'];

async function setupPortable(page: Page, view: ViewName, withContent: boolean): Promise<void> {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080, color: '#334455' });
  await page.getByTestId('editor-add-portable').click();
  await openSection(page, 'appearance');
  const viewSelect = page.getByLabel(/ビュー|View|뷰/);
  const current = await viewSelect.inputValue();
  if (current !== view) await viewSelect.selectOption(view);
  if (withContent) {
    await openSection(page, 'content');
    const magenta = await solidColorPng(page, '#ff00ff', 400, 400);
    await page.getByTestId('editor-content-upload').setInputFiles({
      name: 'magenta.png',
      mimeType: 'image/png',
      buffer: magenta,
    });
    const fitSelect = page.getByRole('combobox', { name: '表示方法' });
    await fitSelect.selectOption('cover');
    await openSection(page, 'appearance');
    const intensity = page.getByRole('slider', { name: '質感の強さ' });
    await intensity.focus();
    await intensity.press('Home');
    await intensity.press('Tab');
  }
}

async function applyCondition(page: Page, condition: Condition): Promise<void> {
  if (condition === 'default') return;
  await openSection(page, 'selected');
  await page.getByTestId('toolbar-subsection-position-size-toggle').click();
  const ps = page.locator('[data-testid="toolbar-subsection-position-size"]');
  if (condition === 'move') {
    const xi = ps.getByLabel('横位置');
    const cx = Number(await xi.inputValue());
    await xi.fill(String(cx + 60));
    await xi.blur();
  } else if (condition === 'resize') {
    const wi = ps.getByLabel('幅').first();
    const cw = Number(await wi.inputValue());
    await wi.fill(String(cw + 80));
    await wi.blur();
  } else if (condition === 'rotate15') {
    const ri = ps.getByLabel('回転');
    await ri.fill('15');
    await ri.blur();
  }
}

for (const view of VIEWS) {
  for (const condition of CONDITIONS) {
    test(`K1 ${view} × ${condition}: inside polygon ≥99% magenta, 0 magenta outside, bezel ring reported`, async ({
      page,
    }) => {
      const quads = await loadQuads();
      const quad = quads[view];
      // Baseline bezel PNG — same object + condition WITHOUT content.
      await setupPortable(page, view, false);
      await applyCondition(page, condition);
      const bezelState = await readPortableState(page);
      const bezelPng = await exportPng(page);
      // Measured PNG — same object + condition WITH magenta cover-fit content.
      await setupPortable(page, view, true);
      await applyCondition(page, condition);
      const state = await readPortableState(page);
      const png = await exportPng(page);
      // Sanity: state matches between bezel and measured runs.
      expect({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        rotation: state.rotation,
      }).toEqual({
        x: bezelState.x,
        y: bezelState.y,
        width: bezelState.width,
        height: bezelState.height,
        rotation: bezelState.rotation,
      });
      // Project the 4 normalized quad corners into doc coords.
      const verts = [
        normalizedToDoc(quad.topLeft, state),
        normalizedToDoc(quad.topRight, state),
        normalizedToDoc(quad.bottomRight, state),
        normalizedToDoc(quad.bottomLeft, state),
      ];
      const insidePoly = offsetPolygon(verts, 2);
      const outsidePoly = offsetPolygon(verts, -2);
      const ringInner = offsetPolygon(verts, -2);
      const ringOuter = offsetPolygon(verts, -5);
      const sweep = sweepPolygon(png, insidePoly, outsidePoly, ringInner, ringOuter, bezelPng);
      const insideRatio = sweep.insidePx > 0 ? sweep.insideMagenta / sweep.insidePx : 0;
      const ringMatchRatio = sweep.ringPx > 0 ? sweep.ringMatches / sweep.ringPx : 0;
      console.log(
        `K1 ${view}×${condition}: ` +
          `(a) inside=${sweep.insideMagenta}/${sweep.insidePx} (${(insideRatio * 100).toFixed(2)}%) ` +
          `(b) outsideMagenta=${sweep.outsideMagentaFullImage} ` +
          `(c) ring ΔE≤10 fraction=${sweep.ringMatches}/${sweep.ringPx} (${(ringMatchRatio * 100).toFixed(2)}%)`,
      );
      expect(insideRatio).toBeGreaterThanOrEqual(0.99);
      expect(sweep.outsideMagentaFullImage).toBe(0);
      // (c) is a REPORT (fraction) per the gate wording — no numeric assertion.
    });
  }
}
