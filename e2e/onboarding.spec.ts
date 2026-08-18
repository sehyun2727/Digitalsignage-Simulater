import { expect, test } from '@playwright/test';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP', storageState: { cookies: [], origins: [] } });

test('shows the onboarding card on a first visit', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeVisible();
});

test('does not block the toolbar: sections stay usable while the card is showing', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeVisible();

  await addSpaceBackground(page);
  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeVisible();

  const ledButton = page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true });
  await expect(ledButton).toBeEnabled();
  await ledButton.click();

  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeVisible();
});

test('the dismiss button hides the card and it does not reappear on reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '閉じる' }).click();

  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeHidden();

  await page.reload();
  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeHidden();
});

test('clicking elsewhere on the page does not dismiss the card: it has no backdrop', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeVisible();

  await page.mouse.click(5, 5);

  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeVisible();
});

test('walks through all 4 steps, each CTA reusing an existing toolbar/store/export action', async ({
  page,
}) => {
  await page.goto('/');

  // Step 1: space photo. The CTA focuses the real toolbar upload trigger rather than
  // duplicating file-picker logic in the card.
  await expect(page.getByText('1 / 4')).toBeVisible();
  await expect(page.getByText('1. 空間写真を追加')).toBeVisible();
  await page.getByRole('button', { name: '空間写真をアップロード' }).click();
  await expect(page.locator('#toolbar-space-upload-trigger')).toBeFocused();

  await addSpaceBackground(page);

  // Step 2: add signage. The CTA focuses the real toolbar add-signage control (leaving the
  // choice of LED/LCD/transparent-LED/portable to the user) rather than forcing an LED display.
  await expect(page.getByText('2 / 4')).toBeVisible();
  await expect(page.getByText('2. サイネージを追加')).toBeVisible();
  await page.getByRole('button', { name: 'サイネージの追加へ' }).click();
  await expect(page.locator('#toolbar-add-signage-trigger')).toBeFocused();
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();
  await expect(page.getByRole('heading', { name: '選択中のサイネージ' })).toBeVisible();

  // Step 3: apply content. The CTA focuses the real toolbar content upload trigger.
  await expect(page.getByText('3 / 4')).toBeVisible();
  await expect(page.getByText('3. コンテンツを適用')).toBeVisible();
  await page.getByRole('button', { name: 'コンテンツのアップロードへ' }).click();
  await expect(page.locator('#toolbar-content-upload-trigger')).toBeFocused();

  const content = await solidColorPng(page, '#ff8800', 200, 120);
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });

  // Step 4: save PNG. The CTA reuses the header's own export handler, not a duplicate one.
  await expect(page.getByText('4 / 4')).toBeVisible();
  await expect(page.getByText('4. PNGで保存')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '今すぐPNGで保存' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^signage-canvas_\d{8}-\d{6}\.png$/);
});
