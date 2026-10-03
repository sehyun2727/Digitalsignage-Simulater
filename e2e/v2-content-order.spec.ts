import { expect, test, type Page } from '@playwright/test';
import { readPngDimensions } from './support/png.js';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP', viewport: { width: 1600, height: 1000 } });

// v2-S1 requirement 5-2: content aspect ratio and position must be invariant under the order
// in which (size → perspective → content) is applied. The unit test
// `tests/unit/v2/contentLayoutOrder.test.ts` proves this at the store/layout math level across
// a 5-order × 3-material × 2-fit × 2-rotation matrix (57 cases, order-independence shown by
// comparing content document corners within 0.5px across orders). This e2e narrows to the one
// case the PDF called out (R2: perspective → size → content) and verifies the PNG export the
// user actually downloads places the four fixture color corners inside the warped quad — the
// end-to-end confirmation that the invariant also holds through the drop handler, Konva
// rasterization, mesh warping, and the download path.
//
// The spec's primary comparison method proposed in the Step 5 instruction (R1 vs R2 PNGs
// pixel-compared with a tolerance) was downgraded here to the single-order corner-sampling
// method the instruction permits as the fallback, because:
//
// (1) R1 vs R2 PNGs are not meaningfully "the same final state" through the UI alone — the
//     toolbar's width/height numeric inputs recreate the geometry but Konva's internal mesh
//     rasterization + luminance sampling + LCD highlight canvas (per-object seeded, not time)
//     introduce rendering timestamps and float-rounding noise that make bit-for-bit identity
//     unreliable even when the store state is byte-identical;
// (2) The invariant the user cares about (does my 4-colored-corner image land in the quad in
//     an obvious way?) is more directly tested by sampling four pixel locations than by
//     comparing two whole PNGs.
//
// Fixture is a 4-color-corner PNG (TL=red, TR=green, BR=blue, BL=yellow) with the same aspect
// ratio as the transparent-LED logical screen at the sizes used here, so a Fit=contain
// content lands with its four color corners against the four quad corners. transparent-LED is
// picked because it has no bezel (screen == whole object rect, see SignageDisplayView.tsx:74),
// so corner sampling isn't offset by the frame inset the way a wall-LED would be. Procedural
// PNG generation matches `e2e/fixtures/README.md`'s "no committed binary fixtures" policy.

const DOCUMENT_SIZE = { width: 1920, height: 1080 };
const FINAL_WIDTH = 1600;
const FINAL_HEIGHT = 900;
// 16:9 — same ratio as a 1600x900 transparent-LED's logical screen (full object bounds).
const FIXTURE_WIDTH = 1600;
const FIXTURE_HEIGHT = 900;

const CORNERS_QUAD = {
  topLeft: { x: 0.1, y: 0.1 },
  topRight: { x: 0.5, y: 0.12 },
  bottomRight: { x: 0.52, y: 0.45 },
  bottomLeft: { x: 0.08, y: 0.42 },
} as const;

/** Builds a PNG with four colored corner quadrants (red/green/blue/yellow), generated inside
 *  the browser via Canvas 2D so there's no binary asset committed. The four color corners
 *  are large enough quadrants that sampling well inside each one tolerates mesh-warp drift. */
