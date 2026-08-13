import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { readPngDimensions } from './support/png.js';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP' });

const NO_SIGNAGE_HINT =
  '「サイネージを追加」セクションからLED・LCD・透過LED・ポータブル製品を配置しましょう。';

async function setup(page: import('@playwright/test').Page) {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });
}

/**
 * A square (1:1) product photo keeps computeDefaultPortableSize's placement math simple: on a
 * 1920x1080 space photo it places a 540x540 object centered at (960, 540), i.e. spanning
 * x:[690,1230] y:[270,810] - the coordinates the pixel-verification tests below rely on.
 */
async function uploadPortableProductPhoto(
  dialog: import('@playwright/test').Locator,
  color: string,
) {
  const page = dialog.page();
  const photo = await solidColorPng(page, color);
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: photo });
}

/**
 * A square product photo with a fully transparent 5%-wide border around an opaque center, so an
 * export can be sampled at three distinct zones: the transparent border (must alpha-composite
 * onto whatever is behind it), the opaque area outside the screen region (must show the product
 * photo's own color), and the screen region (must show clipped content) - see
 * uploadTransparentPortableProductPhoto's callers for the exact sample coordinates.
 */
async function uploadTransparentPortableProductPhoto(
  dialog: import('@playwright/test').Locator,
  color: string,
  size = 100,
) {
  const page = dialog.page();
  const dataUrl = await page.evaluate(
    ({ color, size }) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const border = size * 0.05;
      ctx.fillStyle = color;
      ctx.fillRect(border, border, size - border * 2, size - border * 2);
      return canvas.toDataURL('image/png');
    },
    { color, size },
  );
  const photo = Buffer.from(dataUrl.split(',')[1]!, 'base64');
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'transparent-product.png', mimeType: 'image/png', buffer: photo });
}

test('walks the photo and drag-to-draw region steps to add a portable product, then re-edits its region', async ({
  page,
}) => {
  await setup(page);

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '次へ' })).toBeDisabled();

  await uploadPortableProductPhoto(dialog, '#1155ff');
  const nextButton = dialog.getByRole('button', { name: '次へ' });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(dialog.getByRole('heading', { name: '画面領域を指定' })).toBeVisible();

  const preview = dialog.locator('.portable-region-preview');
  const box = (await preview.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7, { steps: 5 });
  await page.mouse.up();

  // The square product photo is pillarboxed inside this 4:3 preview (background-size: contain),
  // so 10%/80% of the full *container* width falls partly in the letterbox band left of the
  // photo (clamped to the photo's own left edge, x=0) and the drag lands at 90%, not 80%, of
  // the narrower photo itself - see computeContainRect in src/lib/portableRegion.ts.
  const widthInput = dialog.getByRole('spinbutton', { name: '領域の幅' });
  const widthValue = Number(await widthInput.inputValue());
  expect(widthValue).toBeCloseTo(0.9, 1);

  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('ポータブル製品', { exact: true })).toBeVisible();

  // Re-enter the region editor for the object just placed; it must skip straight to the
  // region step (no photo step, no Back button) and persist an edit back onto the object.
  await page.getByRole('button', { name: '画面領域を編集' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByRole('heading', { name: '画面領域を指定' })).toBeVisible();
  await expect(editDialog.getByRole('button', { name: '戻る' })).toBeHidden();

  const editWidthInput = editDialog.getByRole('spinbutton', { name: '領域の幅' });
  await editWidthInput.fill('0.4');
  await editDialog.getByRole('button', { name: '保存' }).click();
  await expect(editDialog).toBeHidden();
});

test('rejects a screen region smaller than the minimum size and keeps the dialog open', async ({
  page,
}) => {
  await setup(page);

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await uploadPortableProductPhoto(dialog, '#1155ff');
  await dialog.getByRole('button', { name: '次へ' }).click();

  const widthInput = dialog.getByRole('spinbutton', { name: '領域の幅' });
  await widthInput.fill('0.01');
  await dialog.getByRole('button', { name: '追加', exact: true }).click();

  await expect(
    dialog.getByText('画面領域が小さすぎます。写真の縦横それぞれ5%以上を指定してください。'),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
});

test('cancelling the builder does not add a portable object', async ({ page }) => {
  await setup(page);

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('要素を選択するとプロパティを編集できます。')).toBeVisible();
});

