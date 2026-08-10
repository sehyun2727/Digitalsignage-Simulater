import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// The Stand Display template renders a tall portrait canvas container (well over 1500px once
// fit to a 1280px-wide viewport at its native aspect ratio); a viewport limited to the default
// 720px height would put the container's own vertical center below the fold, where raw
// page.mouse.click() coordinates can't land. A taller viewport keeps every test's canvas-center
// math (see canvasCenter() below) valid across every template this suite exercises.
test.use({ locale: 'ja-JP', viewport: { width: 1280, height: 1700 } });

/**
 * Every object kind is placed centered on the canvas by default (`x = template.width/2 -
 * width/2`, `y = template.height/2 - height/2` in editorStore.ts's add* actions), so the
 * `.editor-canvas-container` element's own bounding-box center always coincides with a
 * freshly added object's bounding-box center regardless of kind, template, or size. This lets
 * every test below click a single, reusable point instead of computing per-kind canvas math.
 */
async function canvasCenter(
  page: import('@playwright/test').Page,
): Promise<{ x: number; y: number }> {
  const box = (await page.locator('.editor-canvas-container').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function canvasCorner(
  page: import('@playwright/test').Page,
): Promise<{ x: number; y: number }> {
  const box = (await page.locator('.editor-canvas-container').boundingBox())!;
  return { x: box.x + 5, y: box.y + 5 };
}

async function solidColorPng(
  page: import('@playwright/test').Page,
  color: string,
  size = 100,
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ color, size }) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      return canvas.toDataURL('image/png');
    },
    { color, size },
  );
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

const deleteButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: '削除' });

async function deselectViaBlankCanvas(page: import('@playwright/test').Page) {
  const corner = await canvasCorner(page);
  await page.mouse.click(corner.x, corner.y);
  await expect(deleteButton(page)).toBeDisabled();
  await expect(page.getByText('要素を選択するとプロパティを編集できます。')).toBeVisible();
}

async function reselectViaCanvasClick(page: import('@playwright/test').Page) {
  const center = await canvasCenter(page);
  await page.mouse.click(center.x, center.y);
}

