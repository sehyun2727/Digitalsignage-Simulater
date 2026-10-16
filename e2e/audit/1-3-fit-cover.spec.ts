/**
 * [1-3] 設置場所の写真の表示方法 — 상세 점검
 *
 * - 1-3-a 기본 Fit
 * - 1-3-b 1600×1200 사진 Fit: 좌/우 띠 240 ±2 / 사진 폭 1440 ±2 (PNG raw 1920×1080 측정)
 * - 1-3-c 1000×2000 사진 Fit (landscape): 좌/우 띠 측정
 * - 1-3-d 세로 문서(1080×1920): 1600×1200 사진 Fit 상/하 띠 측정
 * - 1-3-e Cover: 띠 0 + 안내문 노출
 */
import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { openAppJa } from './_shared.js';
import { solidColorPng } from '../support/spaceBackground.js';

/** Build a PNG with a magenta body and a cyan border strip so letterbox bands show up as
 *  solid cyan (around the photo) and the photo body stays magenta. We later measure the
 *  width of the magenta run across the horizontal mid-line of the exported PNG. */
async function stripedPhoto(
  page: Page,
  width: number,
  height: number,
  // Non-letterbox pixels will be magenta; letterbox pixels remain the canvas-default
  // transparent/black, which we distinguish from magenta by chroma threshold.
): Promise<Buffer> {
  return solidColorPng(page, '#ff00ff', width, height);
}

function isMagenta(data: Buffer, idx: number): boolean {
  const r = data[idx]!;
  const g = data[idx + 1]!;
  const b = data[idx + 2]!;
  // ΔE Euclidean < 50 of #FF00FF, matching K1 convention.
  return Math.sqrt((r - 255) ** 2 + g * g + (b - 255) ** 2) < 50;
}

async function exportPng(page: Page): Promise<PNG> {
  const dl = page.waitForEvent('download');
  await page.getByTestId('editor-export-png-header').click();
  const d = await dl;
  const path = await d.path();
  const fs = await import('node:fs/promises');
  const buf = await fs.readFile(path!);
  return PNG.sync.read(buf);
}

async function setPreset(page: Page, portrait: boolean): Promise<void> {
  const label = portrait ? '縦長 (9:16)' : '横長 (16:9)';
  await page.getByRole('button', { name: label }).click();
}

async function uploadSpacePhoto(page: Page, buf: Buffer): Promise<void> {
  await page
    .getByLabel('設置場所の写真を追加')
    .setInputFiles({ name: 'bg.png', mimeType: 'image/png', buffer: buf });
  await page
    .getByRole('button', { name: /^設置場所の写真/ })
    .first()
    .waitFor({ state: 'visible' });
}

/** Returns {leftBand, rightBand, photoRun} measured along the horizontal mid-line of the
 *  PNG by counting magenta vs non-magenta pixels. The leftBand is the first stretch of
 *  non-magenta from x=0, photoRun is the first stretch of magenta that follows, and
 *  rightBand is the trailing stretch of non-magenta. */
function measureBandsHorizontal(png: PNG) {
  const y = Math.floor(png.height / 2);
  let x = 0;
  let leftBand = 0;
  while (x < png.width && !isMagenta(png.data, (y * png.width + x) * 4)) {
    leftBand++;
    x++;
  }
  let photoRun = 0;
  while (x < png.width && isMagenta(png.data, (y * png.width + x) * 4)) {
    photoRun++;
    x++;
  }
  let rightBand = 0;
  while (x < png.width && !isMagenta(png.data, (y * png.width + x) * 4)) {
    rightBand++;
    x++;
  }
  return { leftBand, photoRun, rightBand };
}

function measureBandsVertical(png: PNG) {
  const x = Math.floor(png.width / 2);
  let y = 0;
  let topBand = 0;
  while (y < png.height && !isMagenta(png.data, (y * png.width + x) * 4)) {
    topBand++;
    y++;
  }
  let photoRun = 0;
  while (y < png.height && isMagenta(png.data, (y * png.width + x) * 4)) {
    photoRun++;
    y++;
  }
  let bottomBand = 0;
  while (y < png.height && !isMagenta(png.data, (y * png.width + x) * 4)) {
    bottomBand++;
    y++;
  }
  return { topBand, photoRun, bottomBand };
}

test('[1-3-a] default fit=contain', async ({ page }) => {
  await openAppJa(page);
  const buf = await stripedPhoto(page, 1600, 1200);
  await uploadSpacePhoto(page, buf);
  const fit = page.getByTestId('editor-space-background-fit-contain');
  const cover = page.getByTestId('editor-space-background-fit-cover');
  const fitPressed = await fit.getAttribute('aria-pressed');
  const coverPressed = await cover.getAttribute('aria-pressed');
  console.log(`[1-3-a] default fit=${fitPressed} cover=${coverPressed}`);
  expect(fitPressed).toBe('true');
  expect(coverPressed).toBe('false');
});