test('undo removes an added portable product and redo restores it', async ({ page }) => {
  await setup(page);

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await uploadPortableProductPhoto(dialog, '#1155ff');
  await dialog.getByRole('button', { name: '次へ' }).click();
  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeHidden();

  // undo/redo clear selection along with restoring/removing the object (see editorStore.ts),
  // so the no-signage hint - not the properties panel - is what actually reflects whether
  // the portable object is present.
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeVisible();

  await page.getByRole('button', { name: 'やり直す' }).click();
  await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeHidden();
});

test('applies content and material to a portable product; export is clipped to its screen region and defaults to LCD', async ({
  page,
}) => {
  await setup(page);

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const dialog = page.getByRole('dialog');
  await uploadPortableProductPhoto(dialog, '#1155ff');
  await dialog.getByRole('button', { name: '次へ' }).click();
  // Keep the default region (0.2, 0.2, 0.6, 0.6) - centered and symmetric, so the screen
  // region's center coincides with the object's own center regardless of object size.
  await dialog.getByRole('button', { name: '追加', exact: true }).click();
  await expect(page.getByText('ポータブル製品', { exact: true })).toBeVisible();

  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');

  const content = await solidColorPng(page, '#ff0000');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();

  await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');

  // Zero out the LCD highlight/material overlay so it doesn't perturb the sampled pixels.
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

  // A square 100x100 product photo on a 1920x1080 space photo places a centered 540x540 object
  // at x:[690,1230] y:[270,810]; the default 0.2/0.2/0.6/0.6 screen region is centered within
  // it, so its center (960, 540) coincides with the object's own center. (700, 280) sits inside
  // the product photo but well outside that centered screen region.
  const [productPixel, screenCenterPixel] = await samplePngPixels(page, buffer, [
    [700, 280],
    [960, 540],
  ]);

  expect(productPixel.r).toBeLessThan(100);
  expect(productPixel.b).toBeGreaterThan(150);
  expect(screenCenterPixel.r).toBeGreaterThan(200);
  expect(screenCenterPixel.g).toBeLessThan(50);
  expect(screenCenterPixel.b).toBeLessThan(50);
});

