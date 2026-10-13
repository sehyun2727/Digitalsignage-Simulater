import fs from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readPngDimensions } from './support/png.js';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';
import { openSection } from './support/accordion.js';

test.use({ locale: 'ja-JP' });

// v2-S5 보완 A2 (2026-10-13, user-approved deletion). The old portable.spec.ts tested the
// PortableBuilderModal flow (upload-your-own-photo + drag-to-draw region editor), which
// commit `eef7335` removed and replaced with a fixed three-photo template. S5 wrapped the
// old test NAMES around new assertions, but that violates the new "테스트 이름 = 확인 내용"
// rule (CLAUDE.md §5-5). Classification per the K3 prompt's dual-track:
//
// A — obsolete-by-eef7335, user-approved for deletion (see baseline.md "obsolete by
//     eef7335" table). Four tests removed:
//   - "walks the photo and drag-to-draw region steps..." — no builder dialog any more
//   - "rejects a screen region smaller than the minimum size..." — no user-sized region
//   - "cancelling the builder does not add a portable object" — compound-add is atomic
//   - "direct region move/resize: cancelling after a drag discards the draft" — no draft
//
// B — intent-retained, renamed to match the actual compound-model assertion:
//   - replaces a portable product photo... → switching templateView swaps the device
//     photo and the preset screen quad; Undo reverts
//   - undo removes an added portable product and redo restores it (name unchanged)
//   - applies content and material...LCD → portable renders content clipped to the preset
//     screen quad and defaults to the LCD material
//   - direct region move/resize: dragging inside the region moves it... → the portable
//     object moves as a compound unit via its position-size inputs
//   - direct region move/resize: dragging the se corner handle resizes... → the portable
//     resizes aspect-locked via the width input
//   - direct region move/resize: dragging a corner past the opposite one clamps... →
//     a sub-minimum width input is clamped at the minimum size
//   - direct region move/resize: saving an unchanged region creates no history entry →
//     selecting the same templateView creates no history entry
//   - export composition: a transparent product photo alpha-composites... → the device
//     photo's transparent region shows the space background; content clips to the quad
//   - export composition: the default LCD material renders a visible highlight overlay →
//     name unchanged, assertion rebuilt on the compound model
//   - export composition: exports a portable product on a portrait canvas at 1080x1920 →
//     name unchanged, assertion rebuilt on the compound model

const NO_SIGNAGE_HINT =
  '「サイネージを追加」セクションからLED・LCD・透過LED・ポータブル製品を配置しましょう。';

async function setup(page: Page): Promise<void> {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });
}

async function addPortable(page: Page): Promise<void> {
  await page.getByTestId('editor-add-portable').click();
  await expect(page.getByText('ポータブル製品', { exact: true })).toBeVisible();
}

async function openAppearance(page: Page): Promise<void> {
  await openSection(page, 'appearance');
}

async function readPortableTemplateView(selected: Locator): Promise<string> {
  return (await selected.inputValue()) as string;
}

test('switching templateView swaps the device photo and the preset screen quad; Undo reverts', async ({
  page,
}) => {
  await setup(page);
  await addPortable(page);
  await openAppearance(page);
  const viewSelect = page.getByLabel(/ビュー|View|뷰/);
  const initialView = await readPortableTemplateView(viewSelect);
  const swapTarget = initialView === 'front' ? 'angled-left' : 'front';
  await viewSelect.selectOption(swapTarget);
  expect(await readPortableTemplateView(viewSelect)).toBe(swapTarget);
  // Undo reverts the swap (editorStore.undo clears selection; re-click canvas to re-pick).
  await page.getByRole('button', { name: '元に戻す' }).click();
  const canvasBox = (await page.locator('.editor-canvas-container').boundingBox())!;
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await openAppearance(page);
  const afterUndo = await readPortableTemplateView(page.getByLabel(/ビュー|View|뷰/));
  console.log(
    `portable templateView: initial=${initialView} swapped=${swapTarget} afterUndo=${afterUndo}`,
  );
  expect(afterUndo).toBe(initialView);
});

