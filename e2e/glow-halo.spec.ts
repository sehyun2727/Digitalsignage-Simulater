import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP' });

/**
 * Regression coverage for the material glow halo (sprint spec section 19): before this fix, the
 * glow shadow was attached directly to the screen content image inside a Group clipped to the
 * screen's own exact rect, so the blur could never render past that boundary and the "発光の強さ"
 * slider had zero visible effect at any value. ScreenComposition now renders the glow as a
 * separate, unclipped halo (see ScreenGlowHalo in ScreenComposition.tsx), matching
 * ContactShadowView's cache()+Konva.Filters.Blur pattern so the blur can bleed past the screen
 * edge into the bezel/background.
 */
test('the material glow halo bleeds past the screen edge into the bezel', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080, color: '#111318' });
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  const content = await solidColorPng(page, '#ffffff');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');

  await page.getByRole('button', { name: '詳細設定', exact: true }).click();
  const glowSlider = page.getByRole('slider', { name: '発光の強さ（詳細設定）' });
  await glowSlider.focus();
  await glowSlider.press('End'); // max out glow for a maximally visible halo
  await page.getByRole('button', { name: '閉じる' }).click();

  // The default LED object is 480x270 at document center (720,405)-(1200,675) with the
  // 'wall-led' frame's 2%-wide bezel margin (see DISPLAY_FRAME_TEMPLATES), so the screen's own
  // top edge sits at document y = 405 + 0.02*270 = 410.4. This point is a few pixels above that,
  // inside the bezel margin the halo's blur should now bleed into.
  const samplePoint: [number, number] = [960, 407];

  const glowOnDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const glowOnBuffer = await fs.readFile((await (await glowOnDownload).path())!);
  const [withGlow] = await samplePngPixels(page, glowOnBuffer, [samplePoint]);

  await page.getByRole('button', { name: '詳細設定', exact: true }).click();
  await glowSlider.focus();
  await glowSlider.press('Home'); // glow = 0
  await glowSlider.press('Tab');
  await page.getByRole('button', { name: '閉じる' }).click();

  const glowOffDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const glowOffBuffer = await fs.readFile((await (await glowOffDownload).path())!);
  const [withoutGlow] = await samplePngPixels(page, glowOffBuffer, [samplePoint]);

  const brightness = (p: { r: number; g: number; b: number }) => p.r + p.g + p.b;
  expect(brightness(withGlow!)).toBeGreaterThan(brightness(withoutGlow!));
});
