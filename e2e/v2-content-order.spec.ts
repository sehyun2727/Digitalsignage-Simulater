import { expect, test, type Page } from '@playwright/test';
import { readPngDimensions } from './support/png.js';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP', viewport: { width: 1600, height: 1000 } });

// v2-S1 requirement 5-2 — rework path (ADR 0012 D-13 / D-14):
//
// The PDF's reported bug is the P2 flow: "①サイネージを追加 → ②パース → ③コンテンツ" produces
// a stretched content, whereas "①追加 → ②大きさ調整 → ③パース → ④コンテンツ" is correct. The
// unit test `tests/unit/v2/contentLayoutOrder.test.ts` (PDF path 5-2 describe block, 6 cases)
// covers this at the store/layout math level for both wall-LED (bezel) and transparent-LED
// across P1 / P2 / P3. This e2e narrows to the P2 flow with a wall-LED (bezel inset in play)
// and verifies through the real drop handler, Konva mesh warp, and PNG download path that the
// four fixture color corners land on the frame's screen-inset quad corners.
//
// A second case asserts the ADR 0012 D-14 UI rule: the toolbar's `幅` / `高さ` inputs are
// disabled while perspective is applied, and have the `perspective-size-locked-hint` note
// wired via `aria-describedby`. Together these two cases close the 5-2 fix end to end — the
// aspect comes from the quad, and the only legal way to change size while perspective is on
// is via the four corner handles.

const DOCUMENT_SIZE = { width: 1920, height: 1080 };

// PDF path 5-2 fixture quad: apparent aspect ~2.73:1 (about 1.53× wider than the signage
// default 480×270 = 1.78:1), chosen so a 2.73:1 fixture content filled against the unresized
// default body would letterbox and visibly land away from the quad screen inset corners in
// the pre-fix renderer. Matches the unit test's PDF_QUAD so the two coverage layers agree.
const PDF_QUAD = {
  topLeft: { x: 0.3, y: 0.3 },
  topRight: { x: 0.7, y: 0.33 },
  bottomRight: { x: 0.68, y: 0.55 },
  bottomLeft: { x: 0.32, y: 0.57 },
} as const;

// Content fixture dimensions tuned to the quad apparent aspect: a 2730×1000 four-color-corner
// image (aspect 2.73) lands flush against the quad's screen inset only when the renderer
// uses the quad-derived aspect — otherwise it letterboxes vertically inside the default
// 1.78:1 body before warping.
const FIXTURE_WIDTH = 2730;
const FIXTURE_HEIGHT = 1000;

// `wall-led` frame fractional screen inset from `DISPLAY_FRAME_TEMPLATES` in
// src/types/editor.ts: screen = {x: 0.02, y: 0.02, width: 0.96, height: 0.96}. Mirrored here
// (rather than imported) because e2e's tsconfig.node.json ESM resolver requires explicit `.js`
// extensions on cross-package imports, which the `src/types/editor.ts` module tree doesn't
// provide — same reason S1 Step 0 switched e2e selectors to testids instead of locale imports.
const WALL_LED_INSET = { u0: 0.02, v0: 0.02, u1: 0.98, v1: 0.98 } as const;

async function fourColorCornerPng(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ff0000'; // top-left: red
      ctx.fillRect(0, 0, width / 2, height / 2);
      ctx.fillStyle = '#00ff00'; // top-right: green
      ctx.fillRect(width / 2, 0, width / 2, height / 2);
      ctx.fillStyle = '#0000ff'; // bottom-right: blue
      ctx.fillRect(width / 2, height / 2, width / 2, height / 2);
      ctx.fillStyle = '#ffff00'; // bottom-left: yellow
      ctx.fillRect(0, height / 2, width / 2, height / 2);
      return canvas.toDataURL('image/png');
    },
    { width: FIXTURE_WIDTH, height: FIXTURE_HEIGHT },
  );
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

async function applyPdfQuadPerspective(page: Page): Promise<void> {
  await page.getByRole('button', { name: '空間に合わせて配置（パース）' }).click();
  const canvas = page.locator('.editor-canvas-container');
  const box = (await canvas.boundingBox())!;
  const handleTestid = {
    topLeft: 'editor-perspective-handle-topLeft',
    topRight: 'editor-perspective-handle-topRight',
    bottomRight: 'editor-perspective-handle-bottomRight',
    bottomLeft: 'editor-perspective-handle-bottomLeft',
  } as const;
  for (const [corner, point] of Object.entries(PDF_QUAD) as Array<
    [keyof typeof handleTestid, { x: number; y: number }]
  >) {
    await page.getByTestId(handleTestid[corner]).dragTo(canvas, {
      targetPosition: { x: point.x * box.width, y: point.y * box.height },
    });
  }
  await page.getByRole('button', { name: '適用' }).click();
}

async function uploadFixtureContent(page: Page): Promise<void> {
  const png = await fourColorCornerPng(page);
  await page
    .getByTestId('editor-content-upload')
    .setInputFiles({ name: 'four-corner.png', mimeType: 'image/png', buffer: png });
}

async function exportPng(page: Page): Promise<Buffer> {
  await page.locator('.editor-canvas-container').click({ position: { x: 5, y: 5 } });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const fs = await import('node:fs/promises');
  return fs.readFile(path!);
}

/** Document-space position of a unit-square point (u, v) warped through PDF_QUAD. Uses the
 *  same bilinear-at-corners identity the renderer's piecewise-affine mesh converges to at
 *  the four quad corners — exact for (0,0)/(1,0)/(1,1)/(0,1) regardless of mapping choice. */