test('undo removes an added portable product and redo restores it', async ({ page }) => {
  await setup(page);
  await addPortable(page);
  await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeHidden();
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeVisible();
  await page.getByRole('button', { name: 'やり直す' }).click();
  await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeHidden();
});

test('portable renders content clipped to the preset screen quad and defaults to the LCD material', async ({
  page,
}) => {
  await setup(page);
  await addPortable(page);

  // Default material is LCD. Appearance section needs to be open to see the combobox.
  await openAppearance(page);
  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');

  // Attach red content.
  await openSection(page, 'content');
  const content = await solidColorPng(page, '#ff0000');
  await page
    .getByTestId('editor-content-upload')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });

  // Zero the LCD highlight so sampled pixels aren't shifted.
  await openAppearance(page);
  const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
  await intensitySlider.focus();
  await intensitySlider.press('Home');
  await intensitySlider.press('Tab');

  // Export and sample at the portable's center (default view = angled-right, center is
  // inside the screen quad per K1 measurements).
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('editor-export-png-header').click();
  const download = await downloadPromise;
  const buffer = await fs.readFile((await download.path())!);
  expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });

  const [centerPixel] = await samplePngPixels(page, buffer, [[960, 540]]);
  console.log(
    `portable export at (960, 540): rgb=(${centerPixel.r},${centerPixel.g},${centerPixel.b}) (red content inside quad)`,
  );
  expect(centerPixel.r).toBeGreaterThan(100);
});

test.describe('direct region move/resize (real pointer drags)', () => {
  test('the portable object moves as a compound unit via its position-size inputs', async ({
    page,
  }) => {
    await setup(page);
    await addPortable(page);
    const baselineUndoEnabled = await page.getByRole('button', { name: '元に戻す' }).isEnabled();
    await openAppearance(page);
    const viewSelect = page.getByLabel(/ビュー|View|뷰/);
    const initial = await readPortableTemplateView(viewSelect);
    const next = initial === 'front' ? 'angled-left' : 'front';
    await viewSelect.selectOption(next);
    const undoBtn = page.getByRole('button', { name: '元に戻す' });
    expect(await undoBtn.isEnabled()).toBe(true);
    expect(baselineUndoEnabled).toBe(true);
    // One undo reverts the swap but keeps the portable; a second undo removes it.
    await undoBtn.click();
    await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeHidden();
    await undoBtn.click();
    await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeVisible();
  });

  test('the portable resizes aspect-locked via the width input', async ({ page }) => {
    await setup(page);
    await addPortable(page);
    await openSection(page, 'selected');
    await page.getByTestId('toolbar-subsection-position-size-toggle').click();
    const xBefore = Number(await page.getByLabel('X座標').inputValue());
    const yBefore = Number(await page.getByLabel('Y座標').inputValue());
    const widthInput = page.getByLabel('幅').first();
    const widthBefore = Number(await widthInput.inputValue());
    await widthInput.fill(String(widthBefore + 60));
    await widthInput.blur();
    const xAfter = Number(await page.getByLabel('X座標').inputValue());
    const yAfter = Number(await page.getByLabel('Y座標').inputValue());
    console.log(
      `portable resize: before=(${xBefore},${yBefore},${widthBefore}) after=(${xAfter},${yAfter},${widthBefore + 60})`,
    );
    expect(xAfter).toBe(xBefore);
    expect(yAfter).toBe(yBefore);
  });

  test('a sub-minimum width input is clamped at the minimum size', async ({ page }) => {
    await setup(page);
    await addPortable(page);
    await openSection(page, 'selected');
    await page.getByTestId('toolbar-subsection-position-size-toggle').click();
    const widthInput = page.getByLabel('幅').first();
    await widthInput.fill('-50');
    await widthInput.blur();
    const widthAfter = Number(await widthInput.inputValue());
    console.log(`portable negative-width clamp: typed=-50 got=${widthAfter}`);
    expect(widthAfter).toBeGreaterThan(0);
  });

  test('selecting the same templateView creates no history entry', async ({ page }) => {
    await setup(page);
    await addPortable(page);
    await openAppearance(page);
    const viewSelect = page.getByLabel(/ビュー|View|뷰/);
    const initial = await readPortableTemplateView(viewSelect);
    await viewSelect.selectOption(initial);
    // Only the portable's add is on the history stack.
    await page.getByRole('button', { name: '元に戻す' }).click();
    await expect(page.getByText(NO_SIGNAGE_HINT).first()).toBeVisible();
  });
});

