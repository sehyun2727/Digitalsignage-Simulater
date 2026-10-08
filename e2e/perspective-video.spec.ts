import fs from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openSection } from './support/accordion.js';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground } from './support/spaceBackground.js';
import { addVideoContent } from './support/video.js';

test.use({ locale: 'ja-JP', viewport: { width: 1280, height: 1700 } });

const DOCUMENT_SIZE = { width: 1920, height: 1080 };

async function setup(page: Page): Promise<void> {
  await page.goto('/');
  await addSpaceBackground(page, DOCUMENT_SIZE);
}

const deleteButton = (page: Page) => page.getByRole('button', { name: '削除', exact: true });

async function canvasBox(page: Page) {
  return (await page.locator('.editor-canvas-container').boundingBox())!;
}

/** Converts a document-space point (the same coordinate space object x/y/width/height and
 *  perspectiveQuad live in) to a page pixel the mouse can click, using the Stage's own uniform
 *  fit scale (see PerspectiveEditOverlay.tsx: the Stage always fills its box with no
 *  letterboxing, so a single scalar conversion is enough). */
async function documentPointToPagePoint(
  page: Page,
  docPoint: { x: number; y: number },
): Promise<{ x: number; y: number }> {
  const box = await canvasBox(page);
  const scale = box.width / DOCUMENT_SIZE.width;
  return { x: box.x + docPoint.x * scale, y: box.y + docPoint.y * scale };
}

// The pre-v2 overlay replaced the per-corner "X座標 / Y座標" number inputs (which the
// old fieldset-based helper filled) with a draggable `role="slider"` handle per corner —
// numeric nudging via ArrowKey still works but can't jump directly to an absolute fraction.
// This helper pointer-drags the handle to the target normalized point inside the canvas
// container, mirroring how a user would set the corner by eye. S1 Step 5 reuses it.
const CORNER_TESTID_KEY: Record<'左上' | '右上' | '右下' | '左下', string> = {
  左上: 'editor-perspective-handle-topLeft',
  右上: 'editor-perspective-handle-topRight',
  右下: 'editor-perspective-handle-bottomRight',
  左下: 'editor-perspective-handle-bottomLeft',
};

async function setPerspectiveCorner(
  page: Page,
  cornerLabel: '左上' | '右上' | '右下' | '左下',
  xFraction: number,
  yFraction: number,
): Promise<void> {
  const handle = page.getByTestId(CORNER_TESTID_KEY[cornerLabel]);
  const canvas = page.locator('.editor-canvas-container');
  const box = (await canvas.boundingBox())!;
  await handle.dragTo(canvas, {
    targetPosition: { x: xFraction * box.width, y: yFraction * box.height },
  });
}

// A valid, convex quad occupying the document's top-left quadrant — far from the default
// centered rect placement (720-1200, 405-675 on a 1920x1080 document), used to prove the
// warped visual body moves independently of the flat hit-area rect (see flow G below).
const TOP_LEFT_QUAD: Array<['左上' | '右上' | '右下' | '左下', number, number]> = [
  ['左上', 0.05, 0.05],
  ['右上', 0.4, 0.05],
  ['右下', 0.4, 0.4],
  ['左下', 0.05, 0.4],
];

async function applyTopLeftPerspectiveQuad(page: Page): Promise<void> {
  await page.getByRole('button', { name: '空間に合わせて配置（パース）' }).click();
  for (const [corner, x, y] of TOP_LEFT_QUAD) {
    await setPerspectiveCorner(page, corner, x, y);
  }
  await page.getByRole('button', { name: '適用' }).click();
}

