import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { readPngDimensions } from './support/png.js';
import { addSpaceBackground } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP' });

// v2-S2 rewrites: `.editor-empty-hint` is now a "no space photo yet" hint (hidden once the
// photo exists, see src/features/editor/EditorLayout.tsx and ADR 0012 D-10). The 「テキストを
// 追加」 button moved from a top-level toolbar action into the Content section — selecting a
// display/portable surfaces it, and clicking it fills the selected signage's `content` with a
// text block (editorStore.addText fast path). "Delete" operates on the selected signage.

test('adds a text element inside a selected signage and exports a PNG at the canvas resolution', async ({
  page,
}) => {
  await page.goto('/');

  // Pre-upload: the no-space-photo hint is visible.
  await expect(page.locator('.editor-empty-hint')).toBeVisible();

  await addSpaceBackground(page, { width: 1920, height: 1080 });
  // Post-upload: the hint is gone (its only trigger is `!spaceBackground`).
  await expect(page.locator('.editor-empty-hint')).toBeHidden();

  // Add a signage first — 「テキストを追加」 is only reachable from the Content section of a
  // selected display/portable (editorStore.addText fast path, requirement 4-1 flow).
  await page.getByTestId('editor-add-led').click();
  await page.getByTestId('editor-add-text-content').click();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^signage-canvas_\d{8}-\d{6}\.png$/);
});

test('undo removes the last added element and redo restores it', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  await page.getByTestId('editor-add-led').click();
  // The LED is now the only object; LED is selected so delete acts on it.
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();

  // Undo removes the LED. With nothing on the canvas, "delete" is disabled AND the Undo
  // button itself becomes disabled (space-background has no further history behind it).
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'やり直す' })).toBeEnabled();

  // Redo re-adds the LED to the document. editorStore.redo clears `selectedId` on
  // transition (see src/store/editorStore.ts), so the delete button stays disabled until the
  // user re-selects — asserting "Undo button is now enabled" is the direct proof that history
  // moved forward and the LED is back in the document.
  await page.getByRole('button', { name: 'やり直す' }).click();
  await expect(page.getByRole('button', { name: '元に戻す' })).toBeEnabled();
  // Click the LED (centered) to reselect it; then delete is enabled again.
  const box = (await page.locator('.editor-canvas-container').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();
});

test('rejects an unsupported file type with the v2-S2 error banner', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });
  await page.getByTestId('editor-add-led').click();

  // v2-S2 flow: the standalone 「画像を追加」 button is gone (pre-v2 refactor 8cdbd77 merged it
  // into Content Upload). An unsupported file goes through the content upload input and the
  // failure surfaces as an error banner with a cause/remedy pair — same semantic the removed
  // top-level flow had, routed through the current UI.
  await page.getByTestId('editor-content-upload').setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });

  const banner = page.getByTestId('editor-error-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('対応していない');
});

test('exports at the default landscape canvas resolution (1920x1080) regardless of photo size', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 800, height: 600 });

  await page.getByTestId('editor-add-led').click();
  await page.getByTestId('editor-add-text-content').click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const buffer = await fs.readFile(path!);
  const dimensions = readPngDimensions(buffer);
  expect(dimensions).toEqual({ width: 1920, height: 1080 });
});

test('exports at the portrait canvas resolution (1080x1920) when that preset is selected', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1080, height: 1920 });
  await page.getByRole('button', { name: '縦長 (9:16)' }).click();

  await page.getByTestId('editor-add-led').click();
  await page.getByTestId('editor-add-text-content').click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const buffer = await fs.readFile(path!);
  const dimensions = readPngDimensions(buffer);
  expect(dimensions).toEqual({ width: 1080, height: 1920 });
});

test('exported PNG is byte-identical whether the element is selected or not (no selection UI leaks into export)', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  await page.getByTestId('editor-add-led').click();
  await page.getByTestId('editor-add-text-content').click();

  // addText via the Content fast path keeps the display selected and simply fills its text
  // content. First export: with LED selected.
  const firstDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const firstDownload = await firstDownloadPromise;
  const firstBuffer = await fs.readFile((await firstDownload.path())!);

  // Click an empty area to deselect so no Transformer is attached, then re-export.
  await page.locator('.editor-canvas-container').click({ position: { x: 5, y: 5 } });
  await expect(page.getByText('要素を選択するとプロパティを編集できます。')).toBeVisible();

  const secondDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGで書き出す' }).click();
  const secondDownload = await secondDownloadPromise;
  const secondBuffer = await fs.readFile((await secondDownload.path())!);

  expect(firstBuffer.equals(secondBuffer)).toBe(true);
});

test('typing in the text-content field does not trigger the delete or undo keyboard shortcuts', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  await page.getByTestId('editor-add-led').click();
  await page.getByTestId('editor-add-text-content').click();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();

  // The textarea exposing the text-content field uses the `editorTextContentLabel` 「テキスト
  // 内容」 string — reachable via its visible label from inside the ContentFields text branch.
  const textField = page.getByLabel('テキスト内容');
  await textField.click();
  await textField.fill('hello');
  await textField.press('Backspace');
  await textField.press('Control+z');

  // Neither Backspace nor Ctrl+Z leaked out of the textarea into the global shortcuts, so the
  // LED (with its text content) still exists and delete remains enabled.
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();
});
