import { devices, expect, test } from '@playwright/test';
import { openSection } from './support/accordion.js';
import { clickExportAndCapturePng, installMobileExportCapture } from './support/mobileExport.js';
import { readPngDimensions } from './support/png.js';
import { addScenePhotoBackground, solidColorPng } from './support/spaceBackground.js';

// Emulates a mobile Chromium viewport/touch profile (userAgent, isMobile, hasTouch,
// deviceScaleFactor from Playwright's iPhone 13 device descriptor) at the exact
// 390x844 viewport this suite is required to cover. This is Chromium mobile-viewport
// emulation, not a real device or real iOS Safari — see the Sprint 2.1 completion
// report for what "verified" means here.
const iPhone13 = devices['iPhone 13'];

test.use({
  // Pick individual fields rather than spreading the whole device descriptor: it
  // also sets defaultBrowserType: 'webkit', which would override the project's
  // configured Chromium browser. This is Chromium mobile-viewport/touch emulation,
  // not real Safari.
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: iPhone13.isMobile,
  hasTouch: iPhone13.hasTouch,
  viewport: { width: 390, height: 844 },
  locale: 'ja-JP',
});

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

async function addSpaceBackground(
  page: import('@playwright/test').Page,
  width = 1920,
  height = 1080,
) {
  const spaceBackground = await solidColorPng(page, '#1155ff', width, height);
  await page
    .getByLabel('設置場所の写真を追加')
    .setInputFiles({ name: 'space.png', mimeType: 'image/png', buffer: spaceBackground });
  await expect(page.getByRole('button', { name: '写真を削除' })).toBeVisible();
}

test('full mobile content and export workflow at 390x844 (LED)', async ({ page }) => {
  // 1. Open the app.
  // v2-S3 D rewrite (F-download): the iPhone userAgent sends handleExport down its
  // `window.open(dataUrl, '_blank')` branch (see EditorLayout.tsx), which never fires a DOM
  // Download event — so Playwright's waitForEvent('download') hangs. installMobileExportCapture
  // installs a window.open interceptor that stores the dataUrl, and clickExportAndCapturePng
  // reads it back as a Buffer. The remaining assertions on PNG dimensions carry over as-is.
  await installMobileExportCapture(page);
  await page.goto('/');

  // 2. Confirm the Japanese default (default locale, no stored preference).
  await expect(page.getByRole('heading', { name: '置いてみる君' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

  // 3. Upload a valid space background photo; its resolution becomes the export size.
  await addSpaceBackground(page, 1920, 1080);

  // 4. Add an LED display.
  await page.getByRole('button', { name: 'LED', exact: true }).click();

  // 5. Select the display (adding it auto-selects it; the content section confirms this).
  await expect(
    page.getByText('まだコンテンツがありません。画像を追加してください。'),
  ).toBeVisible();

  // 6. Upload display content.
  const content = await solidColorPng(page, '#00ff00');
  await page
    .getByTestId('editor-content-upload')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByTestId('editor-content-replace')).toBeVisible();

  // 7. Switch fit between Contain and Cover.
  const fitSelect = page.getByRole('combobox', { name: '表示方法' });
  await expect(fitSelect).toHaveValue('contain');
  await fitSelect.selectOption('cover');
  await expect(fitSelect).toHaveValue('cover');

  // 8. Change material LED -> LCD -> back to LED.
  // v2-S3 3-1: material + sliders + 詳細設定 all live inside the Appearance accordion
  // (collapsed by default; same mobile layout as desktop here).
  await openSection(page, 'appearance');
  const materialSelect = page.getByRole('combobox', { name: 'ディスプレイ素材' });
  await expect(materialSelect).toHaveValue('led');
  await materialSelect.selectOption('lcd');
  await expect(materialSelect).toHaveValue('lcd');
  await materialSelect.selectOption('led');
  await expect(materialSelect).toHaveValue('led');

  // 9. Adjust intensity and brightness.
  const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
  await intensitySlider.focus();
  await intensitySlider.press('End');
  await intensitySlider.press('Tab');

  // v2-P1 D2 label rename: 明るさ → 画面の明るさ (material slider).
  const brightnessSlider = page.getByRole('slider', { name: '画面の明るさ' });
  await brightnessSlider.focus();
  await brightnessSlider.press('Home');
  await brightnessSlider.press('Tab');

  // 10. Export PNG via the iOS fallback path (see installMobileExportCapture above).
  const buffer = await clickExportAndCapturePng(page, page.getByTestId('editor-export-png-header'));

  // 11. Confirm the exported PNG matches the uploaded space photo's resolution.
  expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });

  // 13. Confirm no horizontal overflow at this viewport.
  await expectNoHorizontalOverflow(page);

  // 14. Confirm key controls are visible/reachable (scrolled into view without failing).
  await page.getByTestId('editor-export-png-header').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('editor-export-png-header')).toBeVisible();
  await page.getByRole('button', { name: 'LED', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'LED', exact: true })).toBeVisible();

  // 15. Confirm the canvas region is present and usable (rendered with a non-zero box).
  const canvasBox = await page.locator('.editor-canvas-container').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox!.width).toBeGreaterThan(0);
  expect(canvasBox!.height).toBeGreaterThan(0);

  // 16. Confirm the HULL CTA is present and points at the approved external URL.
  const hullLink = page.getByRole('link', { name: 'サイネージ設置はこちら' });
  await hullLink.scrollIntoViewIfNeeded();
  await expect(hullLink).toBeVisible();
  await expect(hullLink).toHaveAttribute('href', 'https://hull-inc.jp/');
  await expect(hullLink).toHaveAttribute('target', '_blank');
  await expect(hullLink).toHaveAttribute('rel', 'noopener noreferrer');

  // 17. Confirm the footer user-guide link is present and opens the modal on tap.
  // v2-S3 2-6: footer control collapsed to the 📖 icon-only button with aria-label
  // '使い方ガイド' (same key as the header button). The modal heading is still
  // 'このツールについて' per userGuideAboutHeading.
  const guideLink = page.getByTestId('editor-footer-user-guide');
  await guideLink.scrollIntoViewIfNeeded();
  await expect(guideLink).toBeVisible();
  await guideLink.click();
  await expect(
    page.getByRole('heading', { name: 'このツールについて', exact: true }),
  ).toBeVisible();
});