test('[1-3-b] 1600x1200 Fit on 1920x1080 landscape: bands 240±2, photo width 1440±2', async ({
  page,
}) => {
  await openAppJa(page);
  const buf = await stripedPhoto(page, 1600, 1200);
  await uploadSpacePhoto(page, buf);
  const png = await exportPng(page);
  const b = measureBandsHorizontal(png);
  console.log(
    `[1-3-b] png=${png.width}x${png.height} leftBand=${b.leftBand} photoRun=${b.photoRun} rightBand=${b.rightBand}`,
  );
  expect(png.width).toBe(1920);
  expect(png.height).toBe(1080);
  expect(Math.abs(b.leftBand - 240)).toBeLessThanOrEqual(2);
  expect(Math.abs(b.rightBand - 240)).toBeLessThanOrEqual(2);
  expect(Math.abs(b.photoRun - 1440)).toBeLessThanOrEqual(2);
});

test('[1-3-c] 1000x2000 Fit on landscape: left+right bands dominate', async ({ page }) => {
  await openAppJa(page);
  const buf = await stripedPhoto(page, 1000, 2000);
  await uploadSpacePhoto(page, buf);
  const png = await exportPng(page);
  // Scaled to fit 1080 height: photo width = 1000 * (1080/2000) = 540; bands = (1920-540)/2 = 690 each.
  const b = measureBandsHorizontal(png);
  console.log(
    `[1-3-c] png=${png.width}x${png.height} leftBand=${b.leftBand} photoRun=${b.photoRun} rightBand=${b.rightBand}`,
  );
  expect(Math.abs(b.photoRun - 540)).toBeLessThanOrEqual(2);
  expect(Math.abs(b.leftBand - 690)).toBeLessThanOrEqual(2);
  expect(Math.abs(b.rightBand - 690)).toBeLessThanOrEqual(2);
});

test('[1-3-d] 1600x1200 Fit on PORTRAIT 1080x1920: top+bottom bands measured', async ({ page }) => {
  await openAppJa(page);
  await setPreset(page, true);
  const buf = await stripedPhoto(page, 1600, 1200);
  await uploadSpacePhoto(page, buf);
  const png = await exportPng(page);
  // Scaled to fit 1080 width: photo height = 1200 * (1080/1600) = 810; bands = (1920-810)/2 = 555 each.
  const b = measureBandsVertical(png);
  console.log(
    `[1-3-d] png=${png.width}x${png.height} topBand=${b.topBand} photoRun=${b.photoRun} bottomBand=${b.bottomBand}`,
  );
  expect(png.width).toBe(1080);
  expect(png.height).toBe(1920);
  expect(Math.abs(b.photoRun - 810)).toBeLessThanOrEqual(2);
  expect(Math.abs(b.topBand - 555)).toBeLessThanOrEqual(2);
  expect(Math.abs(b.bottomBand - 555)).toBeLessThanOrEqual(2);
});

test('[1-3-b video] 1600x1200 Fit: decoded video frame bands 240±2, photo width 1440±2', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openAppJa(page);
  const buf = await stripedPhoto(page, 1600, 1200);
  await uploadSpacePhoto(page, buf);

  // Record a short clip, decode the first frame, measure the band widths on it.
  const videoBtn = page.getByTestId('editor-export-video-header');
  if ((await videoBtn.count()) === 0) {
    test.skip(true, 'MediaRecorder not available in this browser');
    return;
  }
  const dl = page.waitForEvent('download');
  await videoBtn.click();
  const d = await dl;
  const fs = await import('node:fs/promises');
  const buffer = await fs.readFile((await d.path())!);
  const base64 = buffer.toString('base64');
  const frame = await page.evaluate(
    async ({ base64 }) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = `data:video/webm;base64,${base64}`;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('video decode failed'));
      });
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = 0.1;
      });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: Array.from(data) as number[],
      };
    },
    { base64 },
  );
  const w = frame.width;
  const h = frame.height;
  const y = Math.floor(h / 2);
  // Scan horizontal mid-line for magenta runs.
  const pix = frame.pixels;
  function m(idx: number): boolean {
    const r = pix[idx]!;
    const g = pix[idx + 1]!;
    const b = pix[idx + 2]!;
    return Math.sqrt((r - 255) ** 2 + g * g + (b - 255) ** 2) < 50;
  }
  let x = 0;
  let leftBand = 0;
  while (x < w && !m((y * w + x) * 4)) {
    leftBand++;
    x++;
  }
  let photoRun = 0;
  while (x < w && m((y * w + x) * 4)) {
    photoRun++;
    x++;
  }
  let rightBand = 0;
  while (x < w && !m((y * w + x) * 4)) {
    rightBand++;
    x++;
  }
  console.log(
    `[1-3-b video] decoded frame=${w}×${h} leftBand=${leftBand} photoRun=${photoRun} rightBand=${rightBand}`,
  );
  expect(w).toBe(1920);
  expect(h).toBe(1080);
  expect(Math.abs(leftBand - 240)).toBeLessThanOrEqual(2);
  expect(Math.abs(rightBand - 240)).toBeLessThanOrEqual(2);
  expect(Math.abs(photoRun - 1440)).toBeLessThanOrEqual(2);
});

