import { expect, test } from '@playwright/test';
import { addSpaceBackground } from './support/spaceBackground.js';

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

test('the start button hides the card and it does not reappear on reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();

  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeHidden();

  await page.reload();
  await expect(page.getByRole('note', { name: 'ようこそ' })).toBeHidden();
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