async function fourCornerFixturePng(page: Page): Promise<Buffer> {
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

/** Sets width/height via the toolbar numeric inputs — the only path that resizes an object
 *  while perspective is already applied (the Transformer is detached in perspective mode). */
async function setSizeViaToolbar(page: Page, width: number, height: number): Promise<void> {
  const widthInput = page.getByLabel('幅', { exact: true });
  await widthInput.fill(String(width));
  await widthInput.blur();
  const heightInput = page.getByLabel('高さ', { exact: true });
  await heightInput.fill(String(height));
  await heightInput.blur();
}

async function applyPerspective(page: Page): Promise<void> {
  await page.getByRole('button', { name: '空間に合わせて配置（パース）' }).click();
  const canvas = page.locator('.editor-canvas-container');
  const box = (await canvas.boundingBox())!;
  const handleTestid = {
    topLeft: 'editor-perspective-handle-topLeft',
    topRight: 'editor-perspective-handle-topRight',
    bottomRight: 'editor-perspective-handle-bottomRight',
    bottomLeft: 'editor-perspective-handle-bottomLeft',
  } as const;
  for (const [corner, point] of Object.entries(CORNERS_QUAD) as Array<
    [keyof typeof handleTestid, { x: number; y: number }]
  >) {
    await page.getByTestId(handleTestid[corner]).dragTo(canvas, {
      targetPosition: { x: point.x * box.width, y: point.y * box.height },
    });
  }
  await page.getByRole('button', { name: '適用' }).click();
}

async function uploadFixtureContent(page: Page): Promise<void> {
  const png = await fourCornerFixturePng(page);
  await page
    .getByTestId('editor-content-upload')
    .setInputFiles({ name: 'four-corner.png', mimeType: 'image/png', buffer: png });
  // Default fit is 'contain'. The fixture matches the logical screen ratio, so it fills it.
}

async function exportPng(page: Page): Promise<Buffer> {
  // Deselect so the Transformer bounding box doesn't leak into the export.
  await page.locator('.editor-canvas-container').click({ position: { x: 5, y: 5 } });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const fs = await import('node:fs/promises');
  return fs.readFile(path!);
}

/** Bilinear (unit-square → quad) interpolation evaluated at the four quad corners themselves —
 *  which is identical to the corner value regardless of the mapping used (the four corners of
 *  the unit square map to the four corners of the quad by definition, under both the
 *  projective and the bilinear mapping). Used to compute the sample points for the four
 *  colored fixture quadrants in document pixels. */
function cornerDocumentPoint(u: number, v: number): { x: number; y: number } {
  const scale = (p: { x: number; y: number }) => ({
    x: p.x * DOCUMENT_SIZE.width,
    y: p.y * DOCUMENT_SIZE.height,
  });
  const p0 = scale(CORNERS_QUAD.topLeft);
  const p1 = scale(CORNERS_QUAD.topRight);
  const p2 = scale(CORNERS_QUAD.bottomRight);
  const p3 = scale(CORNERS_QUAD.bottomLeft);
  return {
    x: p0.x * (1 - u) * (1 - v) + p1.x * u * (1 - v) + p2.x * u * v + p3.x * (1 - u) * v,
    y: p0.y * (1 - u) * (1 - v) + p1.y * u * (1 - v) + p2.y * u * v + p3.y * (1 - u) * v,
  };
}

test('5-2: R2 PNG (perspective → size → content) places the four fixture color corners inside the warped quad', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: DOCUMENT_SIZE.width, height: DOCUMENT_SIZE.height });
  // transparent-LED instead of plain LED so screen == full object rect (no bezel inset shrinks
  // where the content actually paints — see SignageDisplayView.tsx:74).
  await page.getByTestId('editor-add-transparent-led').click();
  // R2 order: perspective BEFORE size change (the order the PDF reported as misaligned pre-v2).
  await applyPerspective(page);
  await setSizeViaToolbar(page, FINAL_WIDTH, FINAL_HEIGHT);
  await uploadFixtureContent(page);
  const png = await exportPng(page);

  const { width: pngWidth, height: pngHeight } = readPngDimensions(png);
  // Export resolution is the document preset (1920x1080) per ADR 0011.
  expect(pngWidth).toBe(DOCUMENT_SIZE.width);
  expect(pngHeight).toBe(DOCUMENT_SIZE.height);

  // Sample at an inset toward each quadrant's centroid (0.25, 0.75 in u/v), so the sample is
  // comfortably inside the color quadrant and tolerates both mesh-warp drift and the warped-
  // quad edge boundary. The unit test already proves the mathematical corner positions match
  // across orders to within 0.5px; this is the independent "does it actually look right in a
  // real exported PNG" check.
  const corners: Array<{
    name: string;
    u: number;
    v: number;
    dominant: 'red' | 'green' | 'blue' | 'yellow';
  }> = [
    { name: 'topLeft quadrant (red)', u: 0.25, v: 0.25, dominant: 'red' },
    { name: 'topRight quadrant (green)', u: 0.75, v: 0.25, dominant: 'green' },
    { name: 'bottomRight quadrant (blue)', u: 0.75, v: 0.75, dominant: 'blue' },
    { name: 'bottomLeft quadrant (yellow)', u: 0.25, v: 0.75, dominant: 'yellow' },
  ];
  const points: Array<[number, number]> = corners.map((c) => {
    const p = cornerDocumentPoint(c.u, c.v);
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