test.describe('four-point perspective placement', () => {
  test('fits a Wall LED display to the space via a corner drag handle and applies the quad', async ({
    page,
  }) => {
    await setup(page);
    await page.getByRole('button', { name: 'LED', exact: true }).click();

    await page.getByRole('button', { name: '空間に合わせて配置（パース）' }).click();
    const topLeftHandle = page.getByRole('slider', { name: '左上' });
    await expect(topLeftHandle).toBeVisible();

    const beforeValueText = await topLeftHandle.getAttribute('aria-valuetext');
    await topLeftHandle.focus();
    await topLeftHandle.press('ArrowRight');
    await topLeftHandle.press('ArrowDown');
    await expect(topLeftHandle).not.toHaveAttribute('aria-valuetext', beforeValueText ?? '');

    await page.getByRole('button', { name: '適用' }).click();
    await expect(topLeftHandle).toBeHidden();
    await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeVisible();
  });

  test('edit/cancel discards draft changes, reset restores the original quad, and undo/redo toggle placement mode', async ({
    page,
  }) => {
    // v2-S2 rewrite: the pre-S0 fieldset-based "X座標"/"Y座標" numeric inputs were
    // replaced with per-corner draggable slider handles whose current value is exposed as
    // `aria-valuetext="X%, Y%"`. We assert that string instead of the removed spinbutton
    // value. Re-selection after Undo/Redo uses the current hit-area rule: in perspective
    // mode the warped quad is the selection area (see the hit-testing spec below), so
    // Redo (which restores perspective mode) must be followed by a click INSIDE the quad.
    await setup(page);
    await page.getByRole('button', { name: 'LED', exact: true }).click();
    await applyTopLeftPerspectiveQuad(page);
    await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeVisible();

    // Re-enter edit mode, change a corner, then Cancel — the change must not persist.
    await page.getByRole('button', { name: '空間に合わせて配置（パース）' }).click();
    await setPerspectiveCorner(page, '左上', 0.2, 0.2);
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page.getByRole('slider', { name: '左上' })).toBeHidden();

    await page.getByRole('button', { name: '空間に合わせて配置（パース）' }).click();
    // The handle's aria-valuetext is "5%, 5%" for (0.05, 0.05) — the applied TOP_LEFT_QUAD
    // value — confirming Cancel discarded the (0.2, 0.2) draft without touching the stored
    // quad.
    await expect(page.getByRole('slider', { name: '左上' })).toHaveAttribute(
      'aria-valuetext',
      '5%, 5%',
    );

    // Change the same corner again, then Reset — the draft must revert without leaving edit mode.
    await setPerspectiveCorner(page, '左上', 0.2, 0.2);
    await page.getByRole('button', { name: 'リセット', exact: true }).click();
    await expect(page.getByRole('slider', { name: '左上' })).toHaveAttribute(
      'aria-valuetext',
      '5%, 5%',
    );
    await expect(page.getByRole('button', { name: '適用' })).toBeVisible();
    await page.getByRole('button', { name: '適用' }).click();

    // Undo reverts the perspective apply back to normal rect placement; the display's hit
    // area is then the centered flat rect (720,405)-(1200,675). Click the rect's center to
    // reselect, matching the established reselection-after-undo pattern.
    await page.getByRole('button', { name: '元に戻す' }).click();
    await expect(deleteButton(page)).toBeDisabled();
    const rectCenter = await documentPointToPagePoint(page, { x: 960, y: 540 });
    await page.mouse.click(rectCenter.x, rectCenter.y);
    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeHidden();

    // Redo re-applies the TOP_LEFT_QUAD perspective; the hit area is now the warped quad
    // itself, centered at document-space (~432, 243) [midpoint of the (0.05-0.4) × (0.05-0.4)
    // quad in document coords]. The old flat-rect center (960, 540) is OUTSIDE this quad
    // and must not reselect; the quad interior does.
    await page.getByRole('button', { name: 'やり直す' }).click();
    await expect(deleteButton(page)).toBeDisabled();
    await page.mouse.click(rectCenter.x, rectCenter.y);
    await expect(deleteButton(page)).toBeDisabled();
    const quadCenter = await documentPointToPagePoint(page, { x: 432, y: 243 });
    await page.mouse.click(quadCenter.x, quadCenter.y);
    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeVisible();
  });

  test('hit-testing follows the perspective object’s warped quad, overlapping topmost wins, and clicking inside the original flat rect but outside the quad does nothing', async ({
    page,
  }) => {
    // v2-S2 decision: in perspective mode the warped quad IS the selection area. The pre-v2
    // "flat rect stays as hit area" assertion is intentionally replaced here. We also keep
    // the original overlapping-topmost semantic and add an explicit negative assertion for
    // the "inside flat rect, outside quad" region that no longer selects anything.
    await setup(page);
    await page.getByRole('button', { name: 'LED', exact: true }).click();
    await applyTopLeftPerspectiveQuad(page);
    // Fill the LED's content via the add-text-content fast path so this test still exercises
    // "select → edit text content" — the original A3 intent carried over to the current UI.
    await page.getByTestId('editor-add-text-content').click();
    await expect(page.getByLabel('テキスト内容')).toBeVisible();
    await page.locator('.editor-canvas-container').click({ position: { x: 5, y: 5 } });
    await expect(deleteButton(page)).toBeDisabled();

    // (A) Negative — flat-rect center (720-1200, 405-675) is OUTSIDE the top-left quad; a
    // click there must not select the LED under the new quad-based hit rule.
    const flatRectCenter = await documentPointToPagePoint(page, { x: 960, y: 540 });
    await page.mouse.click(flatRectCenter.x, flatRectCenter.y);
    await expect(deleteButton(page)).toBeDisabled();

    // (B) Positive — the quad's own center is inside the warped quad; the LED selects.
    const quadCenter = await documentPointToPagePoint(page, { x: 432, y: 243 });
    await page.mouse.click(quadCenter.x, quadCenter.y);
    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeVisible();
    // Confirms "select → edit text" works post-selection: the テキスト内容 field is reachable.
    await expect(page.getByLabel('テキスト内容')).toBeVisible();

    // (C) Topmost-overlapping precedence — add an LCD, which spawns as a centered rect
    // (720-1200, 405-675) that overlaps the LED's warped quad on the strip (720-768, 405-432).
    // A click inside that strip must select the LCD (added-later, topmost in Konva stacking).
    await page.getByTestId('editor-add-lcd').click();
    // v2-S3: material combobox lives in the Appearance accordion, collapsed by default.
    await openSection(page, 'appearance');
    await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');
    const overlapStrip = await documentPointToPagePoint(page, { x: 740, y: 420 });
    await page.locator('.editor-canvas-container').click({ position: { x: 5, y: 5 } });
    await page.mouse.click(overlapStrip.x, overlapStrip.y);
    await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');

    // (D) Delete the top LCD; the same overlap point then hits the LED's warped quad, so
    // delete is still enabled and 「通常配置に戻す」 (perspective mode marker) reappears.
    await deleteButton(page).click();
    await expect(deleteButton(page)).toBeDisabled();
    await page.mouse.click(overlapStrip.x, overlapStrip.y);
    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeVisible();
  });
});

