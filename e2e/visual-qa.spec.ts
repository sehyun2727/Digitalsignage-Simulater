import fs from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openSection } from './support/accordion.js';
import { readPngDimensions } from './support/png.js';
import {
  addScenePhotoBackground,
  addSpaceBackground,
  solidColorPng,
} from './support/spaceBackground.js';

test.use({ locale: 'ja-JP', viewport: { width: 1280, height: 800 } });

const DOCUMENT_SIZE = { width: 1920, height: 1080 };

/**
 * Golden-image visual QA (sprint spec section 6, `npm run qa:visual`): a small set of canonical,
 * deterministic scenes rendered on the live editor canvas, diffed against committed baselines via
 * Playwright's built-in `toHaveScreenshot`. This is intentionally separate from `npm run test:e2e`
 * (behavioral flows) and from the export pixel-sampling assertions elsewhere in e2e/ (which check
 * a handful of specific coordinates, not the whole rendered composition) — it exists to catch
 * whole-scene visual regressions in shadow/glow/blend/material rendering that sampled pixels alone
 * could miss.
 *
 * Baselines are platform-specific (Playwright suffixes snapshot files with the OS/browser they
 * were captured on). They must be generated in the same environment that will later compare
 * against them — see docs/quality-runbook.md for the exact Docker command used to generate the
 * committed baselines against a Linux runner matching CI, since this repo's CI runs on
 * ubuntu-latest while local development happens on Windows. Running `npm run qa:visual` directly
 * on a non-Linux machine will show diffs from font/anti-aliasing differences even when nothing
 * actually regressed.
 */

async function deselect(page: Page): Promise<void> {
  await page.locator('.editor-canvas-container').click({ position: { x: 5, y: 5 } });
}

/** Zeroes the LED grid / LCD highlight overlay so its animated-looking gradient doesn't perturb
 *  the golden image, matching the pattern already used by the pixel-verification e2e specs.
 *  v2-release follow-up: v2-S3 moved the material sliders inside the "appearance" accordion, so
 *  the slider isn't in the DOM until that section is open. First-time PR CI exposure (v2-S3
 *  push CI skips e2e per ci.yml:75) revealed the missing openSection — locally this often
 *  passed because another spec's localStorage/accordion state leaked across tests. */
async function zeroMaterialIntensity(page: Page): Promise<void> {
  await openSection(page, 'appearance');
  const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
  await intensitySlider.focus();
  await intensitySlider.press('Home');
  await intensitySlider.press('Tab');
}

async function addContent(page: Page, color: string): Promise<void> {
  const content = await solidColorPng(page, color);
  await page
    .getByTestId('editor-content-upload')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');
}

async function setPerspectiveCorner(
  page: Page,
  cornerLabel: '左上' | '右上' | '右下' | '左下',
  xFraction: number,
  yFraction: number,
): Promise<void> {
  const fieldset = page.locator('fieldset').filter({ hasText: cornerLabel });
  const xInput = fieldset.getByRole('spinbutton', { name: '横位置' });
  const yInput = fieldset.getByRole('spinbutton', { name: '縦位置' });
  await xInput.fill(String(xFraction));
  await xInput.blur();
  await yInput.fill(String(yFraction));
  await yInput.blur();
}

