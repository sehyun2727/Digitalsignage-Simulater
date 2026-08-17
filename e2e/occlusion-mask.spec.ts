import fs from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { samplePngPixels } from './support/pixels.js';
import { addSpaceBackground, solidColorPng } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP', viewport: { width: 1280, height: 1700 } });

const DOCUMENT_SIZE = { width: 1920, height: 1080 };
// A triangle well inside the default LED object's screen region (720,405)-(1200,675).
const MASK_TRIANGLE = [
  { x: 850, y: 470 },
  { x: 1070, y: 470 },
  { x: 960, y: 620 },
];
const SAMPLE_POINT: [number, number] = [960, 520]; // centroid of MASK_TRIANGLE

async function canvasBox(page: Page) {
  return (await page.locator('.editor-canvas-container').boundingBox())!;
}

/** Converts a document-space point to a page pixel the mouse can click, mirroring the same
 *  uniform-scale conversion used by e2e/perspective-video.spec.ts. */
async function documentPointToPagePoint(
  page: Page,
  docPoint: { x: number; y: number },
): Promise<{ x: number; y: number }> {
  const box = await canvasBox(page);
  const scale = box.width / DOCUMENT_SIZE.width;
  return { x: box.x + docPoint.x * scale, y: box.y + docPoint.y * scale };
}

async function setup(page: Page): Promise<void> {
  await page.goto('/');
  await addSpaceBackground(page, { ...DOCUMENT_SIZE, color: '#1155ff' });
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();
  const content = await solidColorPng(page, '#ffee00');
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: 'content.png', mimeType: 'image/png', buffer: content });
  await page.getByRole('combobox', { name: '表示方法' }).selectOption('cover');
}

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: '詳細設定' }).click();
}

async function closeSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: '閉じる' }).click();
}

async function drawMaskTriangle(page: Page): Promise<void> {
  // The occlusion controls live behind the "詳細設定" modal; clicking "マスクを追加" both starts
  // the mask draft and closes the modal (so the canvas underneath becomes clickable again).
  await openSettings(page);
  await page.getByRole('button', { name: 'マスクを追加' }).click();
  for (const docPoint of MASK_TRIANGLE) {
    const pagePoint = await documentPointToPagePoint(page, docPoint);
    await page.mouse.click(pagePoint.x, pagePoint.y);
  }
}

async function exportAndSample(page: Page, point: [number, number]) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const buffer = await fs.readFile((await (await download).path())!);
  const [pixel] = await samplePngPixels(page, buffer, [point]);
  return pixel!;
}

/**
 * Regression coverage for foreground occlusion masks (sprint spec section 7 and the occlusion
 * editing UI added earlier this sprint, OcclusionEditOverlay.tsx/OcclusionMaskLayer.tsx): a mask
 * drawn over part of a display's screen restores the original space-photo pixels there instead of
 * the display content, and toggling the mask off/on and deleting it are all reflected in the
 * export. Uses two clearly distinguishable colors (blue space photo, yellow content) so "which one
 * is showing" can be proven by sampling actual export pixels rather than asserting on DOM state
 * alone.
 */
test('a foreground occlusion mask restores the space photo over the masked screen area', async ({
  page,
}) => {
  await setup(page);

  // Before any mask: the sample point shows the yellow display content.
  const beforeMask = await exportAndSample(page, SAMPLE_POINT);
  expect(beforeMask.g).toBeGreaterThan(beforeMask.b); // yellow: high G, low B

  await drawMaskTriangle(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const applyButton = page.getByRole('button', { name: '適用' });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();

  // Applying closes the mask-edit overlay but not the settings modal it was opened from, which
  // auto-closed when the mask draft started; reopen it to reach the mask list.
  await openSettings(page);

  // The mask list now shows one entry, enabled by default. Scoped to the occlusion list itself,
  // since the object-level "削除" button elsewhere in the toolbar shares the same label.
  const maskRow = page.locator('.toolbar-occlusion-list li').first();
  await expect(maskRow.getByText('マスク 1', { exact: true })).toBeVisible();
  const maskCheckbox = maskRow.locator('input[type="checkbox"]');
  await expect(maskCheckbox).toBeChecked();
  await closeSettings(page);

  // With the mask enabled: the same point now shows the blue space photo instead.
  const withMask = await exportAndSample(page, SAMPLE_POINT);
  expect(withMask.b).toBeGreaterThan(withMask.g); // blue: high B, low G

  // Disabling the mask restores the display content at that point.
  await openSettings(page);
  await maskCheckbox.uncheck();
  await closeSettings(page);
  const maskDisabled = await exportAndSample(page, SAMPLE_POINT);
  expect(maskDisabled.g).toBeGreaterThan(maskDisabled.b);

  // Re-enable, then delete the mask entirely: back to unmasked content, and the list empties.
  await openSettings(page);
  await maskCheckbox.check();
  await maskRow.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('マスクはまだありません。')).toBeVisible();
  await closeSettings(page);
  const afterDelete = await exportAndSample(page, SAMPLE_POINT);
  expect(afterDelete.g).toBeGreaterThan(afterDelete.b);
});

test('canceling a mask edit discards the draft without changing the object', async ({ page }) => {
  await setup(page);

  await drawMaskTriangle(page);
  await page.getByRole('button', { name: 'キャンセル' }).click();

  // Canceling closes the mask-edit overlay but not the settings modal it was opened from, which
  // auto-closed when the mask draft started; reopen it to check the (now-empty) mask list.
  await openSettings(page);
  await expect(page.getByText('マスクはまだありません。')).toBeVisible();
  await closeSettings(page);

  const afterCancel = await exportAndSample(page, SAMPLE_POINT);
  expect(afterCancel.g).toBeGreaterThan(afterCancel.b); // still shows the unmasked yellow content
});

test('a too-small mask draft is rejected and the apply button stays disabled', async ({ page }) => {
  await setup(page);

  await openSettings(page);
  await page.getByRole('button', { name: 'マスクを追加' }).click();
  // Only two points: below MIN_OCCLUSION_POINTS (3), so validation must fail.
  for (const docPoint of MASK_TRIANGLE.slice(0, 2)) {
    const pagePoint = await documentPointToPagePoint(page, docPoint);
    await page.mouse.click(pagePoint.x, pagePoint.y);
  }

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '適用' })).toBeDisabled();
});
