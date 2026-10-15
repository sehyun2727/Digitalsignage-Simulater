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
