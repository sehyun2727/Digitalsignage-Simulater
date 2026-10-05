import fs from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
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
    let topLeftFieldset = page.locator('fieldset').filter({ hasText: '左上' });
    await expect(topLeftFieldset.getByRole('spinbutton', { name: 'X座標' })).toHaveValue('0.05');

    // Change the same corner again, then Reset — the draft must revert without leaving edit mode.
    await setPerspectiveCorner(page, '左上', 0.2, 0.2);
    await page.getByRole('button', { name: 'リセット', exact: true }).click();
    topLeftFieldset = page.locator('fieldset').filter({ hasText: '左上' });
    await expect(topLeftFieldset.getByRole('spinbutton', { name: 'X座標' })).toHaveValue('0.05');
    await expect(page.getByRole('button', { name: '適用' })).toBeVisible();
    await page.getByRole('button', { name: '適用' }).click();

    // Undo reverts the perspective apply back to normal (rect) placement; the object is
    // deselected by the undo itself, so it must be reselected via canvas click to check its
    // properties panel, matching the established reselection-after-undo pattern.
    await page.getByRole('button', { name: '元に戻す' }).click();
    await expect(deleteButton(page)).toBeDisabled();
    const center = await documentPointToPagePoint(page, { x: 960, y: 540 });
    await page.mouse.click(center.x, center.y);
    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeHidden();

    await page.getByRole('button', { name: 'やり直す' }).click();
    await expect(deleteButton(page)).toBeDisabled();
    await page.mouse.click(center.x, center.y);
    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeVisible();
  });

  test('hit-testing follows the perspective object’s flat rect, not its warped visual body, and yields to an overlapping topmost object there', async ({
    page,
  }) => {
    await setup(page);
    await page.getByRole('button', { name: 'LED', exact: true }).click();
    await applyTopLeftPerspectiveQuad(page);

    // v2-S2 rewrite: 「テキストを追加」 moved into the Content section and now fills the
    // selected display's content (editorStore.addText fast path), rather than creating a
    // sibling text object. The test needs two independent default-centered objects to prove
    // the flat-hit-area precedence rule — swap the text sibling for an LCD display, which
    // also centers at the document midpoint and renders on top of the LED (added-later =
    // topmost in Konva's stacking order). The semantic ("the topmost overlapping object
    // wins the click") is preserved.
    await page.getByTestId('editor-add-lcd').click();
    await expect(deleteButton(page)).toBeEnabled();

    const flatRectCenter = await documentPointToPagePoint(page, { x: 960, y: 540 });
    await page.mouse.click(flatRectCenter.x, flatRectCenter.y);
    // LCD selected → its Material selector reads 'lcd'. This is a stable positive signal that
    // the top of the stack won the click.
    await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');

    await deleteButton(page).click();
    await expect(deleteButton(page)).toBeDisabled();

    // With the LCD gone, the same center point now hits the LED display's flat rect, even
    // though that display's visible body has been warped away to the top-left quadrant.
    await page.mouse.click(flatRectCenter.x, flatRectCenter.y);
    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: '通常配置に戻す' })).toBeVisible();

    // The warped visual body sits at the quad's own center (~0.225, 0.225 normalized); nothing
    // is listening there, so clicking it must deselect rather than select the display.
    const warpedVisualCenter = await documentPointToPagePoint(page, { x: 432, y: 243 });
    await page.mouse.click(warpedVisualCenter.x, warpedVisualCenter.y);
    await expect(deleteButton(page)).toBeDisabled();
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
      await page.getByRole('button', { name: 'PNGで書き出す' }).click();
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

    const exportButton = page.getByRole('button', { name: '動画で書き出す' });
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

    await expect(page.getByRole('button', { name: '動画で書き出す' })).toHaveCount(0);
    await expect(page.getByText('このブラウザは動画の書き出しに対応していません。')).toBeVisible();

    // The rest of the app must still work — PNG export is unaffected by video-export support.
    await expect(page.getByRole('button', { name: 'PNGで書き出す' })).toBeEnabled();
  });
});
