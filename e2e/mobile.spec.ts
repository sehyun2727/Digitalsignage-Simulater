import fs from 'node:fs/promises';
import { devices, expect, test } from '@playwright/test';
import { readPngDimensions } from './support/png.js';

// Emulates a mobile Chromium viewport/touch profile (userAgent, isMobile, hasTouch,
// deviceScaleFactor from Playwright's iPhone 13 device descriptor) at the exact
// 390x844 viewport this suite is required to cover. This is Chromium mobile-viewport
// emulation, not a real device or real iOS Safari — see the Sprint 2.1 completion
// report for what "verified" means here.
const iPhone13 = devices['iPhone 13'];

test.use({
  // Pick individual fields rather than spreading the whole device descriptor: it
  // also sets defaultBrowserType: 'webkit', which would override the project's
  // configured Chromium browser. This is Chromium mobile-viewport/touch emulation,
  // not real Safari.
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: iPhone13.isMobile,
  hasTouch: iPhone13.hasTouch,
  viewport: { width: 390, height: 844 },
  locale: 'ja-JP',
});

async function solidColorPng(
  page: import('@playwright/test').Page,
  color: string,
  size = 100,
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ color, size }) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      return canvas.toDataURL('image/png');
    },
    { color, size },
  );
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

test('full mobile content and export workflow at 390x844 (Wall LED)', async ({ page }) => {
  // 1. Open the app.
  await page.goto('/');

  // 2. Confirm the Japanese default (default locale, no stored preference).
  await expect(page.getByRole('heading', { name: 'Digital Signage Simulator' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

  // 3. Upload a valid space background photo.
  const spaceBackground = await solidColorPng(page, '#1155ff');
  await page
    .getByLabel('空間写真を追加')
    .setInputFiles({ name: 'space.png', mimeType: 'image/png', buffer: spaceBackground });
  await expect(page.getByRole('button', { name: '空間写真を削除' })).toBeVisible();

  // 4. Add a Wall LED display.
  await page.getByRole('button', { name: '壁掛けLEDを追加' }).click();

  // 5. Select the display (adding it auto-selects it; the properties panel confirms this).
  await expect(
    page.getByText('まだコンテンツがありません。画像を追加してください。'),
  ).toBeVisible();

  // 6. Upload display content.
  const content = await solidColorPng(page, '#00ff00');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();

  // 7. Switch fit between Contain and Cover.
  const fitSelect = page.getByRole('combobox', { name: '表示方法' });
  await expect(fitSelect).toHaveValue('contain');
  await fitSelect.selectOption('cover');
  await expect(fitSelect).toHaveValue('cover');

  // 8. Change material Outdoor LED -> LCD -> back to Outdoor LED.
  const materialSelect = page.getByRole('combobox', { name: 'ディスプレイ素材' });
  await expect(materialSelect).toHaveValue('outdoor-led');
  await materialSelect.selectOption('lcd');
  await expect(materialSelect).toHaveValue('lcd');
  await materialSelect.selectOption('outdoor-led');
  await expect(materialSelect).toHaveValue('outdoor-led');

  // 9. Adjust intensity and brightness.
  const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
  await intensitySlider.focus();
  await intensitySlider.press('End');
  await intensitySlider.press('Tab');

  const brightnessSlider = page.getByRole('slider', { name: '明るさ' });
  await brightnessSlider.focus();
  await brightnessSlider.press('Home');
  await brightnessSlider.press('Tab');

  // 10. Export PNG.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  // 11. Confirm the download happened.
  const path = await download.path();
  expect(path).toBeTruthy();
  const buffer = await fs.readFile(path!);

  // 12. Confirm the exported PNG is 1920x1080 for the Wall LED (wall-led) template.
  expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });

  // 13. Confirm no horizontal overflow at this viewport.
  await expectNoHorizontalOverflow(page);

  // 14. Confirm key controls are visible/reachable (scrolled into view without failing).
  await page.getByRole('button', { name: 'PNGで書き出す' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'PNGで書き出す' })).toBeVisible();
  await page.getByRole('button', { name: '壁掛けLEDを追加' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: '壁掛けLEDを追加' })).toBeVisible();

  // 15. Confirm the canvas region is present and usable (rendered with a non-zero box).
  const canvasBox = await page.locator('.editor-canvas-container').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox!.width).toBeGreaterThan(0);
  expect(canvasBox!.height).toBeGreaterThan(0);

  // 16. Confirm the HULL CTA is present and points at the approved external URL.
  const hullLink = page.getByRole('link', { name: 'HULLに問い合わせる' });
  await hullLink.scrollIntoViewIfNeeded();
  await expect(hullLink).toBeVisible();
  await expect(hullLink).toHaveAttribute('href', 'https://hull-inc.jp/contact');
  await expect(hullLink).toHaveAttribute('target', '_blank');
  await expect(hullLink).toHaveAttribute('rel', 'noopener noreferrer');

  // 17. Confirm the independent-service disclaimer is visible/reachable.
  const disclaimer = page.locator('.disclaimer');
  await disclaimer.scrollIntoViewIfNeeded();
  await expect(disclaimer).toBeVisible();
});

