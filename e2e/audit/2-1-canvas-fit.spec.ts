/**
 * [2-1] 캔버스 자동 맞춤 — 상세 점검
 *
 * - 2-1-a 6 해상도 × landscape + portrait: container bbox 안 + scrollY 0
 * - 2-1-b PNG 출력 바이트 비교 (1920 vs 1024 viewport). 둘 다 문서 해상도 1920×1080 + SHA-256.
 * - 2-1-c 디코딩한 동영상 해상도 (landscape 1920×1080, portrait 1080×1920)
 * - 2-1-d 녹화 중 미리보기 bbox 변화 (K4 pattern)
 */
import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { openAppJa, addSpaceBg } from './_shared.js';

const VIEWPORTS = [
  { label: 'desktop-1920x1080', width: 1920, height: 1080 },
  { label: 'laptop-1440x900', width: 1440, height: 900 },
  { label: 'laptop-1366x650', width: 1366, height: 650 },
  { label: 'mid-1280x720', width: 1280, height: 720 },
  { label: 'small-1024x640', width: 1024, height: 640 },
  { label: 'mobile-390x844', width: 390, height: 844 },
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
      // Wait for Konva stage to be fully mounted so bbox reflects the final layout.
      await page.locator('.konvajs-content canvas').first().waitFor({ state: 'visible' });
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
        if (vp.width >= 768) {
          // Desktop/laptop: canvas must fit the viewport without any vertical scroll
          // (CLAUDE.md §3-7 `overflow: hidden`). The `+1` is sub-pixel float slack.
          expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
          expect(scrollY).toBeLessThanOrEqual(1);
        } else {
          // v2-P3 A6: mobile strict reading. CLAUDE.md 4bis defines mobile fitScale
          // as `min(viewportInnerW − 24, 0.7 × viewportInnerH)` → canvas height is
          // ≤ 0.7 × viewport height which is **strictly** ≤ viewport height. The
          // canvas's **own box** fits a single screen. The toolbar sits below in a
          // vertically-stacked shell; scrolling reveals both canvas and toolbar.
          // Rule (P3 A6): canvas.height ≤ viewport.height AND canvas is reachable
          // in one scroll step (bbox after scroll fits viewport).
          expect(box.height).toBeLessThanOrEqual(vp.height + 1);
          expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
          // Scroll to the canvas's y and verify the box fully fits within viewport.
          await page.evaluate((y) => window.scrollTo(0, Math.max(0, y)), box.y);
          const afterScroll = await page.locator('.editor-canvas-container').first().boundingBox();
          console.log(
            `[2-1-a ${vp.label} ${preset}] after scroll to y=${box.y.toFixed(1)}: bbox=${JSON.stringify(afterScroll)}`,
          );
          if (afterScroll) {
            expect(afterScroll.y).toBeGreaterThanOrEqual(-1);
            expect(afterScroll.y + afterScroll.height).toBeLessThanOrEqual(vp.height + 1);
          }
        }
      }
    });
  }
}

/** Produce the same scene (space bg only) and export PNG at two viewports; compare the
 *  PNG dimensions (must be 1920×1080 at both) and SHA-256 (equal, modulo exportPixelRatio
 *  determinism). */
async function sceneAndExport(
  page: Page,
): Promise<{ hash: string; w: number; h: number; bytes: number }> {
  await openAppJa(page);
  await addSpaceBg(page);
  const dl = page.waitForEvent('download');
  await page.getByTestId('editor-export-png-header').click();
  const d = await dl;
  const path = await d.path();
  const buf = await readFile(path!);
  const png = PNG.sync.read(buf);
  const hash = createHash('sha256').update(buf).digest('hex');
  return { hash, w: png.width, h: png.height, bytes: buf.length };
}

