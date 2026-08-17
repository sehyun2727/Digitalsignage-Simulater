import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP' });

/**
 * Regression coverage for the window-installation glass reflection (sprint spec section 18,
 * ScreenReflection.tsx): a faint mirrored duplicate of the screen composition anchored to the
 * screen's own bottom edge, rendered only when the object's installation mode is '窓面(透過)'
 * (window) - the only installation mode that implies a glass surface. Proven the same way as the
 * glow halo fix: sample a point below the display with the setting off vs on, and expect a
 * measurable brightness difference only in the 'window' case.
 */
test('a window-mounted display casts a faint reflection below itself', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080, color: '#111318' });
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  const content = await solidColorPng(page, '#ffffff');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');

  // Default LED object: 480x270 at document (720,405)-(1200,675), 'wall-led' frame screen region
  // {x:0.02,y:0.02,w:0.96,h:0.96} of that box, so the screen's own bottom edge sits at document
  // y = 405 + 0.98*270 = 669.6. This point sits inside the reflection band just below that edge.
  const samplePoint: [number, number] = [960, 690];

  const wallDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const wallBuffer = await fs.readFile((await (await wallDownload).path())!);
  const [wallPixel] = await samplePngPixels(page, wallBuffer, [samplePoint]);

  await page.getByRole('combobox', { name: '設置面' }).selectOption('window');

  const windowDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const windowBuffer = await fs.readFile((await (await windowDownload).path())!);
  const [windowPixel] = await samplePngPixels(page, windowBuffer, [samplePoint]);

  const brightness = (p: { r: number; g: number; b: number }) => p.r + p.g + p.b;
  expect(brightness(windowPixel!)).toBeGreaterThan(brightness(wallPixel!));
});