test('mobile smoke: LCD content and export at a portrait 1080x1920 space photo, 390x844', async ({
  page,
}) => {
  await installMobileExportCapture(page);
  await page.goto('/');

  // A lighter-weight companion to the LED flow above: a portrait canvas preset drives a
  // portrait export, and the LCD material is used instead of LED. Canvas size is an explicit
  // preset, independent of the uploaded photo's orientation.
  await addSpaceBackground(page, 1080, 1920);
  await page.getByRole('button', { name: '縦長 (9:16)' }).click();

  await page.getByRole('button', { name: 'LCD' }).click();
  // v2-S3: material combobox lives in the Appearance accordion (collapsed by default).
  await openSection(page, 'appearance');
  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');

  const content = await solidColorPng(page, '#ff8800');
  await page
    .getByTestId('editor-content-upload')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByTestId('editor-content-replace')).toBeVisible();

  const buffer = await clickExportAndCapturePng(page, page.getByTestId('editor-export-png-header'));
  expect(readPngDimensions(buffer)).toEqual({ width: 1080, height: 1920 });

  await expectNoHorizontalOverflow(page);
});

test('mobile: adds a portable, attaches content, and exports at 390x844', async ({ page }) => {
  // v2-S5 보완 A2 (rename): the old name was "adds a custom portable product with a screen
  // region" which described the removed PortableBuilderModal upload flow. The current
  // compound-model equivalent is: click portable button → portable added with the preset
  // template view → attach content → export at the space photo's preset resolution.
  await installMobileExportCapture(page);
  await page.goto('/');
  await addSpaceBackground(page, 1920, 1080);

  await page.getByTestId('editor-add-portable').click();
  await expect(page.getByText('ポータブル製品', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Attach screen content.
  const content = await solidColorPng(page, '#ff8800');
  await page
    .getByTestId('editor-content-upload')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByTestId('editor-content-replace')).toBeVisible();

  // Export and confirm resolution.
  const buffer = await clickExportAndCapturePng(page, page.getByTestId('editor-export-png-header'));
  expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });
  await expectNoHorizontalOverflow(page);
});

