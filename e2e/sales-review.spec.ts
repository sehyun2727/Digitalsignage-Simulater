import { expect, test } from '@playwright/test';
import { addSpaceBackground } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP' });

test('entering sales review mode hides the toolbar and clears the selection', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: '営業レビューモード', exact: true }).click();

  await expect(
    page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }),
  ).toBeHidden();
  await expect(
    page.getByText('編集操作を無効にした、お客様にそのままお見せできる表示です。'),
  ).toBeVisible();
});

test('the canvas ignores clicks and drops while in sales review mode', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  await page.getByRole('button', { name: '営業レビューモード', exact: true }).click();
  const box = (await page.locator('.editor-canvas-container').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await page.getByRole('button', { name: '編集に戻る', exact: true }).click();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeDisabled();
});

test('the exit button restores the toolbar and editing header controls', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page);

  await page.getByRole('button', { name: '営業レビューモード', exact: true }).click();
  await expect(page.getByRole('button', { name: '元に戻す' })).toBeHidden();

  await page.getByRole('button', { name: '編集に戻る', exact: true }).click();

  await expect(
    page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '元に戻す' })).toBeVisible();
});
