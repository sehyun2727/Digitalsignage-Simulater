import { expect, test } from '@playwright/test';

test.describe('unsupported browser locale', () => {
  test.use({ locale: 'fr-FR' });

  test('falls back to Japanese by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByRole('heading', { name: '置いてみる君' })).toBeVisible();
    await expect(page.getByText('デジタルサイネージ設置シミュレーター')).toBeVisible();
    await expect(page.getByRole('button', { name: 'テキストを追加' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'サイネージ設置はこちら' })).toHaveAttribute(
      'href',
      'https://hull-inc.jp/',
    );
  });
});

test('switches the UI language to English', async ({ page }) => {
  await page.goto('/');

  await page.locator('#language-select').selectOption('en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Digital Signage Placement Simulator')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Install signage with HULL' })).toBeVisible();
});
