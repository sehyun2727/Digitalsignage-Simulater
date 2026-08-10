import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { readPngDimensions } from './support/png.js';
import { samplePngPixels } from './support/pixels.js';

test.use({ locale: 'ja-JP' });

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

/**
 * A square (1:1) product photo keeps computeDefaultPortableSize's placement math simple: on the
 * default wall-led template (1920x1080) it places a 540x540 object centered at (960, 540), i.e.
 * spanning x:[690,1230] y:[270,810] - the coordinates the pixel-verification tests below rely on.
 */
async function uploadPortableProductPhoto(
  dialog: import('@playwright/test').Locator,
  color: string,
) {
  const page = dialog.page();
  const photo = await solidColorPng(page, color);
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: photo });
}

test('walks the photo and drag-to-draw region steps to add a portable product, then re-edits its region', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '次へ' })).toBeDisabled();

  await uploadPortableProductPhoto(dialog, '#1155ff');
  const nextButton = dialog.getByRole('button', { name: '次へ' });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(dialog.getByRole('heading', { name: '画面領域を指定' })).toBeVisible();

  const preview = dialog.locator('.portable-region-preview');
  const box = (await preview.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7, { steps: 5 });
  await page.mouse.up();

  const widthInput = dialog.getByRole('spinbutton', { name: '領域の幅' });
  const widthValue = Number(await widthInput.inputValue());
  expect(widthValue).toBeCloseTo(0.7, 1);

  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('ポータブル製品', { exact: true })).toBeVisible();

  // Re-enter the region editor for the object just placed; it must skip straight to the
  // region step (no photo step, no Back button) and persist an edit back onto the object.
  await page.getByRole('button', { name: '画面領域を編集' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByRole('heading', { name: '画面領域を指定' })).toBeVisible();
  await expect(editDialog.getByRole('button', { name: '戻る' })).toBeHidden();

  const editWidthInput = editDialog.getByRole('spinbutton', { name: '領域の幅' });
  await editWidthInput.fill('0.4');
  await editDialog.getByRole('button', { name: '保存' }).click();
  await expect(editDialog).toBeHidden();
});

test('rejects a screen region smaller than the minimum size and keeps the dialog open', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await uploadPortableProductPhoto(dialog, '#1155ff');
  await dialog.getByRole('button', { name: '次へ' }).click();

  const widthInput = dialog.getByRole('spinbutton', { name: '領域の幅' });
  await widthInput.fill('0.01');
  await dialog.getByRole('button', { name: '追加', exact: true }).click();

  await expect(
    dialog.getByText('画面領域が小さすぎます。写真の縦横それぞれ5%以上を指定してください。'),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
});

test('cancelling the builder does not add a portable object', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('要素を選択するとプロパティを編集できます。')).toBeVisible();
});

test('undo removes an added portable product and redo restores it', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await uploadPortableProductPhoto(dialog, '#1155ff');
  await dialog.getByRole('button', { name: '次へ' }).click();
  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(page.getByText('まだ要素がありません')).toBeHidden();

  // undo/redo clear selection along with restoring/removing the object (see editorStore.ts),
  // so the empty-canvas hint - not the properties panel - is what actually reflects whether
  // the portable object is present.
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByText('まだ要素がありません')).toBeVisible();

  await page.getByRole('button', { name: 'やり直す' }).click();
  await expect(page.getByText('まだ要素がありません')).toBeHidden();
});

test('applies content and material to a portable product; export is clipped to its screen region and defaults to LCD', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await uploadPortableProductPhoto(dialog, '#1155ff');
  await dialog.getByRole('button', { name: '次へ' }).click();
  // Keep the default region (0.2, 0.2, 0.6, 0.6) - centered and symmetric, so the screen
  // region's center coincides with the object's own center regardless of object size.
  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(page.getByText('ポータブル製品', { exact: true })).toBeVisible();

  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');

  const content = await solidColorPng(page, '#ff0000');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();

  await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');

  // Zero out the LCD highlight/material overlay so it doesn't perturb the sampled pixels.
  const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
  await intensitySlider.focus();
  await intensitySlider.press('Home');
  await intensitySlider.press('Tab');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const buffer = await fs.readFile(path!);
  expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });

  // A square 100x100 product photo on the wall-led (1920x1080) template places a centered
  // 540x540 object at x:[690,1230] y:[270,810]; the default 0.2/0.2/0.6/0.6 screen region is
  // centered within it, so its center (960, 540) coincides with the object's own center.
  // (700, 280) sits inside the product photo but well outside that centered screen region.
  const [productPixel, screenCenterPixel] = await samplePngPixels(page, buffer, [
    [700, 280],
    [960, 540],
  ]);

  expect(productPixel.r).toBeLessThan(100);
  expect(productPixel.b).toBeGreaterThan(150);
  expect(screenCenterPixel.r).toBeGreaterThan(200);
  expect(screenCenterPixel.g).toBeLessThan(50);
  expect(screenCenterPixel.b).toBeLessThan(50);
});
