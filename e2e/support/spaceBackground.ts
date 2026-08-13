import type { Page } from '@playwright/test';

export async function solidColorPng(
  page: Page,
  color: string,
  width = 100,
  height = width,
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ color, width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png');
    },
    { color, width, height },
  );
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

export async function addSpaceBackground(
  page: Page,
  options: { width?: number; height?: number; color?: string } = {},
): Promise<void> {
  const { width = 1920, height = 1080, color = '#334455' } = options;
  const png = await solidColorPng(page, color, width, height);
  await page
    .getByLabel('空間写真を追加')
    .setInputFiles({ name: 'space.png', mimeType: 'image/png', buffer: png });
}