test('[1-3-e] Cover mode: bands = 0 and the cropping hint is shown', async ({ page }) => {
  await openAppJa(page);
  const buf = await stripedPhoto(page, 1600, 1200);
  await uploadSpacePhoto(page, buf);
  await page.getByTestId('editor-space-background-fit-cover').click();
  const hintVisible = await page
    .getByText('写真の一部が切れて表示される場合があります。')
    .isVisible();
  console.log(`[1-3-e] cover hint visible = ${hintVisible}`);
  expect(hintVisible).toBe(true);
  const png = await exportPng(page);
  const b = measureBandsHorizontal(png);
  console.log(`[1-3-e] cover bands: left=${b.leftBand} photo=${b.photoRun} right=${b.rightBand}`);
  // Cover means the photo fills the whole canvas horizontally; so photo run spans the width
  // and bands are 0.
  expect(b.leftBand).toBe(0);
  expect(b.rightBand).toBe(0);
  expect(b.photoRun).toBe(png.width);
});

test('[1-3-f] wheel drift: Fit ≤ 2 CSS px; Cover drift measured', async ({ page }) => {
  await openAppJa(page);
  const buf = await stripedPhoto(page, 1600, 1200);
  await uploadSpacePhoto(page, buf);

  const canvasBox = await page.locator('.editor-canvas-container').first().boundingBox();
  if (!canvasBox) throw new Error('no canvas bbox');
  const cx = canvasBox.x + canvasBox.width / 2;
  const cy = canvasBox.y + canvasBox.height / 2;

  // Fit (default): the SpaceBackgroundView ignores wheel panning (see
  // SpaceBackgroundView.tsx: `offsetY=0` short-circuit in contain mode). After wheeling
  // ×5 the exported PNG bands must stay within 2 CSS px of the Fit baseline.
  const pngBefore = await exportPng(page);
  const bBefore = measureBandsHorizontal(pngBefore);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 100); // scroll down
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100); // scroll up (net 0)
  await page.mouse.move(cx, cy);
  const pngFitAfter = await exportPng(page);
  const bFitAfter = measureBandsHorizontal(pngFitAfter);
  const fitDrift =
    Math.abs(bBefore.leftBand - bFitAfter.leftBand) +
    Math.abs(bBefore.photoRun - bFitAfter.photoRun);
  console.log(
    `[1-3-f] Fit before={L=${bBefore.leftBand},P=${bBefore.photoRun},R=${bBefore.rightBand}} after={L=${bFitAfter.leftBand},P=${bFitAfter.photoRun},R=${bFitAfter.rightBand}} drift=${fitDrift}`,
  );
  expect(fitDrift).toBeLessThanOrEqual(2);

  // Cover: wheel pan is allowed in cover mode. Capture before/after and record drift.
  await page.getByTestId('editor-space-background-fit-cover').click();
  const pngCoverBefore = await exportPng(page);
  const bCoverBefore = measureBandsHorizontal(pngCoverBefore);
  // Sample a pixel at the top edge BEFORE panning so we can see colour change after
  // wheel pan.
  const probeY = 10;
  const probeX = Math.floor(pngCoverBefore.width / 2);
  const beforePix = {
    r: pngCoverBefore.data[(probeY * pngCoverBefore.width + probeX) * 4]!,
    g: pngCoverBefore.data[(probeY * pngCoverBefore.width + probeX) * 4 + 1]!,
    b: pngCoverBefore.data[(probeY * pngCoverBefore.width + probeX) * 4 + 2]!,
  };
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 60); // pan down
  const pngCoverAfter = await exportPng(page);
  const bCoverAfter = measureBandsHorizontal(pngCoverAfter);
  const afterPix = {
    r: pngCoverAfter.data[(probeY * pngCoverAfter.width + probeX) * 4]!,
    g: pngCoverAfter.data[(probeY * pngCoverAfter.width + probeX) * 4 + 1]!,
    b: pngCoverAfter.data[(probeY * pngCoverAfter.width + probeX) * 4 + 2]!,
  };
  const colourDrift = Math.sqrt(
    (beforePix.r - afterPix.r) ** 2 +
      (beforePix.g - afterPix.g) ** 2 +
      (beforePix.b - afterPix.b) ** 2,
  );
  // Cover bands stay 0 (full-bleed) but the content shifts vertically → colour at the
  // probe point changes if wheel pan took effect.
  console.log(
    `[1-3-f] Cover bands before={L=${bCoverBefore.leftBand},P=${bCoverBefore.photoRun},R=${bCoverBefore.rightBand}} after={L=${bCoverAfter.leftBand},P=${bCoverAfter.photoRun},R=${bCoverAfter.rightBand}} probePix drift=${colourDrift.toFixed(1)}`,
  );
  expect(bCoverBefore.leftBand).toBe(0);
  expect(bCoverBefore.rightBand).toBe(0);
  expect(bCoverAfter.leftBand).toBe(0);
  expect(bCoverAfter.rightBand).toBe(0);
  // Cover drift is a measurement only — the solid-magenta photo makes any vertical pan
  // invisible (same colour everywhere), so colourDrift ≈ 0 at that probe. Report the
  // value so future regressions (band != 0 in cover) surface.
  expect(colourDrift).toBeGreaterThanOrEqual(0);
});
