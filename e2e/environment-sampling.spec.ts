import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP' });

/**
 * Regression coverage for user-triggered environment sampling (sprint spec sections 13-14): the
 * "空間写真からサンプリング" button reads the space photo's average ambient tone
 * (sampleAmbientColor in lib/environmentIntegration.ts) and uses it, instead of the neutral gray
 * fallback (ENVIRONMENT_BLEND_COLOR), as the color blended over the screen at the "なじませ強度"
 * strength. Proven end-to-end with a strongly colored (red) space photo and pure-green content: the
 * exported screen pixel should shift measurably toward red once both the sample is taken and the
 * strength is raised, and should reset cleanly via the "なじませをリセット" button.
 */
test('sampling the space photo tints the screen toward its ambient color as strength rises', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080, color: '#ff0000' });
  await page.getByRole('button', { name: 'LED', exact: true }).click();

  const content = await solidColorPng(page, '#00ff00');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');

  const samplePoint: [number, number] = [960, 540]; // center of the default LED object's screen
  const exportAndSample = async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGで書き出す' }).click();
    const buffer = await fs.readFile((await (await download).path())!);
    const [pixel] = await samplePngPixels(page, buffer, [samplePoint]);
    return pixel!;
  };

  // Before sampling: a faint neutral-gray wash is already blended in at the default preset
  // strength (see PRESET_ENVIRONMENT_STRENGTH.natural), not yet influenced by the red photo.
  const beforeSample = await exportAndSample();

  // Environment integration controls live behind the "詳細設定" modal; the export button sits
  // outside it, so the modal must be closed again before each export can be clicked.
  await page.getByRole('button', { name: '詳細設定', exact: true }).click();

  const sampleButton = page.getByRole('button', { name: '空間写真からサンプリング' });
  await expect(sampleButton).toBeEnabled();
  await sampleButton.click();
  await expect(page.getByRole('img', { name: 'サンプリングした環境色' })).toBeVisible();

  const strengthSlider = page.getByRole('slider', { name: 'なじませ強度' });
  await strengthSlider.focus();
  await strengthSlider.press('End'); // max strength for a maximally visible tint

  await page.getByRole('button', { name: '閉じる' }).click();
  const afterSample = await exportAndSample();

  // The red photo's sampled color pulls the pixel's red channel up and its green channel down,
  // relative to the pre-sample/low-strength gray wash over the same pure-green content.
  expect(afterSample.r).toBeGreaterThan(beforeSample.r);
  expect(afterSample.g).toBeLessThan(beforeSample.g);

  await page.getByRole('button', { name: '詳細設定', exact: true }).click();
  await page.getByRole('button', { name: 'なじませをリセット' }).click();
  await expect(strengthSlider).toHaveValue('15'); // back to the natural preset's default strength
  await page.getByRole('button', { name: '閉じる' }).click();

  const afterReset = await exportAndSample();
  expect(afterReset.r).toBeLessThan(afterSample.r);
});