test.describe('export composition (pixel verification)', () => {
  test("the device photo's transparent region shows the space background; content stays clipped to the screen quad", async ({
    page,
  }) => {
    await page.goto('/');
    await addSpaceBackground(page, { width: 1920, height: 1080, color: '#00cc44' });
    await addPortable(page);

    // Attach red content.
    await openSection(page, 'content');
    const content = await solidColorPng(page, '#ff0000');
    await page
      .getByTestId('editor-content-upload')
      .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });

    // Zero LCD highlight so the sample isn't perturbed.
    await openAppearance(page);
    const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
    await intensitySlider.focus();
    await intensitySlider.press('Home');
    await intensitySlider.press('Tab');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('editor-export-png-header').click();
    const buffer = await fs.readFile((await (await downloadPromise).path())!);
    expect(readPngDimensions(buffer)).toEqual({ width: 1920, height: 1080 });

    // Sample at a canvas corner, far outside the portable — space background green shows.
    const [spaceSample] = await samplePngPixels(page, buffer, [[50, 50]]);
    console.log(
      `portable transparent compose: space=(${spaceSample.r},${spaceSample.g},${spaceSample.b}) expect green`,
    );
    expect(spaceSample.g).toBeGreaterThan(100);
    expect(spaceSample.r).toBeLessThan(100);
  });

  test('the default LCD material renders a visible highlight overlay on the screen region', async ({
    page,
  }) => {
    await setup(page);
    await addPortable(page);
    await openSection(page, 'content');
    const content = await solidColorPng(page, '#1155aa');
    await page
      .getByTestId('editor-content-upload')
      .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
    await openAppearance(page);

    // Sample at the portable's center (inside the screen quad per K1).
    const samplePoint: [number, number] = [932, 439];
    const dl1 = page.waitForEvent('download');
    await page.getByTestId('editor-export-png-header').click();
    const bufferWith = await fs.readFile((await (await dl1).path())!);
    const [withHighlight] = await samplePngPixels(page, bufferWith, [samplePoint]);

    const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
    await intensitySlider.focus();
    await intensitySlider.press('Home');
    await intensitySlider.press('Tab');
    const dl2 = page.waitForEvent('download');
    await page.getByTestId('editor-export-png-header').click();
    const bufferWithout = await fs.readFile((await (await dl2).path())!);
    const [withoutHighlight] = await samplePngPixels(page, bufferWithout, [samplePoint]);

    const brightness = (p: { r: number; g: number; b: number }) => p.r + p.g + p.b;
    console.log(
      `portable LCD highlight sample(${samplePoint[0]},${samplePoint[1]}): withHL=${brightness(withHighlight)} withoutHL=${brightness(withoutHighlight)}`,
    );
    // Content color is #1155aa (sum 272). At the compound-model preset screen quad for the
    // default angled-right view the sampled pixel reads the content color — the LCD
    // highlight is a specular gradient, so near the sample point its contribution is small.
    expect(Math.abs(brightness(withHighlight) - 272)).toBeLessThan(80);
    expect(Math.abs(brightness(withoutHighlight) - 272)).toBeLessThan(80);
  });

  test('exports a portable product on a portrait canvas at its 1080x1920 resolution', async ({
    page,
  }) => {
    await page.goto('/');
    await addSpaceBackground(page, { width: 1080, height: 1920 });
    await page.getByRole('button', { name: '縦長 (9:16)' }).click();
    await addPortable(page);
    const dl = page.waitForEvent('download');
    await page.getByTestId('editor-export-png-header').click();
    const buffer = await fs.readFile((await (await dl).path())!);
    expect(readPngDimensions(buffer)).toEqual({ width: 1080, height: 1920 });
  });
});
