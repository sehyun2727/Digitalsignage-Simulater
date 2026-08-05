import { expect, test } from '@playwright/test';

test.use({ locale: 'ja-JP' });

test('adds a text element and exports a PNG at the template resolution', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('まだ要素がありません')).toBeVisible();

  await page.getByRole('button', { name: 'テキストを追加' }).click();

  await expect(page.getByText('まだ要素がありません')).toBeHidden();
  await expect(page.getByRole('button', { name: '削除' })).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^signage-canvas_wall-led_\d{8}-\d{6}\.png$/);
});

test('undo removes the last added element and redo restores it', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'テキストを追加' }).click();
  await expect(page.getByRole('button', { name: '削除' })).toBeEnabled();

  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByText('まだ要素がありません')).toBeVisible();

  await page.getByRole('button', { name: 'やり直す' }).click();
  await expect(page.getByText('まだ要素がありません')).toBeHidden();
});

test('rejects an unsupported image file type', async ({ page }) => {
  await page.goto('/');

  const fileInput = page.getByLabel('画像を追加');
  await fileInput.setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });

  await expect(page.getByRole('status')).toHaveText('PNG、JPEG、WebP形式の画像のみ利用できます。');
});
