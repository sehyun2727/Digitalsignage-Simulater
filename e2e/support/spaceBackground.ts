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

export type ScenePhotoScenario = 'bright-interior' | 'dark-interior' | 'outdoor-daylight';

/**
 * Generates a self-authored, procedurally-drawn stand-in for a real interior/exterior photo
 * (gradients + a highlight, drawn in-browser via canvas — see e2e/fixtures/README.md for why no
 * actual photo asset is committed) so the golden-image scenarios in visual-qa.spec.ts exercise
 * material/glow/shadow rendering against a busier, non-flat background than the existing
 * solid-color scenes, without adding any binary fixture file or network fetch.
 */
export async function scenePhotoPng(
  page: Page,
  scenario: ScenePhotoScenario,
  width = 1920,
  height = 1080,
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ scenario, width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      if (scenario === 'bright-interior') {
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#f4ede1');
        sky.addColorStop(0.6, '#ddceb8');
        sky.addColorStop(1, '#a99a82');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(92, 74, 52, 0.55)';
        ctx.fillRect(0, height * 0.82, width, height * 0.18);

        const glow = ctx.createRadialGradient(
          width * 0.25,
          height * 0.3,
          0,
          width * 0.25,
          height * 0.3,
          width * 0.35,
        );
        glow.addColorStop(0, 'rgba(255, 250, 235, 0.9)');
        glow.addColorStop(1, 'rgba(255, 250, 235, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else if (scenario === 'dark-interior') {
        const ambient = ctx.createLinearGradient(0, 0, 0, height);
        ambient.addColorStop(0, '#141821');
        ambient.addColorStop(0.6, '#0c0e14');
        ambient.addColorStop(1, '#05060a');
        ctx.fillStyle = ambient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, height * 0.85, width, height * 0.15);

        for (const [fx, fy] of [
          [0.2, 0.35],
          [0.8, 0.45],
        ]) {
          const spot = ctx.createRadialGradient(
            width * fx,
            height * fy,
            0,
            width * fx,
            height * fy,
            width * 0.18,
          );
          spot.addColorStop(0, 'rgba(120, 140, 200, 0.35)');
          spot.addColorStop(1, 'rgba(120, 140, 200, 0)');
          ctx.fillStyle = spot;
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#4a90d9');
        sky.addColorStop(0.55, '#bfe0f5');
        sky.addColorStop(0.56, '#7fae6a');
        sky.addColorStop(1, '#4d7a3f');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);

        const sun = ctx.createRadialGradient(
          width * 0.78,
          height * 0.2,
          0,
          width * 0.78,
          height * 0.2,
          width * 0.22,
        );
        sun.addColorStop(0, 'rgba(255, 255, 240, 0.95)');
        sun.addColorStop(1, 'rgba(255, 255, 240, 0)');
        ctx.fillStyle = sun;
        ctx.fillRect(0, 0, width, height);
      }

      return canvas.toDataURL('image/png');
    },
    { scenario, width, height },
  );
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

export async function addScenePhotoBackground(
  page: Page,
  scenario: ScenePhotoScenario,
  width = 1920,
  height = 1080,
): Promise<void> {
  const png = await scenePhotoPng(page, scenario, width, height);
  await page
    .getByLabel('空間写真を追加')
    .setInputFiles({ name: `${scenario}.png`, mimeType: 'image/png', buffer: png });
}