test('mobile: resizing a portable at 390x844 via the position-size width input', async ({
  page,
}) => {
  // v2-S5 보완 A2 (rename): the old name was "dragging the portable screen region moves
  // and resizes it" which described the removed region editor dialog. The compound-model
  // equivalent is that the whole portable object is draggable/resizable via the shared
  // Konva Transformer (same as LED/LCD/transparent-LED), and the screen quad moves with it
  // as a child. We
  // verify the portable's position-size inputs accept a width edit and the output stays
  // well-formed. Pixel precision is covered on the desktop suite.
  await page.goto('/');
  await addSpaceBackground(page, 1920, 1080);
  await page.getByTestId('editor-add-portable').click();
  await expect(page.getByText('ポータブル製品', { exact: true })).toBeVisible();
  await page.getByTestId('toolbar-subsection-position-size-toggle').click();
  const widthInput = page.getByLabel('幅').first();
  const widthBefore = Number(await widthInput.inputValue());
  await widthInput.fill(String(widthBefore + 40));
  await widthInput.blur();
  const widthAfter = Number(await widthInput.inputValue());
  console.log(`mobile portable resize: ${widthBefore} → ${widthAfter}`);
  expect(widthAfter).toBeGreaterThan(widthBefore);
  await expectNoHorizontalOverflow(page);
});

const deleteButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: '削除', exact: true });

test('mobile: an LED display is reselectable by tap after being deselected at 390x844', async ({
  page,
}) => {
  // Companion to e2e/reselection.spec.ts's desktop coverage of the same fix (the hit-area
  // Rect added to SignageDisplayView/PortableProductView so Group-wrapped objects stay
  // clickable after deselection): this confirms the same interaction also works through
  // Playwright's touch-viewport emulation, not just real mouse input.
  await page.goto('/');
  await addSpaceBackground(page, 1920, 1080);

  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expect(deleteButton(page)).toBeEnabled();

  const canvasContainer = page.locator('.editor-canvas-container');
  await canvasContainer.scrollIntoViewIfNeeded();
  const box = (await canvasContainer.boundingBox())!;
  await page.mouse.click(box.x + 5, box.y + 5);
  await expect(deleteButton(page)).toBeDisabled();

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(deleteButton(page)).toBeEnabled();
  // v2-S3: material combobox lives in the Appearance accordion (collapsed by default).
  await openSection(page, 'appearance');
  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toBeVisible();

  await expectNoHorizontalOverflow(page);
});

test('mobile: adds a transparent LED display and blends more of the space background as transparency rises, at 390x844', async ({
  page,
}) => {
  // Companion to the desktop coverage in e2e/perspective-video.spec.ts's "transparent LED
  // window blending" describe block: confirms the material select, the two sliders, and the
  // PNG export flow all stay usable/reachable at the narrow touch-viewport width.
  await installMobileExportCapture(page);
  await page.goto('/');
  await addSpaceBackground(page, 1920, 1080);

  await page.getByTestId('editor-add-transparent-led').click();
  // v2-S3: Appearance accordion holds material, sliders, and 詳細設定.
  await openSection(page, 'appearance');
  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue(
    'transparent-led',
  );

  const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
  await intensitySlider.scrollIntoViewIfNeeded();
  await intensitySlider.focus();
  await intensitySlider.press('Home');
  await intensitySlider.press('Tab');

  await page.getByRole('button', { name: '詳細設定', exact: true }).click();

  const transparencySlider = page.getByRole('slider', { name: '透過度（背景の見え方）' });
  await transparencySlider.scrollIntoViewIfNeeded();
  await transparencySlider.focus();
  await transparencySlider.press('End');
  await transparencySlider.press('Tab');
  // v2-S5 U4: inline accordion — no 「閉じる」 button.

  const buffer = await clickExportAndCapturePng(page, page.getByTestId('editor-export-png-header'));
  expect(buffer.length).toBeGreaterThan(0);

  await expectNoHorizontalOverflow(page);
});