test('[2-1-b] PNG export: both viewports deliver the same 1920×1080 PNG (bytes + SHA-256)', async ({
  browser,
}) => {
  const ctx1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const ctx1024 = await browser.newContext({ viewport: { width: 1024, height: 640 } });
  const page1920 = await ctx1920.newPage();
  const page1024 = await ctx1024.newPage();
  try {
    const a = await sceneAndExport(page1920);
    const b = await sceneAndExport(page1024);
    console.log(`[2-1-b] 1920vp PNG = ${a.w}x${a.h} bytes=${a.bytes} sha=${a.hash}`);
    console.log(`[2-1-b] 1024vp PNG = ${b.w}x${b.h} bytes=${b.bytes} sha=${b.hash}`);
    expect(a.w).toBe(1920);
    expect(a.h).toBe(1080);
    expect(b.w).toBe(1920);
    expect(b.h).toBe(1080);
    // Both exports go through the same `exportPixelRatio = 1/fitScale × (1 + 1e-6)` path
    // so the resulting bytes are deterministic for the same scene regardless of viewport
    // (the raster framebuffer dimensions are fixed at 1920×1080).
    expect(a.hash).toBe(b.hash);
  } finally {
    await ctx1920.close();
    await ctx1024.close();
  }
});

async function recordFirstFrame(
  page: Page,
  seekSeconds: number,
): Promise<{ width: number; height: number } | null> {
  const videoButton = page.getByTestId('editor-export-video-header');
  if ((await videoButton.count()) === 0) return null;
  const dl = page.waitForEvent('download');
  await videoButton.click();
  const d = await dl;
  const path = await d.path();
  const buffer = await readFile(path!);
  const base64 = buffer.toString('base64');
  const result = await page.evaluate(
    async ({ base64, seekSeconds }) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = `data:video/webm;base64,${base64}`;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('video decode failed'));
      });
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = seekSeconds;
      });
      return { width: video.videoWidth, height: video.videoHeight };
    },
    { base64, seekSeconds },
  );
  return result;
}

test('[2-1-c] decoded video resolution: landscape 1920×1080, portrait 1080×1920', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Landscape first.
  await openAppJa(page);
  await addSpaceBg(page);
  const landscape = await recordFirstFrame(page, 0.1);
  if (!landscape) {
    test.skip(true, 'MediaRecorder not available');
    return;
  }
  console.log(`[2-1-c] landscape video = ${landscape.width}×${landscape.height}`);
  expect(landscape.width).toBe(1920);
  expect(landscape.height).toBe(1080);
  // New page for portrait.
  await page.goto('/');
  await page.getByRole('button', { name: '縦長 (9:16)' }).click();
  await addSpaceBg(page);
  const portrait = await recordFirstFrame(page, 0.1);
  if (!portrait) return;
  console.log(`[2-1-c] portrait video = ${portrait.width}×${portrait.height}`);
  expect(portrait.width).toBe(1080);
  expect(portrait.height).toBe(1920);
});

test('[2-1-d] preview bbox is invariant across a recording (stage frozen)', async ({ page }) => {
  test.setTimeout(90_000);
  await openAppJa(page);
  await addSpaceBg(page);
  const container = page.locator('.editor-canvas-container').first();
  const before = await container.boundingBox();
  // Sample the bbox 10 times during a recording. The recording itself emits a 5-second
  // clip (handled by `recordFirstFrame`'s video button click).
  const bboxSamples: Array<{ x: number; y: number; w: number; h: number }> = [];
  const samplingTask = (async () => {
    const start = Date.now();
    while (Date.now() - start < 5000) {
      const b = await container.boundingBox();
      if (b) bboxSamples.push({ x: b.x, y: b.y, w: b.width, h: b.height });
      await new Promise((r) => setTimeout(r, 100));
    }
  })();
  const videoButton = page.getByTestId('editor-export-video-header');
  if ((await videoButton.count()) === 0) {
    test.skip(true, 'MediaRecorder not available');
    return;
  }
  const dl = page.waitForEvent('download');
  await videoButton.click();
  await samplingTask;
  await dl;
  const after = await container.boundingBox();
  if (!before || !after) throw new Error('no bbox');
  const maxDrift = bboxSamples.reduce((acc, s) => {
    const d =
      Math.abs(s.x - before.x) +
      Math.abs(s.y - before.y) +
      Math.abs(s.w - before.width) +
      Math.abs(s.h - before.height);
    return Math.max(acc, d);
  }, 0);
  console.log(
    `[2-1-d] bbox samples=${bboxSamples.length} maxDrift=${maxDrift.toFixed(2)}px before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
  );
  expect(maxDrift).toBeLessThanOrEqual(0.5);
});
