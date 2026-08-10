import { expect, test } from '@playwright/test';
import { spliceExifIntoJpeg } from './support/exif.js';

test.use({ locale: 'ja-JP' });

test('applies EXIF orientation the same way the browser natively decodes it', async ({ page }) => {
  await page.goto('/');

  // Encode a real 100x50 JPEG using the browser's own canvas encoder, then splice a
  // hand-built Exif "Rotate 90 CW" (orientation 6) segment onto it. Evergreen browsers
  // auto-apply Exif orientation when decoding via Image(), swapping the reported
  // naturalWidth/naturalHeight for a 90/270-degree rotation.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 50;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 100, 50);
    return canvas.toDataURL('image/jpeg', 0.92);
  });
  const plainJpeg = Buffer.from(dataUrl.split(',')[1]!, 'base64');
  const rotatedJpeg = spliceExifIntoJpeg(plainJpeg, 6);

  const fileInput = page.getByLabel('画像を追加');
  await fileInput.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: rotatedJpeg });

  await expect(page.getByRole('button', { name: '削除' })).toBeEnabled();
  await expect(page.getByLabel('幅')).toHaveValue('50');
  await expect(page.getByLabel('高さ')).toHaveValue('100');
});

test('shows an accessible error and does not add an element when an image fails to decode', async ({
  page,
}) => {
  await page.goto('/');

  const fileInput = page.getByLabel('画像を追加');
  await fileInput.setInputFiles({
    name: 'corrupt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('this is not a real png file'),
  });

  await expect(page.getByRole('status')).toHaveText(
    '画像を読み込めませんでした。ファイルが破損している可能性があります。',
  );
  await expect(page.getByText('まだ要素がありません')).toBeVisible();
  await expect(page.getByRole('button', { name: '削除' })).toBeDisabled();
});