test.describe('direct region move/resize (real pointer drags)', () => {
  // The uploaded product photo is a square (1:1), while `.portable-region-preview` is a 4:3 box,
  // so every drag in this block also exercises the background-size:contain letterbox mapping
  // (pillarboxed left/right) with a real browser layout - not just the unit-tested pure math.

  async function addPortableProductAndOpenRegionEditor(
    page: import('@playwright/test').Page,
  ): Promise<import('@playwright/test').Locator> {
    await setup(page);
    await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
    const dialog = page.getByRole('dialog');
    await uploadPortableProductPhoto(dialog, '#1155ff');
    await dialog.getByRole('button', { name: '次へ' }).click();
    await dialog.getByRole('button', { name: '追加', exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: '画面領域を編集' }).click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByRole('heading', { name: '画面領域を指定' })).toBeVisible();
    return editDialog;
  }

  test('dragging inside the region moves it, and Save creates exactly one history entry on top of creation', async ({
    page,
  }) => {
    const editDialog = await addPortableProductAndOpenRegionEditor(page);
    const box = editDialog.locator('.portable-region-box');
    const before = (await box.boundingBox())!;

    const center = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 40, center.y + 25, { steps: 5 });
    await page.mouse.up();

    const dragged = (await box.boundingBox())!;
    expect(dragged.x).toBeCloseTo(before.x + 40, 0);
    expect(dragged.y).toBeCloseTo(before.y + 25, 0);
    expect(dragged.width).toBeCloseTo(before.width, 0);
    expect(dragged.height).toBeCloseTo(before.height, 0);
    await expect(editDialog.getByRole('alert')).toHaveCount(0);

    await editDialog.getByRole('button', { name: '保存' }).click();
    await expect(editDialog).toBeHidden();

    // Reselecting a canvas object by clicking its rendered Konva shape is covered separately by
    // e2e/reselection.spec.ts; this test isn't about that path, so it proves the "exactly one
    // history entry" claim the same way the pre-existing undo/redo test does: via the
    // no-signage hint, not by reopening the region editor after undo. Exactly two entries
    // must exist (creation, then the move) - one undo should revert the move but leave the
    // object in place, and only the second undo should remove it.
    await page.getByRole('button', { name: '元に戻す' }).click();
    await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeHidden();

    await page.getByRole('button', { name: '元に戻す' }).click();
    await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeVisible();
  });

  test('dragging the se corner handle resizes while keeping the nw corner fixed', async ({
    page,
  }) => {
    const editDialog = await addPortableProductAndOpenRegionEditor(page);
    const box = editDialog.locator('.portable-region-box');
    const seHandle = editDialog.locator('.portable-region-handle--se');
    const before = (await box.boundingBox())!;
    const seBefore = (await seHandle.boundingBox())!;
    const seCenter = { x: seBefore.x + seBefore.width / 2, y: seBefore.y + seBefore.height / 2 };

    await page.mouse.move(seCenter.x, seCenter.y);
    await page.mouse.down();
    await page.mouse.move(seCenter.x + 35, seCenter.y + 20, { steps: 5 });
    await page.mouse.up();

    const resized = (await box.boundingBox())!;
    // The nw corner (top-left) must not move; only the se corner (width/height) grows. A couple
    // of CSS px of tolerance absorbs real-browser subpixel layout rounding.
    expect(Math.abs(resized.x - before.x)).toBeLessThan(2);
    expect(Math.abs(resized.y - before.y)).toBeLessThan(2);
    expect(Math.abs(resized.width - (before.width + 35))).toBeLessThan(2);
    expect(Math.abs(resized.height - (before.height + 20))).toBeLessThan(2);
    await expect(editDialog.getByRole('alert')).toHaveCount(0);

    await editDialog.getByRole('button', { name: '保存' }).click();
    await expect(editDialog).toBeHidden();
  });

  test('dragging a corner past the opposite one clamps at the minimum size instead of inverting or erroring', async ({
    page,
  }) => {
    const editDialog = await addPortableProductAndOpenRegionEditor(page);
    const box = editDialog.locator('.portable-region-box');
    const seHandle = editDialog.locator('.portable-region-handle--se');
    // The reference for "the nw corner doesn't move" must be the region box's own bounding rect,
    // not the nw handle's - the handle is a 2.75rem invisible hit target centered on the corner
    // (see .portable-region-handle in global.css), so its own boundingBox().x/y sits ~22px off
    // the true corner coordinate.
    const before = (await box.boundingBox())!;
    const seBefore = (await seHandle.boundingBox())!;
    const seCenter = { x: seBefore.x + seBefore.width / 2, y: seBefore.y + seBefore.height / 2 };
    const nwCorner = { x: before.x, y: before.y };

    await page.mouse.move(seCenter.x, seCenter.y);
    await page.mouse.down();
    // Drag well past the fixed nw corner - a naive implementation would invert the rect.
    await page.mouse.move(nwCorner.x - 20, nwCorner.y - 20, { steps: 5 });
    await page.mouse.up();

    const resized = (await box.boundingBox())!;
    expect(resized.width).toBeGreaterThan(0);
    expect(resized.height).toBeGreaterThan(0);
    expect(Math.abs(resized.x - nwCorner.x)).toBeLessThan(2);
    expect(Math.abs(resized.y - nwCorner.y)).toBeLessThan(2);
    await expect(editDialog.getByRole('alert')).toHaveCount(0);

    await editDialog.getByRole('button', { name: '保存' }).click();
    await expect(editDialog).toBeHidden();
  });

  test('cancelling after a drag discards the draft and creates no history entry', async ({
    page,
  }) => {
    const editDialog = await addPortableProductAndOpenRegionEditor(page);
    const box = editDialog.locator('.portable-region-box');
    const before = (await box.boundingBox())!;

    const center = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 30, center.y + 30, { steps: 5 });
    await page.mouse.up();

    await editDialog.getByRole('button', { name: 'キャンセル' }).click();
    await expect(editDialog).toBeHidden();

    // Only the creation step should be undoable - the discarded drag must not add an entry.
    await page.getByRole('button', { name: '元に戻す' }).click();
    await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeVisible();
  });

  test('saving an unchanged region creates no history entry', async ({ page }) => {
    const editDialog = await addPortableProductAndOpenRegionEditor(page);
    await editDialog.getByRole('button', { name: '保存' }).click();
    await expect(editDialog).toBeHidden();

    await page.getByRole('button', { name: '元に戻す' }).click();
    await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeVisible();
  });
});

