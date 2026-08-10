import type { Page } from '@playwright/test';

export interface Pixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Decodes a PNG buffer in the real browser (Image + canvas + getImageData) rather than
 * writing a Node-side pixel decoder, so this reuses the browser's own PNG decoder — the
 * same one that will render the export for a real user.
 */
export async function samplePngPixels(
  page: Page,
  buffer: Buffer,
  points: Array<[number, number]>,
): Promise<Pixel[]> {
  const base64 = buffer.toString('base64');
  return page.evaluate(
    async ({ base64, points }) => {
      const img = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('failed to decode PNG for pixel sampling'));
      });
      img.src = `data:image/png;base64,${base64}`;
      await loaded;

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      return points.map(([x, y]) => {
        const data = ctx.getImageData(x, y, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2], a: data[3] };
      });
    },
    { base64, points },
  );
}
