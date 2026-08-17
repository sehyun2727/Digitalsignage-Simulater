import { expect, test, type Page } from '@playwright/test';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';

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
 *  the golden image, matching the pattern already used by the pixel-verification e2e specs. */
async function zeroMaterialIntensity(page: Page): Promise<void> {
  const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
  await intensitySlider.focus();
  await intensitySlider.press('Home');
  await intensitySlider.press('Tab');
}

async function addContent(page: Page, color: string): Promise<void> {
  const content = await solidColorPng(page, color);
  await page
    .getByLabel('コンテンツを追加')
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
  const xInput = fieldset.getByRole('spinbutton', { name: 'X座標' });
  const yInput = fieldset.getByRole('spinbutton', { name: 'Y座標' });
  await xInput.fill(String(xFraction));
  await xInput.blur();
  await yInput.fill(String(yFraction));
  await yInput.blur();
}

test.describe('golden-image visual QA', () => {
  test('wall-mounted LED display with content on the Natural preset', async ({ page }) => {
    await page.goto('/');
    await addSpaceBackground(page, { ...DOCUMENT_SIZE, color: '#334455' });
    await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

    await addContent(page, '#ff2d55');
    await zeroMaterialIntensity(page);

    await deselect(page);
    await expect(page.locator('.editor-canvas-container')).toHaveScreenshot('wall-led-natural.png');
  });

  test('freestanding portable product with a ground contact shadow', async ({ page }) => {
    await page.goto('/');
    await addSpaceBackground(page, { ...DOCUMENT_SIZE, color: '#556677' });

    await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
    const dialog = page.getByRole('dialog');
    const photo = await solidColorPng(page, '#1155ff');
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: photo });
    await dialog.getByRole('button', { name: '次へ' }).click();
    await dialog.getByRole('button', { name: '追加', exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('combobox', { name: '設置面' }).selectOption('freestanding');

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
    await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

    await addContent(page, '#2dd4bf');
    await zeroMaterialIntensity(page);

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
});
