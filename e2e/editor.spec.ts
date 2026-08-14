import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { readPngDimensions } from './support/png.js';
import { addSpaceBackground } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP' });

test('adds a text element and exports a PNG at the space photo resolution', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByText(
      'まずは空間写真をアップロードしてください。写真の縦横比がそのまま書き出しサイズになります。',
    ),
  ).toBeVisible();

  await addSpaceBackground(page, { width: 1920, height: 1080 });
  await expect(page.locator('.editor-empty-hint')).toBeVisible();

  await page.getByRole('button', { name: 'テキストを追加' }).click();

  await expect(page.locator('.editor-empty-hint')).toBeHidden();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^signage-canvas_\d{8}-\d{6}\.png$/);
});

test('undo removes the last added element and redo restores it', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  await page.getByRole('button', { name: 'テキストを追加' }).click();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.locator('.editor-empty-hint')).toBeVisible();

  await page.getByRole('button', { name: 'やり直す' }).click();
  await expect(page.locator('.editor-empty-hint')).toBeHidden();
});

test('rejects an unsupported image file type', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  const fileInput = page.getByLabel('画像を追加');
  await fileInput.setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });

  await expect(page.getByRole('status')).toHaveText('PNG、JPEG、WebP形式の画像のみ利用できます。');
});

test('exports at the exact resolution of the uploaded space photo (1920x1080)', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  await page.getByRole('button', { name: 'テキストを追加' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const buffer = await fs.readFile(path!);
  const dimensions = readPngDimensions(buffer);
  expect(dimensions).toEqual({ width: 1920, height: 1080 });
});

test('exports at the exact resolution of a portrait space photo (1080x1920)', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1080, height: 1920 });

  await page.getByRole('button', { name: 'テキストを追加' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const buffer = await fs.readFile(path!);
  const dimensions = readPngDimensions(buffer);
  expect(dimensions).toEqual({ width: 1080, height: 1920 });
});

test('exported PNG is byte-identical whether the element is selected or not (no selection UI leaks into export)', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  // addText auto-selects the new element, so this first export happens while selected.
  await page.getByRole('button', { name: 'テキストを追加' }).click();

  const firstDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const firstDownload = await firstDownloadPromise;
  const firstBuffer = await fs.readFile((await firstDownload.path())!);

  // Click on an empty area of the canvas (top-left corner, away from the centered
  // text element) to deselect, so the Transformer is no longer attached to anything.
  await page.locator('.editor-canvas-container').click({ position: { x: 5, y: 5 } });
  await expect(page.getByText('要素を選択するとプロパティを編集できます。')).toBeVisible();

  const secondDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const secondDownload = await secondDownloadPromise;
  const secondBuffer = await fs.readFile((await secondDownload.path())!);

  expect(firstBuffer.equals(secondBuffer)).toBe(true);
});

test('typing in the text-content field does not trigger the delete or undo keyboard shortcuts', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  await page.getByRole('button', { name: 'テキストを追加' }).click();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();

  const textField = page.getByLabel('テキスト内容');
  await textField.click();
  await textField.fill('hello');
  await textField.press('Backspace');
  await textField.press('Control+z');

  // The object must still exist: neither Backspace nor Ctrl+Z leaked past the
  // editable textarea to trigger the global deleteSelected/undo shortcuts.
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();
  await expect(page.locator('.editor-empty-hint')).toBeHidden();
});
