import { expect, test } from '@playwright/test';
import { addSpaceBackground } from './support/spaceBackground.js';

test.use({ locale: 'ja-JP' });

async function solidColorPng(
  page: import('@playwright/test').Page,
  color: string,
  size = 100,
): Promise<string> {
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
  return dataUrl.split(',')[1]!;
}

/**
 * Simulates a native OS file drag-and-drop onto `.editor-canvas-container` at the given
 * document-space point (converted to a viewport client point via the container's own
 * bounding box and the Stage's uniform fit scale, matching EditorCanvas.tsx's own mapping).
 * Dispatches real `dragover` then `drop` DragEvents with a `DataTransfer` carrying one file —
 * this exercises the same native-drop code path a real desktop file drag would, unlike
 * `setInputFiles`, which only covers the file-picker-based upload flow already tested
 * elsewhere.
 */
async function dropImageOntoCanvas(
  page: import('@playwright/test').Page,
  base64: string,
  point: { x: number; y: number },
  options: { mimeType?: string; fileName?: string } = {},
) {
  const box = (await page.locator('.editor-canvas-container').boundingBox())!;
  const fitScale = box.width / 1920;
  const clientX = box.x + point.x * fitScale;
  const clientY = box.y + point.y * fitScale;

  await page.evaluate(
    ({ base64, mimeType, fileName, clientX, clientY }) => {
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i += 1) byteNumbers[i] = byteChars.charCodeAt(i);
      const file = new File([new Uint8Array(byteNumbers)], fileName, { type: mimeType });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const container = document.querySelector('.editor-canvas-container');
      if (!container) throw new Error('canvas container not found');

      container.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          dataTransfer,
        }),
      );
      container.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }),
      );
    },
    {
      base64,
      mimeType: options.mimeType ?? 'image/png',
      fileName: options.fileName ?? 'dropped.png',
      clientX,
      clientY,
    },
  );
}

async function setup(page: import('@playwright/test').Page) {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });
}

// Default display placement centers a 480x270 object on the 1920x1080 canvas, so its screen
// region (2% inset on every side) shares the object's own center point: (960, 540).
const DISPLAY_SCREEN_CENTER = { x: 960, y: 540 };

test('dropping an image file onto an LED screen region assigns it as content', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  const png = await solidColorPng(page, '#ff8800');
  await dropImageOntoCanvas(page, png, DISPLAY_SCREEN_CENTER);

  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();
});

test('dropping onto a rotated display screen region still hits it correctly', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  const rotationInput = page.getByRole('spinbutton', { name: '回転' });
  await rotationInput.fill('40');
  await rotationInput.blur();

  // The screen region's local center coincides with the object's own center (see
  // DISPLAY_SCREEN_CENTER above), and Konva rotates around the object's x/y (top-left), not
  // its center — so the rotated document-space point is object.xy + R(40deg) * localCenter,
  // where localCenter = (240, 135) (half of the 480x270 object) and object.xy = (720, 405)
  // (the default centered placement: 1920/2 - 480/2, 1080/2 - 270/2).
  const angle = (40 * Math.PI) / 180;
  const localCenter = { x: 240, y: 135 };
  const objectOrigin = { x: 720, y: 405 };
  const rotatedPoint = {
    x: objectOrigin.x + localCenter.x * Math.cos(angle) - localCenter.y * Math.sin(angle),
    y: objectOrigin.y + localCenter.x * Math.sin(angle) + localCenter.y * Math.cos(angle),
  };

  const png = await solidColorPng(page, '#00aaff');
  await dropImageOntoCanvas(page, png, rotatedPoint);

  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();
});

test('dropping onto the topmost of two overlapping displays assigns content only to that one', async ({
  page,
}) => {
  await setup(page);
  // Both displays default to the same centered 480x270 position; the LCD display is added
  // second, so it renders on top of the LED display in Konva's stacking order (same z-order
  // convention as reselection.spec.ts's overlapping-objects test). Since both objects share the
  // same size, the material combobox (not width) identifies which one received the drop.
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();
  await page.getByRole('button', { name: 'LCDディスプレイを追加' }).click();

  const png = await solidColorPng(page, '#00cc44');
  await dropImageOntoCanvas(page, png, DISPLAY_SCREEN_CENTER);

  // A successful drop also selects its target, so the material combobox identifies which
  // object received the content without any extra canvas click.
  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('lcd');
  await expect(page.getByRole('button', { name: 'コンテンツを差し替える' })).toBeVisible();

  // Delete the LCD display (topmost, now confirmed to hold the dropped content) to expose
  // the LED display beneath it, then confirm the LED display was left untouched by the drop.
  await page.getByRole('button', { name: '削除', exact: true }).click();
  const center = (await page.locator('.editor-canvas-container').boundingBox())!;
  await page.mouse.click(center.x + center.width / 2, center.y + center.height / 2);

  await expect(page.getByRole('combobox', { name: 'ディスプレイ素材' })).toHaveValue('led');
  await expect(
    page.getByText('まだコンテンツがありません。画像を追加してください。'),
  ).toBeVisible();
});

test('dropping outside any screen region does nothing', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();

  const png = await solidColorPng(page, '#ff0000');
  // Document-space (10, 10) is far outside the default display's bounds (x:[720,1200],
  // y:[405,675]), so no object's screen region contains it.
  await dropImageOntoCanvas(page, png, { x: 10, y: 10 });

  // The drop was a no-op: the pre-drop selection (the just-added display) is left untouched,
  // and it still has no content assigned.
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled();
  await expect(
    page.getByText('まだコンテンツがありません。画像を追加してください。'),
  ).toBeVisible();
});

test('dropping an unsupported file type onto a screen region shows an accessible error and does not assign content', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'LEDディスプレイを追加', exact: true }).click();

  const notAnImage = Buffer.from('this is not a real image').toString('base64');
  await dropImageOntoCanvas(page, notAnImage, DISPLAY_SCREEN_CENTER, {
    mimeType: 'text/plain',
    fileName: 'notes.txt',
  });

  await expect(page.getByRole('status')).toHaveText('PNG、JPEG、WebP形式の画像のみ利用できます。');
  await expect(
    page.getByText('まだコンテンツがありません。画像を追加してください。'),
  ).toBeVisible();
});
