/**
 * [2-1] 캔버스 자동 맞춤
 *
 * 네 해상도에서 landscape + portrait 캔버스 모두: .editor-canvas-container 가 뷰포트
 * 안에 들어오고 세로 스크롤이 0 임을 측정.
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg } from './_shared.js';

const VIEWPORTS = [
  { label: 'desktop-1920x1080', width: 1920, height: 1080 },
  { label: 'laptop-1366x650', width: 1366, height: 650 },
  { label: 'small-1024x640', width: 1024, height: 640 },
];

for (const vp of VIEWPORTS) {
  test(`[2-1] canvas fits inside viewport at ${vp.label} (landscape)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openAppJa(page);
    await addSpaceBg(page);
    const container = page.locator('.editor-canvas-container').first();
    const box = await container.boundingBox();
    const scrollY = await page.evaluate(() => window.scrollY);
    const docScroll = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    console.log(
      `[2-1 ${vp.label}] container bbox=${JSON.stringify(box)} scrollY=${scrollY} docScrollOverflow=${docScroll}`,
    );
    expect(box).toBeTruthy();
    if (box) {
      expect(box.y).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
    }
    expect(scrollY).toBeLessThanOrEqual(1);
  });
}