test.describe('transparent LED window blending', () => {
  test('adding a transparent LED display lets more of the space background show through as transparency increases', async ({
    page,
  }) => {
    await page.goto('/');
    // A saturated, unambiguous background color makes the directional pixel comparison below
    // (more transparency -> more background showing through -> higher red channel) robust.
    await addSpaceBackground(page, { ...DOCUMENT_SIZE, color: '#ff0000' });
    await page.getByTestId('editor-add-transparent-led').click();
    // v2-S3: material + sliders + 詳細設定 all live inside the Appearance accordion.
    await openSection(page, 'appearance');
    await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue(
      'transparent-led',
    );

    // Drive the LED pattern-grid intensity to zero so the grid overlay doesn't perturb the
    // sampled screen-center pixel, matching the pattern already used for cover-fit content.
    const intensitySlider = page.getByRole('slider', { name: '質感の強さ' });
    await intensitySlider.focus();
    await intensitySlider.press('Home');
    await intensitySlider.press('Tab');

    const transparencySlider = page.getByRole('slider', { name: '透過度（背景の見え方）' });

    async function exportAndSampleScreenCenter() {
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('editor-export-png-header').click();
      const download = await downloadPromise;
      const path = await download.path();
      const buffer = await fs.readFile(path!);
      const [pixel] = await samplePngPixels(page, buffer, [[960, 540]]);
      return pixel!;
    }

    await page.getByRole('button', { name: '詳細設定', exact: true }).click();
    await transparencySlider.focus();
    await transparencySlider.press('Home');
    await transparencySlider.press('Tab');
    await page.getByRole('button', { name: '閉じる' }).click();
    const lowTransparencyPixel = await exportAndSampleScreenCenter();

    await page.getByRole('button', { name: '詳細設定', exact: true }).click();
    await transparencySlider.focus();
    await transparencySlider.press('End');
    await transparencySlider.press('Tab');
    await page.getByRole('button', { name: '閉じる' }).click();
    const highTransparencyPixel = await exportAndSampleScreenCenter();

    // The space background is bright red (#334455 default is not red — see below); the backing
    // rect's own opacity falls as transparency rises (transparentBackingOpacity), so more of the
    // background shows through and the sampled pixel's red channel should rise.
    expect(highTransparencyPixel.r).toBeGreaterThan(lowTransparencyPixel.r);
  });
});

