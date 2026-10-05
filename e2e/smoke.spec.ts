import { expect, test } from '@playwright/test';

test.describe('unsupported browser locale', () => {
  test.use({ locale: 'fr-FR' });

  test('falls back to Japanese by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByRole('heading', { name: '置いてみる君' })).toBeVisible();
    await expect(page.getByText('デジタルサイネージ設置シミュレーター')).toBeVisible();
    // v2-S2 rewrite: 「テキストを追加」 is no longer a top-level button (pre-v2 refactor
    // moved it into the Content section which only renders after a signage is selected). The
    // signal we actually want here is "the UI renders Japanese strings on an unsupported
    // browser locale" — use the stable testid for the space-photo trigger, which carries the
    // ja text from first load without matching the hidden file-input sibling that also
    // carries the same aria-label.
    await expect(page.getByTestId('editor-space-background-trigger')).toHaveText('空間写真を追加');
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