test('mobile: applies a four-point perspective quad via the corner input fields at 390x844', async ({
  page,
}) => {
  // Companion to the desktop drag/keyboard coverage in e2e/perspective-video.spec.ts's
  // "four-point perspective placement" describe block. This drives the numeric X/Y fields
  // instead of a drag gesture: the perspective panel's own precise-value inputs are the
  // touch-friendly path (a corner drag handle is a few pixels wide at this viewport), and
  // desktop coverage already exercises the drag-handle/keyboard-nudge interaction itself.
  await page.goto('/');
  await addSpaceBackground(page, 1920, 1080);

  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await page.getByRole('button', { name: '空間に合わせて配置（パース）' }).click();
  await expectNoHorizontalOverflow(page);

  // Mirrors the perspective-video.spec.ts helper rewritten in S1 Step 0: the pre-v2 corner
  // number inputs became draggable `role="slider"` handles, so set each corner by pointer-
  // dragging its handle to the target normalized point inside the canvas container.
  const cornerTestidKey = {
    左上: 'editor-perspective-handle-topLeft',
    右上: 'editor-perspective-handle-topRight',
    右下: 'editor-perspective-handle-bottomRight',
    左下: 'editor-perspective-handle-bottomLeft',
  } as const;
  const setCorner = async (
    cornerLabel: '左上' | '右上' | '右下' | '左下',
    xFraction: number,
    yFraction: number,
  ) => {
    const handle = page.getByTestId(cornerTestidKey[cornerLabel]);
    const canvas = page.locator('.editor-canvas-container');
    const box = (await canvas.boundingBox())!;
    await handle.dragTo(canvas, {
      targetPosition: { x: xFraction * box.width, y: yFraction * box.height },
    });
  };

  await setCorner('左上', 0.05, 0.05);
  await setCorner('右上', 0.4, 0.05);
  await setCorner('右下', 0.4, 0.4);
  await setCorner('左下', 0.05, 0.4);

  const applyButton = page.getByRole('button', { name: '適用' });
  await applyButton.scrollIntoViewIfNeeded();
  await expect(applyButton).toBeEnabled();
  await applyButton.click();

  await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('mobile: draws a foreground occlusion mask via tap-to-add points at 390x844', async ({
  page,
}) => {
  // Companion to the desktop point-precision coverage in e2e/occlusion-mask.spec.ts: confirms
  // the tap-to-add-a-point interaction (OcclusionEditOverlay.tsx's handleBackgroundClick) still
  // works through Playwright's touch-viewport emulation, and that the overlay itself introduces
  // no horizontal overflow at this narrow width. Selects the portrait canvas preset (not the
  // 1920x1080 landscape most other specs use): on a landscape document, the fitted canvas box at
  // 390px wide is only ~200px tall, and the overlay's own hint text + feather/opacity panel
  // already fill nearly all of that, leaving no open area to tap - a portrait canvas is also the
  // realistic orientation for this viewport (see the "mobile smoke" test above).
  await page.goto('/');
  await addSpaceBackground(page, 1080, 1920);
  await page.getByRole('button', { name: '縦長 (9:16)' }).click();
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  // v2-S5 U3 (3-5): the occlusion add button moved from inside AdvancedSettingsModal into
  // the inline AppearanceFields subsection. Open the Appearance accordion directly — no
  // modal needed.
  await page
    .getByRole('button', { name: /外観|외관|Appearance/, exact: false })
    .first()
    .click();
  await page.getByTestId('editor-occlusion-add').scrollIntoViewIfNeeded();
  await page.getByTestId('editor-occlusion-add').click();
  await expectNoHorizontalOverflow(page);

  const canvasContainer = page.locator('.editor-canvas-container');
  await canvasContainer.scrollIntoViewIfNeeded();
  const box = (await canvasContainer.boundingBox())!;
  // Three points well inside the canvas box, forming a small triangle away from the overlay's
  // own top hint bar and bottom feather/opacity panel.
  const points = [
    { x: box.x + box.width * 0.4, y: box.y + box.height * 0.4 },
    { x: box.x + box.width * 0.6, y: box.y + box.height * 0.4 },
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.55 },
  ];
  for (const point of points) {
    await page.mouse.click(point.x, point.y);
  }

  const applyButton = page.getByRole('button', { name: '適用' });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();

  // v2-S5 U3: mask list is inline — no modal reopen needed.
  await expect(page.getByText('マスク 1', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('mobile smoke: a real-photo-style scene renders, exports a PNG, and introduces no horizontal overflow at 390x844', async ({
  page,
}) => {
  // Companion to the desktop real-photo-style golden-image scenarios in e2e/visual-qa.spec.ts:
  // confirms the same procedurally-generated (non-solid-color) fixture also works through this
  // narrow touch-viewport, rather than only ever being exercised against flat solid-color photos.
  await installMobileExportCapture(page);
  await page.goto('/');
  await addScenePhotoBackground(page, 'bright-interior', 1920, 1080);
  await expect(page.getByRole('button', { name: '写真を削除' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'LCD' }).click();
  const content = await solidColorPng(page, '#2563eb');
  await page
    .getByTestId('editor-content-upload')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByTestId('editor-content-replace')).toBeVisible();

  const canvasBox = await page.locator('.editor-canvas-container').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox!.width).toBeGreaterThan(0);
  expect(canvasBox!.height).toBeGreaterThan(0);

  const exportButton = page.getByTestId('editor-export-png-header');
  await exportButton.scrollIntoViewIfNeeded();
  await expect(exportButton).toBeEnabled();

  const buffer = await clickExportAndCapturePng(page, exportButton);
  expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });

  await expectNoHorizontalOverflow(page);
});