test.describe('video content preview and export', () => {
  test('previews an uploaded video with the autoplay/loop/mute hint and exports a real encoded clip', async ({
    page,
  }) => {
    await setup(page);
    await page.getByRole('button', { name: 'LED', exact: true }).click();

    await addVideoContent(page);
    await expect(page.getByTestId('editor-content-replace')).toBeVisible();
    await expect(
      page.getByText('動画は自動再生・ループ再生・ミュートで表示されます。'),
    ).toBeVisible();

    const exportButton = page.getByTestId('editor-export-video-header');
    await expect(exportButton).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.webm$/);
    const path = await download.path();
    const buffer = await fs.readFile(path!);
    // A real WebM/Matroska container always starts with the EBML magic number — this is not a
    // renamed PNG or an empty stub, but bytes MediaRecorder actually encoded.
    expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));

    await expect(page.getByRole('status')).toHaveText('動画を書き出しました。');
  });
});

test.describe('video export unsupported fallback', () => {
  test('hides the video export button and shows the unsupported-browser hint when MediaRecorder cannot encode', async ({
    page,
  }) => {
    // isVideoExportSupported() (videoExportCapability.ts) requires a MIME type MediaRecorder
    // reports as supported; forcing isTypeSupported to always fail reproduces an unsupported
    // browser without deleting the global (which some engines expose as non-configurable).
    await page.addInitScript(() => {
      if (typeof MediaRecorder !== 'undefined') {
        MediaRecorder.isTypeSupported = () => false;
      }
    });

    await setup(page);

    // Both export surfaces (header + toolbar panel) must drop the video button together — a
    // header-only check would pass even if the panel kept a dead button under an inoperable
    // MediaRecorder. v2-S4 Step 6 sed audit added the explicit panel assertion.
    await expect(page.getByTestId('editor-export-video-header')).toHaveCount(0);
    await expect(page.getByTestId('editor-export-video-panel')).toHaveCount(0);
    await expect(page.getByText('このブラウザは動画の書き出しに対応していません。')).toBeVisible();

    // The rest of the app must still work — PNG export is unaffected by video-export support.
    // Both PNG buttons stay enabled.
    await expect(page.getByTestId('editor-export-png-header')).toBeEnabled();
    await expect(page.getByTestId('editor-export-png-panel')).toBeEnabled();
  });
});
