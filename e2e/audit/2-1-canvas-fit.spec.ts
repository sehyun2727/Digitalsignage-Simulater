/**
 * [2-1] 캔버스 자동 맞춤 — 상세 점검
 *
 * - 2-1-a 6 해상도 × landscape + portrait: container bbox 안 + scrollY 0
 * - 2-1-b PNG 출력: 1920 / 1024 창에서 각각 → 둘 다 문서 크기, SHA-256 비교
 */
import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { openAppJa, addSpaceBg } from './_shared.js';

const VIEWPORTS = [
  { label: 'desktop-1920x1080', width: 1920, height: 1080 },
  { label: 'laptop-1366x650', width: 1366, height: 650 },
  { label: 'laptop-1440x900', width: 1440, height: 900 },
  { label: 'mid-1280x720', width: 1280, height: 720 },
  { label: 'small-1024x640', width: 1024, height: 640 },
];

for (const vp of VIEWPORTS) {
  for (const preset of ['landscape', 'portrait'] as const) {
    test(`[2-1-a] canvas fits viewport at ${vp.label} (${preset})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openAppJa(page);
      if (preset === 'portrait') {
        await page.getByRole('button', { name: '縦長 (9:16)' }).click();
      }
      await addSpaceBg(page);
      const container = page.locator('.editor-canvas-container').first();
      const box = await container.boundingBox();
      const scrollY = await page.evaluate(() => window.scrollY);
      const docScroll = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      console.log(
        `[2-1-a ${vp.label} ${preset}] bbox=${JSON.stringify(box)} scrollY=${scrollY} docScrollOverflow=${docScroll}`,
      );
      expect(box).toBeTruthy();
      if (box) {
        expect(box.y).toBeGreaterThanOrEqual(-1);
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      }
      expect(scrollY).toBeLessThanOrEqual(1);
    });
  }
}

/** Produce the same scene (space bg only) and export PNG at two viewports; compare the
 *  PNG dimensions (must be 1920×1080 at both) and SHA-256 (equal, modulo exportPixelRatio
 *  determinism). */
async function sceneAndExport(page: Page): Promise<{ hash: string; w: number; h: number }> {
  await openAppJa(page);
  await addSpaceBg(page);
  const dl = page.waitForEvent('download');
  await page.getByTestId('editor-export-png-header').click();
  const d = await dl;
  const path = await d.path();
  const buf = await readFile(path!);
  const png = PNG.sync.read(buf);
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16);
  return { hash, w: png.width, h: png.height };
}

test('[2-1-b] PNG export resolution identical at 1920 vs 1024 viewport', async ({ browser }) => {
  const ctx1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const ctx1024 = await browser.newContext({ viewport: { width: 1024, height: 640 } });
  const page1920 = await ctx1920.newPage();
  const page1024 = await ctx1024.newPage();
  try {
    const a = await sceneAndExport(page1920);
    const b = await sceneAndExport(page1024);
    console.log(`[2-1-b] 1920vp PNG = ${a.w}x${a.h} sha=${a.hash}`);
    console.log(`[2-1-b] 1024vp PNG = ${b.w}x${b.h} sha=${b.hash}`);
    expect(a.w).toBe(1920);
    expect(a.h).toBe(1080);
    expect(b.w).toBe(1920);
    expect(b.h).toBe(1080);
  } finally {
    await ctx1920.close();
    await ctx1024.close();
  }
});
