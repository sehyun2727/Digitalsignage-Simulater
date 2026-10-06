import { expect, test, type Page } from '@playwright/test';
import { addSpaceBackground } from './support/spaceBackground.js';

// v2-S2 보완 (0-6): direct, pixel-level watermark presence check that doesn't rely on the
// Linux-only `visual-qa` golden images. Takes a solid-colour space photo, exports a PNG, and
// asserts that inside the watermark rectangle (computed from the SAME lib the renderer uses)
// at least a non-trivial fraction of the pixels differ from the pure background colour. If
// the watermark were silently removed from the export, every pixel in that rectangle would
// still read as the solid background and the ratio would be ~0.

test.use({ locale: 'ja-JP', viewport: { width: 1280, height: 900 } });

const DOC = { width: 1920, height: 1080 } as const;
const BG_COLOR = '#00ff00'; // deliberately saturated so any watermark pixel contrasts hard.

// Mirror of src/lib/hullWatermark.ts constants. Keeping a copy here (not importing from
// src/) avoids pulling in `import.meta.env.BASE_URL` into the Playwright context.
const WATERMARK_WIDTH_RATIO = 0.085;
const WATERMARK_MIN_WIDTH = 56;
const WATERMARK_MAX_WIDTH = 120;
const WATERMARK_RIGHT_MARGIN_RATIO = 0.025;
const WATERMARK_BOTTOM_MARGIN_RATIO = 0.025;
const WATERMARK_ASPECT_RATIO = 80 / 26;

function watermarkRectDocSpace(canvasW: number, canvasH: number) {
  const width = Math.min(
    WATERMARK_MAX_WIDTH,
    Math.max(WATERMARK_MIN_WIDTH, canvasW * WATERMARK_WIDTH_RATIO),
  );
  const height = width / WATERMARK_ASPECT_RATIO;
  const right = canvasW * (1 - WATERMARK_RIGHT_MARGIN_RATIO);
  const bottom = canvasH * (1 - WATERMARK_BOTTOM_MARGIN_RATIO);
  const left = right - width;
  const top = bottom - height;
  return { left, top, right, bottom, width, height };
}

async function exportPngBuffer(page: Page): Promise<Buffer> {
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const d = await dl;
  const path = await d.path();
  const fs = await import('node:fs/promises');
  return fs.readFile(path!);
}

/** Returns the ratio of pixels inside the given rect that differ from the solid background,
 *  computed in a real browser canvas so we reuse the browser's own PNG decoder. The output
 *  PNG is at 1920×1080 (landscape preset), so the rect is sampled directly in those coords. */
async function nonBackgroundRatio(
  page: Page,
  buffer: Buffer,
  rect: { left: number; top: number; right: number; bottom: number },
  tolerance = 24,
): Promise<{ ratio: number; sampled: number; nonBg: number }> {
  const base64 = buffer.toString('base64');
  return page.evaluate(
    async ({ base64, rect, tolerance }) => {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('decode failed'));
        img.src = `data:image/png;base64,${base64}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const x = Math.floor(rect.left);
      const y = Math.floor(rect.top);
      const w = Math.max(1, Math.floor(rect.right - rect.left));
      const h = Math.max(1, Math.floor(rect.bottom - rect.top));
      const data = ctx.getImageData(x, y, w, h).data;
      let nonBg = 0;
      let sampled = 0;
      for (let i = 0; i < data.length; i += 4) {
        sampled++;
        // Background is #00ff00 (0, 255, 0). Any pixel more than `tolerance` away on any
        // channel is "non-background".
        if (
          Math.abs(data[i]! - 0) > tolerance ||
          Math.abs(data[i + 1]! - 255) > tolerance ||
          Math.abs(data[i + 2]! - 0) > tolerance
        ) {
          nonBg++;
        }
      }
      return { ratio: sampled === 0 ? 0 : nonBg / sampled, sampled, nonBg };
    },
    { base64, rect, tolerance },
  );
}

test('W-WM-1: PNG export carries the HULL watermark (non-background pixels inside its rect)', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { ...DOC, color: BG_COLOR });

  const buffer = await exportPngBuffer(page);
  // Export is at canvas-preset resolution (landscape = 1920×1080) regardless of the display
  // viewport (requirement C12).
  const rect = watermarkRectDocSpace(1920, 1080);
  const result = await nonBackgroundRatio(page, buffer, rect);

  console.log(
    `W-WM-1 rect={left:${rect.left.toFixed(1)},top:${rect.top.toFixed(1)},w:${rect.width.toFixed(1)},h:${rect.height.toFixed(1)}} sampled=${result.sampled} nonBg=${result.nonBg} ratio=${result.ratio.toFixed(4)}`,
  );
  // A healthy watermark fills a non-trivial fraction of its box with non-green pixels. The
  // SVG is mostly letterforms + opacity 0.35, so a conservative floor of 0.02 (2 %) proves
  // "something is being drawn there" without baking in the exact glyph coverage.
  expect(result.ratio).toBeGreaterThan(0.02);
});

test('W-WM-2: video export watermark presence (first frame)', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { ...DOC, color: BG_COLOR });

  // Record a 1-second clip. videoExport.recordCanvasToVideo wires an MP4/WebM depending on
  // the browser's MediaRecorder support.
  const dl = page.waitForEvent('download');
  const videoButton = page.getByRole('button', { name: '動画で書き出す' });
  if ((await videoButton.count()) === 0) {
    console.log(
      'W-WM-2 skipped: 「動画で書き出す」 button is not present (MediaRecorder unsupported in this chromium build).',
    );
    test.skip(true, 'Video export unavailable');
    return;
  }
  await videoButton.click();
  const d = await dl;
  const path = await d.path();
  const fs = await import('node:fs/promises');
  const buffer = await fs.readFile(path!);

  // Decode the first frame via <video> in the real browser (same decoder path a user would
  // see) and sample the watermark rect against the solid green background.
  const base64 = buffer.toString('base64');
  const rect = watermarkRectDocSpace(1920, 1080);
  const result = await page.evaluate(
    async ({ base64, rect }) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = `data:video/webm;base64,${base64}`;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('video decode failed'));
      });
      // Seek to the first frame.
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = 0.1;
      });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const x = Math.floor(rect.left);
      const y = Math.floor(rect.top);
      const w = Math.max(1, Math.floor(rect.right - rect.left));
      const h = Math.max(1, Math.floor(rect.bottom - rect.top));
      const data = ctx.getImageData(x, y, w, h).data;
      let nonBg = 0,
        sampled = 0;
      for (let i = 0; i < data.length; i += 4) {
        sampled++;
        if (
          Math.abs(data[i]! - 0) > 32 ||
          Math.abs(data[i + 1]! - 255) > 32 ||
          Math.abs(data[i + 2]! - 0) > 32
        ) {
          nonBg++;
        }
      }
      return { ratio: sampled === 0 ? 0 : nonBg / sampled, sampled, nonBg };
    },
    { base64, rect },
  );

  console.log(
    `W-WM-2 sampled=${result.sampled} nonBg=${result.nonBg} ratio=${result.ratio.toFixed(4)}`,
  );
  // Video codecs (VP9 / H.264) blur transparency edges, so the first-frame threshold is
  // looser than the PNG one but still well above zero.
  expect(result.ratio).toBeGreaterThan(0.01);
});