test.describe('export composition (pixel verification)', () => {
  test('a transparent product photo alpha-composites over the space background, while its opaque area and the clipped content still render normally', async ({
    page,
  }) => {
    await page.goto('/');

    // Space background fills the whole canvas, so it's what should show through the product
    // photo's transparent border once composited.
    await addSpaceBackground(page, { width: 1920, height: 1080, color: '#00cc44' });

    await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
    const dialog = page.getByRole('dialog');
    await uploadTransparentPortableProductPhoto(dialog, '#1155ff');
    await dialog.getByRole('button', { name: '次へ' }).click();
    // Keep the default region (0.2, 0.2, 0.6, 0.6).
    await dialog.getByRole('button', { name: '追加', exact: true }).click();
    await expect(page.getByText('ポータブル製品', { exact: true })).toBeVisible();

    const content = await solidColorPng(page, '#ff0000');
    await page
      .getByLabel('コンテンツを追加')
      .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
    await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');

    // Zero out the LCD highlight/material overlay so it doesn't perturb the content-color sample.
    const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
    await intensitySlider.focus();
    await intensitySlider.press('Home');
    await intensitySlider.press('Tab');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGで書き出す' }).click();
    const download = await downloadPromise;
    const buffer = await fs.readFile((await download.path())!);
    expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });

    // Square 100x100 photo -> centered 540x540 object at x:[690,1230] y:[270,810] (see
    // uploadPortableProductPhoto's doc comment). Sample points at 2%, 10%, and 50% of the
    // object's own size from its top-left corner:
    //  - 2% (701, 281): inside the photo's transparent 5% border -> the space background must
    //    show through.
    //  - 10% (744, 324): inside the photo's opaque area but outside the default 20%-80% screen
    //    region -> the product's own opaque color must render, unaffected by the space
    //    background behind it.
    //  - 50% (960, 540): the screen region's center -> the clipped content, not the product
    //    photo or the space background.
    const [transparentBorder, opaqueProduct, screenContent] = await samplePngPixels(page, buffer, [
      [701, 281],
      [744, 324],
      [960, 540],
    ]);

    expect(transparentBorder.g).toBeGreaterThan(150);
    expect(transparentBorder.r).toBeLessThan(100);
    expect(transparentBorder.b).toBeLessThan(100);

    expect(opaqueProduct.b).toBeGreaterThan(150);
    expect(opaqueProduct.r).toBeLessThan(100);

    expect(screenContent.r).toBeGreaterThan(200);
    expect(screenContent.g).toBeLessThan(50);
    expect(screenContent.b).toBeLessThan(50);
  });

  test('the default LCD material renders a visible highlight overlay on the screen region', async ({
    page,
  }) => {
    await setup(page);

    await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
    const dialog = page.getByRole('dialog');
    await uploadPortableProductPhoto(dialog, '#1155ff');
    await dialog.getByRole('button', { name: '次へ' }).click();
    await dialog.getByRole('button', { name: '追加', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');

    // The LCD highlight is a diagonal gradient from the screen region's own top-left corner, so
    // sample just inside it - not the region's center, which the gradient never reaches.
    // Region top-left in absolute canvas coords: object origin (690, 270) + 20% of the 540px
    // object size = (798, 378); +6px inward keeps the sample off the region's exact edge.
    const samplePoint: [number, number] = [804, 384];

    const downloadPromise1 = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGで書き出す' }).click();
    const defaultBuffer = await fs.readFile((await (await downloadPromise1).path())!);
    const [withHighlight] = await samplePngPixels(page, defaultBuffer, [samplePoint]);

    const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
    await intensitySlider.focus();
    await intensitySlider.press('Home');
    await intensitySlider.press('Tab');

    const downloadPromise2 = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGで書き出す' }).click();
    const zeroedBuffer = await fs.readFile((await (await downloadPromise2).path())!);
    const [withoutHighlight] = await samplePngPixels(page, zeroedBuffer, [samplePoint]);

    // The LCD highlight is an additive white gradient, so with it present the sampled pixel must
    // be strictly brighter than with intensity zeroed out - proving the overlay actually renders.
    const brightness = (p: { r: number; g: number; b: number }) => p.r + p.g + p.b;
    expect(brightness(withHighlight)).toBeGreaterThan(brightness(withoutHighlight));
  });

  test('exports a portable product on a portrait space photo at its native 1080x1920 resolution', async ({
    page,
  }) => {
    await page.goto('/');
    // No separate "template" concept exists any more - a portrait-oriented space photo alone
    // drives a portrait export.
    await addSpaceBackground(page, { width: 1080, height: 1920 });

    await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
    const dialog = page.getByRole('dialog');
    await uploadPortableProductPhoto(dialog, '#1155ff');
    await dialog.getByRole('button', { name: '次へ' }).click();
    await dialog.getByRole('button', { name: '追加', exact: true }).click();
    await expect(dialog).toBeHidden();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGで書き出す' }).click();
    const download = await downloadPromise;
    const buffer = await fs.readFile((await download.path())!);
    expect(readPngDimensions(buffer)).toEqual({ width: 1080, height: 1920 });
  });
});