function bilinearThroughQuad(u: number, v: number): { x: number; y: number } {
  const scale = (p: { x: number; y: number }) => ({
    x: p.x * DOCUMENT_SIZE.width,
    y: p.y * DOCUMENT_SIZE.height,
  });
  const tl = scale(PDF_QUAD.topLeft);
  const tr = scale(PDF_QUAD.topRight);
  const br = scale(PDF_QUAD.bottomRight);
  const bl = scale(PDF_QUAD.bottomLeft);
  return {
    x: tl.x * (1 - u) * (1 - v) + tr.x * u * (1 - v) + br.x * u * v + bl.x * (1 - u) * v,
    y: tl.y * (1 - u) * (1 - v) + tr.y * u * (1 - v) + br.y * u * v + bl.y * (1 - u) * v,
  };
}

test('5-2 (PDF P2): wall-LED without resizing lands the four-color-corner fixture inside the perspective quad screen inset', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: DOCUMENT_SIZE.width, height: DOCUMENT_SIZE.height });
  // wall-LED (bezel). Default size (480×270, aspect 1.78) is kept — the PDF-reported P2 flow.
  await page.getByTestId('editor-add-led').click();
  await applyPdfQuadPerspective(page);
  await uploadFixtureContent(page);
  const png = await exportPng(page);

  const { width: pngWidth, height: pngHeight } = readPngDimensions(png);
  expect(pngWidth).toBe(DOCUMENT_SIZE.width);
  expect(pngHeight).toBe(DOCUMENT_SIZE.height);

  // Sample the four color quadrants well inside their own screen-inset quarter so a ~3px
  // mesh-warp drift at the quad edge doesn't accidentally cross into the neighboring color.
  // Each sample's (u, v) is placed at the centroid of its own quadrant **inside the wall-LED
  // screen inset** (fractional 0.02…0.98 of the body) — not at the full-quad corner, which
  // the bezel would obscure. Under the fix the four quadrant centroids land cleanly on their
  // own colors; before the fix (letterbox-then-warp) the top-left centroid would sample a
  // row of pixels well above the quad, outside the warped content region.
  const insetMid = (lo: number, hi: number, frac: number) => lo + (hi - lo) * frac;
  const screenU = (frac: number) => insetMid(WALL_LED_INSET.u0, WALL_LED_INSET.u1, frac);
  const screenV = (frac: number) => insetMid(WALL_LED_INSET.v0, WALL_LED_INSET.v1, frac);
  const corners: Array<{
    name: string;
    u: number;
    v: number;
    dominant: 'red' | 'green' | 'blue' | 'yellow';
  }> = [
    { name: 'TL (red)', u: screenU(0.25), v: screenV(0.25), dominant: 'red' },
    { name: 'TR (green)', u: screenU(0.75), v: screenV(0.25), dominant: 'green' },
    { name: 'BR (blue)', u: screenU(0.75), v: screenV(0.75), dominant: 'blue' },
    { name: 'BL (yellow)', u: screenU(0.25), v: screenV(0.75), dominant: 'yellow' },
  ];
  const points: Array<[number, number]> = corners.map((c) => {
    const p = bilinearThroughQuad(c.u, c.v);
    return [Math.round(p.x), Math.round(p.y)];
  });
  const pixels = await samplePngPixels(page, png, points);
  for (let i = 0; i < corners.length; i++) {
    const { r, g, b } = pixels[i]!;
    const { name, dominant } = corners[i]!;
    switch (dominant) {
      case 'red':
        expect(r, `${name}`).toBeGreaterThan(g + 40);
        expect(r, `${name}`).toBeGreaterThan(b + 40);
        break;
      case 'green':
        expect(g, `${name}`).toBeGreaterThan(r + 40);
        expect(g, `${name}`).toBeGreaterThan(b + 40);
        break;
      case 'blue':
        expect(b, `${name}`).toBeGreaterThan(r + 40);
        expect(b, `${name}`).toBeGreaterThan(g + 40);
        break;
      case 'yellow':
        expect(r, `${name}`).toBeGreaterThan(b + 40);
        expect(g, `${name}`).toBeGreaterThan(b + 40);
        break;
    }
  }
});

test('5-2 (ADR 0012 D-14): 幅 / 高さ inputs are disabled while perspective is applied and announce the lock via aria-describedby', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: DOCUMENT_SIZE.width, height: DOCUMENT_SIZE.height });
  await page.getByTestId('editor-add-led').click();

  // Before perspective: inputs are enabled.
  const widthInput = page.getByLabel('幅', { exact: true });
  const heightInput = page.getByLabel('高さ', { exact: true });
  await expect(widthInput).toBeEnabled();
  await expect(heightInput).toBeEnabled();

  await applyPdfQuadPerspective(page);

  // After perspective is applied: both inputs are disabled and point at the lock hint. The
  // `perspective-size-locked-hint` id is wired in Toolbar.tsx; `aria-describedby` is also the
  // accessibility path a screen reader uses here, so verifying the attribute wiring covers
  // both the visual-disabled state and the assistive-technology announcement.
  await expect(widthInput).toBeDisabled();
  await expect(heightInput).toBeDisabled();
  await expect(widthInput).toHaveAttribute('aria-describedby', 'perspective-size-locked-hint');
  await expect(heightInput).toHaveAttribute('aria-describedby', 'perspective-size-locked-hint');
  await expect(
    page.locator('#perspective-size-locked-hint'),
    'hint element must exist for aria-describedby to resolve',
  ).toHaveText('パース適用中は、四隅のハンドルで大きさと形を調整します');

  // Returning to rect mode re-enables the inputs.
  await page.getByRole('button', { name: '通常配置に戻す' }).click();
  await expect(widthInput).toBeEnabled();
  await expect(heightInput).toBeEnabled();
});