test('mobile smoke: Stand Display content and export at 390x844', async ({ page }) => {
  await page.goto('/');

  // Switch template, add a Stand Display, apply content, export, and confirm the
  // portrait 1080x1920 resolution — a lighter-weight companion to the Wall LED flow
  // above, covering the second template shape on a mobile viewport.
  await page.getByLabel('テンプレート').selectOption('stand-display');
  await page.getByRole('button', { name: 'スタンド型ディスプレイを追加' }).click();
  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');

  const content = await solidColorPng(page, '#ff8800');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const buffer = await fs.readFile(path!);
  expect(readPngDimensions(buffer)).toEqual({ width: 1080, height: 1920 });

  await expectNoHorizontalOverflow(page);
});

test('mobile: adds a custom portable product with a screen region and exports it at 390x844', async ({
  page,
}) => {
  await page.goto('/');

  // 1. Open the portable builder and confirm it renders as an accessible dialog at this
  // viewport (no horizontal overflow introduced by the modal itself).
  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // 2. Upload a product photo (touch-viewport file input still accepts setInputFiles).
  const productPhoto = await solidColorPng(page, '#1155ff');
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: productPhoto });
  const nextButton = dialog.getByRole('button', { name: '次へ' });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  // 3. Keep the default screen region and add the object.
  await expect(dialog.getByRole('heading', { name: '画面領域を指定' })).toBeVisible();
  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('ポータブル製品', { exact: true })).toBeVisible();

  // 4. Upload screen content onto the new portable object.
  const content = await solidColorPng(page, '#ff8800');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();

  // 5. Export and confirm the resolution still matches the active template exactly.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const buffer = await fs.readFile(path!);
  expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });

  // 6. No horizontal overflow was introduced by the portable toolbar section or properties.
  await expectNoHorizontalOverflow(page);
});

test('mobile: dragging the portable screen region moves and resizes it at 390x844', async ({
  page,
}) => {
  // Playwright's touch-viewport emulation (hasTouch/isMobile from the iPhone 13 descriptor set
  // above) still drives page.mouse as pointer input, exercising the same onPointerDown/Move/Up
  // handlers a real touch drag would use - see the file header note on what "mobile" verifies
  // here. Pixel-precision behavior (letterbox mapping, min-size clamp, exact history counts) is
  // already covered by the desktop real-pointer-drag suite in portable.spec.ts; this is a
  // usability smoke check that the same interaction isn't broken by the narrow viewport/dialog.
  await page.goto('/');
  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  const productPhoto = await solidColorPng(page, '#1155ff');
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: productPhoto });
  await dialog.getByRole('button', { name: '次へ' }).click();
  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: '画面領域を編集' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByRole('heading', { name: '画面領域を指定' })).toBeVisible();

  const box = editDialog.locator('.portable-region-box');
  const before = (await box.boundingBox())!;

  // Move: drag inside the region box.
  const center = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 20, center.y + 15, { steps: 5 });
  await page.mouse.up();

  const moved = (await box.boundingBox())!;
  expect(moved.x).toBeCloseTo(before.x + 20, 0);
  expect(moved.y).toBeCloseTo(before.y + 15, 0);
  await expect(editDialog.getByRole('alert')).toHaveCount(0);

  // Resize: drag the se handle outward.
  const seHandle = editDialog.locator('.portable-region-handle--se');
  const seBefore = (await seHandle.boundingBox())!;
  const seCenter = { x: seBefore.x + seBefore.width / 2, y: seBefore.y + seBefore.height / 2 };
  await page.mouse.move(seCenter.x, seCenter.y);
  await page.mouse.down();
  await page.mouse.move(seCenter.x + 15, seCenter.y + 15, { steps: 5 });
  await page.mouse.up();

  const resized = (await box.boundingBox())!;
  expect(resized.width).toBeGreaterThan(moved.width);
  expect(resized.height).toBeGreaterThan(moved.height);
  await expect(editDialog.getByRole('alert')).toHaveCount(0);

  await editDialog.getByRole('button', { name: '保存' }).click();
  await expect(editDialog).toBeHidden();

  await expectNoHorizontalOverflow(page);
});