test.describe('canvas object reselection', () => {
  test('a Wall LED display is reselectable after being deselected', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '壁掛けLEDを追加' }).click();
    await expect(deleteButton(page)).toBeEnabled();

    await deselectViaBlankCanvas(page);
    await reselectViaCanvasClick(page);

    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: '幅' })).toHaveValue('480');
    await expect(page.getByRole('spinbutton', { name: '高さ' })).toHaveValue('270');
  });

  test('a Stand Display is reselectable after being deselected', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('テンプレート').selectOption('stand-display');
    await page.getByRole('button', { name: 'スタンド型ディスプレイを追加' }).click();
    await expect(deleteButton(page)).toBeEnabled();

    await deselectViaBlankCanvas(page);
    await reselectViaCanvasClick(page);

    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('spinbutton', { name: '幅' })).toHaveValue('220');
    await expect(page.getByRole('spinbutton', { name: '高さ' })).toHaveValue('420');
  });

  test('a custom portable product is reselectable after being deselected', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
    const dialog = page.getByRole('dialog');
    const photo = await solidColorPng(page, '#1155ff');
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: photo });
    await dialog.getByRole('button', { name: '次へ' }).click();
    await dialog.getByRole('button', { name: '追加', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(deleteButton(page)).toBeEnabled();

    await deselectViaBlankCanvas(page);
    await reselectViaCanvasClick(page);

    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: '画面領域を編集' })).toBeVisible();
  });

  test('a text object is reselectable after being deselected', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'テキストを追加' }).click();
    await expect(deleteButton(page)).toBeEnabled();

    await deselectViaBlankCanvas(page);
    await reselectViaCanvasClick(page);

    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByLabel('テキスト内容')).toBeVisible();
  });

  test('an uploaded image object is reselectable after being deselected', async ({ page }) => {
    await page.goto('/');
    const photo = await solidColorPng(page, '#22aa66');
    await page
      .getByLabel('画像を追加')
      .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: photo });
    await expect(deleteButton(page)).toBeEnabled();

    await deselectViaBlankCanvas(page);
    await reselectViaCanvasClick(page);

    await expect(deleteButton(page)).toBeEnabled();
    // An image object has no kind-specific properties section, unlike text/display/portable —
    // its absence, alongside the delete button re-enabling, is the positive signal here.
    await expect(page.getByLabel('テキスト内容')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveCount(0);
  });

  test('dragging an unselected display selects it and moves it in a single gesture', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '壁掛けLEDを追加' }).click();
    await deselectViaBlankCanvas(page);

    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 60, center.y + 40, { steps: 5 });
    await page.mouse.up();

    await expect(deleteButton(page)).toBeEnabled();
    const xValue = Number(await page.getByRole('spinbutton', { name: 'X座標' }).inputValue());
    // Started at template.width/2 - width/2 = 960 - 240 = 720; a +60px drag must move it, not
    // leave it in place (which would mean the drag started a fresh, unselected pan instead of
    // grabbing the display).
    expect(xValue).toBeGreaterThan(720);
  });

  test('selection is cleared by Undo and Redo, and a subsequent click reselects the object', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '壁掛けLEDを追加' }).click();

    // A second history entry (beyond the add itself) so Undo reverts the move, not the add.
    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 50, center.y + 20, { steps: 5 });
    await page.mouse.up();
    await expect(deleteButton(page)).toBeEnabled();

    await page.getByRole('button', { name: '元に戻す' }).click();
    await expect(deleteButton(page)).toBeDisabled();
    await reselectViaCanvasClick(page);
    await expect(deleteButton(page)).toBeEnabled();

    await page.getByRole('button', { name: 'やり直す' }).click();
    await expect(deleteButton(page)).toBeDisabled();
    await reselectViaCanvasClick(page);
    await expect(deleteButton(page)).toBeEnabled();
  });

  test('reselecting an object repeatedly does not create extra history entries', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '壁掛けLEDを追加' }).click();

    await deselectViaBlankCanvas(page);
    await reselectViaCanvasClick(page);
    await deselectViaBlankCanvas(page);
    await reselectViaCanvasClick(page);

    // If selection-only interactions had pushed history entries, a single Undo would not be
    // enough to fully remove the object (it would instead revert the last no-op selection).
    await page.getByRole('button', { name: '元に戻す' }).click();
    await expect(page.getByText('まだ要素がありません')).toBeVisible();
  });

  test('clicking the topmost of two overlapping objects selects it, not the one beneath', async ({
    page,
  }) => {
    await page.goto('/');
    // Both default to the same centered position; addText is added second, so it renders on
    // top of the Wall LED display in Konva's stacking order.
    await page.getByRole('button', { name: '壁掛けLEDを追加' }).click();
    await page.getByRole('button', { name: 'テキストを追加' }).click();

    await deselectViaBlankCanvas(page);
    await reselectViaCanvasClick(page);

    await expect(deleteButton(page)).toBeEnabled();
    await expect(page.getByLabel('テキスト内容')).toBeVisible();
  });

  test('exported PNG is byte-identical whether the display was freshly added or reselected by click (no hit-area or selection UI leaks into export)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '壁掛けLEDを追加' }).click();

    const firstDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGで書き出す' }).click();
    const firstBuffer = await fs.readFile((await (await firstDownloadPromise).path())!);

    await deselectViaBlankCanvas(page);
    await reselectViaCanvasClick(page);
    await expect(deleteButton(page)).toBeEnabled();

    const secondDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGで書き出す' }).click();
    const secondBuffer = await fs.readFile((await (await secondDownloadPromise).path())!);

    expect(firstBuffer.equals(secondBuffer)).toBe(true);
  });
});
