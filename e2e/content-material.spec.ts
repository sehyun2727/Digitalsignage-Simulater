import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { readPngDimensions } from './support/png.js';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';
import { addVideoContent } from './support/video.js';

test.use({ locale: 'ja-JP' });

test('adds a space background photo and can remove it again', async ({ page }) => {
  await page.goto('/');

  await addSpaceBackground(page);

  const removeButton = page.getByRole('button', { name: '空間写真を削除' });
  await expect(removeButton).toBeVisible();

  await removeButton.click();
  await expect(page.getByRole('button', { name: '空間写真を削除' })).toBeHidden();
});

test('adds an LED display defaulting to led material', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page);

  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  await expect(
    page.getByText('まだコンテンツがありません。画像を追加してください。'),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('led');
});

test('adds an LCD display defaulting to LCD material', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page);

  await page.getByRole('button', { name: 'LCDディスプレイを追加' }).click();

  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');
});

test('uploads content into a display, edits fit/offset/scale, and resets placement', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  const content = await solidColorPng(page, '#00ff00');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });

  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();

  const fitSelect = page.getByRole('combobox', { name: '表示方法' });
  await expect(fitSelect).toHaveValue('contain');
  await fitSelect.selectOption('cover');
  await expect(fitSelect).toHaveValue('cover');

  const offsetX = page.getByRole('spinbutton', { name: 'コンテンツ位置X' });
  await offsetX.fill('0.4');
  await offsetX.blur();
  await expect(offsetX).toHaveValue('0.4');

  await page.getByRole('button', { name: 'コンテンツ配置をリセット' }).click();
  await expect(offsetX).toHaveValue('0');
});

test('removes uploaded content from a display', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  const content = await solidColorPng(page, '#00ff00');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByRole('button', { name: 'コンテンツを削除' })).toBeVisible();

  await page.getByRole('button', { name: 'コンテンツを削除' }).click();

  await expect(
    page.getByText('まだコンテンツがありません。画像を追加してください。'),
  ).toBeVisible();
});

test('uploads a generated video clip into a display and shows the autoplay/loop/mute hint', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  await addVideoContent(page);

  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();
  await expect(
    page.getByText('動画は自動再生・ループ再生・ミュートで表示されます。'),
  ).toBeVisible();
});

test('exported PNG stays at the exact space photo resolution with a display present', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const buffer = await fs.readFile(path!);
  expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });
});

test('cover-fit display content is clipped to the screen region and never spills onto the bezel', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page);

  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  // A solid-red cover-fit image fills the whole screen region regardless of its own
  // aspect ratio, so any point strictly inside the screen rect must sample as red and
  // any point strictly inside the bezel must not.
  const content = await solidColorPng(page, '#ff0000');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();

  await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');

  // Drive the LED-pattern-grid intensity to zero so the grid overlay doesn't perturb the
  // sampled screen-center pixel; Home sends the range input to its min and fires a native
  // input event, then Tab blurs it to commit the final value.
  const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
  await intensitySlider.focus();
  await intensitySlider.press('Home');
  await intensitySlider.press('Tab');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const buffer = await fs.readFile(path!);
  expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });

  // Default display placement centers a 480x270 object on the 1920x1080 canvas
  // (x:[720,1200], y:[405,675]); the frame's screenRegion insets 2% on every side, so
  // (722, 407) sits just inside the bezel and (960, 540) sits at the object/screen center.
  const [bezelPixel, screenCenterPixel] = await samplePngPixels(page, buffer, [
    [722, 407],
    [960, 540],
  ]);

  expect(bezelPixel.r).toBeLessThan(150);
  expect(screenCenterPixel.r).toBeGreaterThan(200);
  expect(screenCenterPixel.g).toBeLessThan(50);
  expect(screenCenterPixel.b).toBeLessThan(50);
});

test('a newly added LED display has its contact shadow enabled by default and it renders in the export', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  // Regression check for the "shadow disabled by default" defect: a freshly added display must
  // already have a contact shadow, not require the user to opt in.
  await expect(page.getByRole('checkbox', { name: '接地シャドウを有効にする' })).toBeChecked();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;
  const buffer = await fs.readFile((await download.path())!);

  // Default display placement centers a 480x270 object at x:[720,1200] y:[405,675] on the
  // 1920x1080 canvas (see the cover-fit test above). The wall-mode default shadow
  // (SHADOW_MODE_BASE.wall, offsetY 0.035) centers its ellipse just below the object's bottom
  // edge, at local y = 270 * 1.035 ≈ 279 -> canvas y ≈ 405 + 279 = 684, directly below the
  // display's own horizontal center (960). A point far from both the display and the shadow's
  // radius (x 200, well outside [756,1164]) gives the plain space-photo baseline color (#334455).
  const [shadowPoint, baselinePoint] = await samplePngPixels(page, buffer, [
    [960, 690],
    [200, 900],
  ]);

  const brightness = (p: { r: number; g: number; b: number }) => p.r + p.g + p.b;
  expect(brightness(shadowPoint)).toBeLessThan(brightness(baselinePoint));
});

test('rendering presets update the material sliders and the export brightness together', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  const brightnessSlider = page.getByRole('slider', { name: '明るさ' });
  const naturalBrightness = await brightnessSlider.inputValue();

  const nightButton = page.getByRole('button', { name: '夜間' });
  await nightButton.click();
  await expect(nightButton).toHaveAttribute('aria-pressed', 'true');

  const nightBrightness = await brightnessSlider.inputValue();
  expect(Number(nightBrightness)).toBeLessThan(Number(naturalBrightness));

  // Zero the LED grid pattern so it doesn't perturb the sampled screen-center pixel, matching
  // the cover-fit test's approach above.
  const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
  await intensitySlider.focus();
  await intensitySlider.press('Home');
  await intensitySlider.press('Tab');

  const content = await solidColorPng(page, '#ffffff');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');

  const nightDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const nightBuffer = await fs.readFile((await (await nightDownload).path())!);

  const brightButton = page.getByRole('button', { name: '明るい屋外' });
  await brightButton.click();
  await expect(brightButton).toHaveAttribute('aria-pressed', 'true');

  const brightDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const brightBuffer = await fs.readFile((await (await brightDownload).path())!);

  // Screen center (960, 540) per the cover-fit test above.
  const [nightPixel] = await samplePngPixels(page, nightBuffer, [[960, 540]]);
  const [brightPixel] = await samplePngPixels(page, brightBuffer, [[960, 540]]);

  const brightness = (p: { r: number; g: number; b: number }) => p.r + p.g + p.b;
  expect(brightness(brightPixel)).toBeGreaterThan(brightness(nightPixel));
});
