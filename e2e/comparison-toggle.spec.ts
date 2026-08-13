import { expect, test } from '@playwright/test';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP' });

test('switching to the original view hides signage objects and clears selection', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'オリジナル', exact: true }).click();

  await expect(page.getByRole('button', { name: 'オリジナル', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeDisabled();

  // Switching back to the result view restores the object and its selectability.
  await page.getByRole('button', { name: '結果', exact: true }).click();
  await expect(page.getByRole('button', { name: '結果', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('original view without a space photo shows a hint instead of a blank canvas', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'オリジナル', exact: true }).click();
  await expect(page.getByText('空間写真がまだ追加されていません。')).toBeVisible();
});

test('original view with a space photo hides the empty-space hint', async ({ page }) => {
  await page.goto('/');
  const spaceBackground = await solidColorPng(page, '#1155ff');
  await page
    .getByLabel('空間写真を追加')
    .setInputFiles({ name: 'space.png', mimeType: 'image/png', buffer: spaceBackground });

  await page.getByRole('button', { name: 'オリジナル', exact: true }).click();
  await expect(page.getByText('空間写真がまだ追加されていません。')).toBeHidden();
});

test('dropping a file onto the canvas while in the original view is a no-op', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  await page.getByRole('button', { name: 'オリジナル', exact: true }).click();

  const png = await solidColorPng(page, '#ff8800');
  const box = (await page.locator('.editor-canvas-container').boundingBox())!;

  await page.evaluate(
    ({ base64, clientX, clientY }) => {
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i += 1) byteNumbers[i] = byteChars.charCodeAt(i);
      const file = new File([new Uint8Array(byteNumbers)], 'dropped.png', { type: 'image/png' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const container = document.querySelector('.editor-canvas-container');
      if (!container) throw new Error('canvas container not found');
      container.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          dataTransfer,
        }),
      );
      container.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }),
      );
    },
    {
      base64: png.toString('base64'),
      clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2,
    },
  );

  await page.getByRole('button', { name: '結果', exact: true }).click();
  // Comparison mode clears selection, so reselect the display before checking its content.
  await page
    .locator('.editor-canvas-container')
    .click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(
    page.getByText('まだコンテンツがありません。画像を追加してください。'),
  ).toBeVisible();
});
