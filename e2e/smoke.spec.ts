import { expect, test } from '@playwright/test';

test.describe('unsupported browser locale', () => {
  test.use({ locale: 'fr-FR' });

  test('falls back to Japanese by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByRole('heading', { name: 'Digital Signage Simulator' })).toBeVisible();
    await expect(page.getByText('Sprint 0', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'HULLに問い合わせる' })).toHaveAttribute(
      'href',
      'https://hull-inc.jp/contact',
    );
  });
});

test('switches the UI language to English', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('combobox').selectOption('en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Digital Signage Simulator' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact HULL' })).toBeVisible();
});