test.describe('golden-image visual QA', () => {
  test('wall-mounted LED display with content on the Natural preset', async ({ page }) => {
    await page.goto('/');
    await addSpaceBackground(page, { ...DOCUMENT_SIZE, color: '#334455' });
    await page.getByRole('button', { name: 'LED', exact: true }).click();

    await addContent(page, '#ff2d55');
    await zeroMaterialIntensity(page);

    await deselect(page);
    await expect(page.locator('.editor-canvas-container')).toHaveScreenshot('wall-led-natural.png');
  });

  test('freestanding portable product with a ground contact shadow', async ({ page }) => {
    await page.goto('/');
    await addSpaceBackground(page, { ...DOCUMENT_SIZE, color: '#556677' });

    // v2-S5 compound-model refactor: the portable button no longer opens a product-photo
    // upload wizard — a fixed template (docodemo photo + wheels/stand silhouette) is
    // spawned on click, and the screen receives content via the same Add Image flow
    // every other signage uses. Portable is intrinsically freestanding (has wheels),
    // so the 設置面 selector doesn't apply and isn't rendered for this signage type.
    await page.getByTestId('editor-add-portable').click();

    await addContent(page, '#ffcc00');
    await zeroMaterialIntensity(page);

    await deselect(page);
    await expect(page.locator('.editor-canvas-container')).toHaveScreenshot(
      'freestanding-portable.png',
    );
  });

  test('four-point perspective-placed display', async ({ page }) => {
    await page.goto('/');
    await addSpaceBackground(page, { ...DOCUMENT_SIZE, color: '#445566' });
    await page.getByRole('button', { name: 'LED', exact: true }).click();

    await addContent(page, '#2dd4bf');
    await zeroMaterialIntensity(page);

    await openSection(page, 'selected');
    await page.getByRole('button', { name: '空間に合わせて配置（パース）' }).click();
    await setPerspectiveCorner(page, '左上', 0.1, 0.15);
    await setPerspectiveCorner(page, '右上', 0.55, 0.1);
    await setPerspectiveCorner(page, '右下', 0.6, 0.55);
    await setPerspectiveCorner(page, '左下', 0.15, 0.6);
    await page.getByRole('button', { name: '適用' }).click();

    await deselect(page);
    await expect(page.locator('.editor-canvas-container')).toHaveScreenshot(
      'perspective-display.png',
    );
  });

  test('bright interior photo with an LCD wall display on the Natural preset', async ({ page }) => {
    await page.goto('/');
    await addScenePhotoBackground(
      page,
      'bright-interior',
      DOCUMENT_SIZE.width,
      DOCUMENT_SIZE.height,
    );
    await page.getByRole('button', { name: 'LCD' }).click();

    await addContent(page, '#2563eb');
    await zeroMaterialIntensity(page);

    await deselect(page);
    await expect(page.locator('.editor-canvas-container')).toHaveScreenshot(
      'bright-interior-lcd.png',
    );
  });

  test('dark interior photo with an LED wall display on the Night preset', async ({ page }) => {
    await page.goto('/');
    await addScenePhotoBackground(page, 'dark-interior', DOCUMENT_SIZE.width, DOCUMENT_SIZE.height);
    await page.getByRole('button', { name: 'LED', exact: true }).click();
    // v2-release follow-up: rendering-preset buttons live inside the 'appearance'
    // accordion (closed by default per v2-S3). Open it before the click or Playwright
    // waits forever on an unmounted element — same root cause as the setup fix in
    // `zeroMaterialIntensity`.
    await openSection(page, 'appearance');
    await page.getByRole('button', { name: '夜間', exact: true }).click();

    await addContent(page, '#f97316');
    await zeroMaterialIntensity(page);

    await deselect(page);
    await expect(page.locator('.editor-canvas-container')).toHaveScreenshot(
      'dark-interior-led.png',
    );
  });

  test('outdoor daylight photo with an LED display on the Bright preset', async ({ page }) => {
    await page.goto('/');
    await addScenePhotoBackground(
      page,
      'outdoor-daylight',
      DOCUMENT_SIZE.width,
      DOCUMENT_SIZE.height,
    );
    await page.getByRole('button', { name: 'LED', exact: true }).click();
    await openSection(page, 'appearance');
    await page.getByRole('button', { name: '明るい屋外', exact: true }).click();

    await addContent(page, '#22c55e');
    await zeroMaterialIntensity(page);

    await deselect(page);
    await expect(page.locator('.editor-canvas-container')).toHaveScreenshot(
      'outdoor-daylight-led.png',
    );
  });
});

test.describe('golden-image PNG export validity', () => {
  test('a real-photo scenario exports a well-formed, correctly sized PNG', async ({ page }) => {
    await page.goto('/');
    await addScenePhotoBackground(
      page,
      'bright-interior',
      DOCUMENT_SIZE.width,
      DOCUMENT_SIZE.height,
    );
    await page.getByRole('button', { name: 'LCD' }).click();
    await addContent(page, '#2563eb');
    await zeroMaterialIntensity(page);
    await deselect(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('editor-export-png-header').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const path = await download.path();
    expect(path).toBeTruthy();
    const buffer = await fs.readFile(path!);
    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(readPngDimensions(buffer)).toEqual(DOCUMENT_SIZE);
  });
});
