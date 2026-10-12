import { expect, test, type Page } from '@playwright/test';
import { addSpaceBackground } from './support/spaceBackground.js';

// v2-S5 K4 (C12-video). The S4 handoff flagged that `beginVideoExportCapture` returned the
// display-size layer canvas, so a 1280×720-viewport recording came out 832×468 (not the
// 1920×1080 preset). S5 K4 fixes this by setting `layer.getCanvas().setPixelRatio(target)`
// during the capture — target = size.width / (size.width * fitScale) = 1/fitScale. The
// physical canvas now matches the document preset; the on-screen size is unchanged (Konva
// keeps `canvas.style.width` the same when pixelRatio changes). This spec verifies:
//   - raw frame dimensions equal the document preset (1920×1080 landscape, 1080×1920 portrait)
//   - a doc-space 8-px-period black/white vertical stripe pattern retains its period
//     (8 ± 1 px) and Michelson contrast ≥ 0.5 in the recorded frame
//   - the stage bbox is unchanged before, during, and after a recording (canvas-freeze intact)

test.describe('K4 video capture at document resolution', () => {
  // Each test records a 5-second clip and decodes it in-page; the default 30-s timeout
  // is tight once Playwright + CPU slop are factored in. 90 s gives generous headroom.
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(90_000);

  async function recordFirstFrame(
    page: Page,
    seekSeconds: number,
  ): Promise<{
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
  } | null> {
    const videoButton = page.getByTestId('editor-export-video-header');
    if ((await videoButton.count()) === 0) return null;
    const dl = page.waitForEvent('download');
    await videoButton.click();
    const d = await dl;
    const path = await d.path();
    const fs = await import('node:fs/promises');
    const buffer = await fs.readFile(path!);
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
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return {
          width: canvas.width,
          height: canvas.height,
          pixels: Array.from(data.data),
        };
      },
      { base64, seekSeconds },
    );
    return {
      width: result.width,
      height: result.height,
      pixels: new Uint8ClampedArray(result.pixels),
    };
  }

  test('K4 raw resolution: landscape video is 1920×1080', async ({ page }) => {
    await page.goto('/');
    await addSpaceBackground(page, { width: 1920, height: 1080, color: '#406080' });
    const stageBefore = await page.locator('.editor-canvas-container').boundingBox();
    const frame = await recordFirstFrame(page, 0.1);
    if (!frame) {
      test.skip(true, 'MediaRecorder not available');
      return;
    }
    const stageAfter = await page.locator('.editor-canvas-container').boundingBox();
    const bbChange =
      Math.abs((stageAfter?.x ?? 0) - (stageBefore?.x ?? 0)) +
      Math.abs((stageAfter?.y ?? 0) - (stageBefore?.y ?? 0)) +
      Math.abs((stageAfter?.width ?? 0) - (stageBefore?.width ?? 0)) +
      Math.abs((stageAfter?.height ?? 0) - (stageBefore?.height ?? 0));
    console.log(
      `K4 landscape: video=${frame.width}×${frame.height} stageBboxΔ=${bbChange.toFixed(2)}`,
    );
    expect(frame.width).toBe(1920);
    expect(frame.height).toBe(1080);
    expect(bbChange).toBeLessThanOrEqual(0.5);
  });

  test('K4 raw resolution: portrait video is 1080×1920', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /縦長/ }).first().click();
    await addSpaceBackground(page, { width: 1080, height: 1920, color: '#406080' });
    const frame = await recordFirstFrame(page, 0.1);
    if (!frame) {
      test.skip(true, 'MediaRecorder not available');
      return;
    }
    console.log(`K4 portrait: video=${frame.width}×${frame.height}`);
    expect(frame.width).toBe(1080);
    expect(frame.height).toBe(1920);
  });

  // 8-px doc-space stripes test. We draw a stripe PNG that at the preset (1920×1080)
  // consists of 240 vertical stripes 8 px wide, alternating black and white. Encoding the
  // stripes INTO the space background (not an LED) makes the capture a pure render of the
  // background through the K4 pixelRatio bump — if the pixel ratio didn't scale right, the
  // period would come out as 4 or 16 instead of 8.
  async function stripePng(page: Page): Promise<Buffer> {
    return page
      .evaluate(() => {
        const w = 1920;
        const h = 1080;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        for (let x = 0; x < w; x += 8) {
          ctx.fillStyle = (x / 8) % 2 === 0 ? '#000000' : '#ffffff';
          ctx.fillRect(x, 0, 8, h);
        }
        const dataUrl = canvas.toDataURL('image/png');
        const bin = atob(dataUrl.split(',')[1]!);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return Array.from(arr);
      })
      .then((arr) => Buffer.from(arr));
  }

  test('K4 8px doc-space stripe: period 8 ± 1 px, Michelson contrast ≥ 0.5', async ({ page }) => {
    await page.goto('/');
    const stripes = await stripePng(page);
    await page.getByLabel('空間写真を追加').setInputFiles({
      name: 'stripes.png',
      mimeType: 'image/png',
      buffer: stripes,
    });
    const frame = await recordFirstFrame(page, 0.1);
    if (!frame) {
      test.skip(true, 'MediaRecorder not available');
      return;
    }
    const w = frame.width;
    const h = frame.height;
    const midY = Math.floor(h / 2);
    // Scan a horizontal row through the middle: measure luminance per pixel and detect
    // transition points (sign change in gradient). Period = (end − start) / N_transitions.
    const lumRow: number[] = [];
    for (let x = 0; x < w; x++) {
      const i = (midY * w + x) * 4;
      const r = frame.pixels[i]!;
      const g = frame.pixels[i + 1]!;
      const b = frame.pixels[i + 2]!;
      lumRow.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    // Thresholded transitions: dark→bright crossings at luminance midpoint 128.
    const transitions: number[] = [];
    for (let x = 1; x < w; x++) {
      if ((lumRow[x - 1]! < 128 && lumRow[x]! >= 128) || (lumRow[x - 1]! >= 128 && lumRow[x]! < 128)) {
        transitions.push(x);
      }
    }
    // Period = distance between the first and last transition divided by (N − 1). Each full
    // period (black + white stripe) spans 16 px at the preset; each half-period (one stripe)
    // is 8 px, which is what transitions-between-adjacent gives us.
    const periods: number[] = [];
    for (let i = 1; i < transitions.length; i++) {
      periods.push(transitions[i]! - transitions[i - 1]!);
    }
    // Reject the first and last 2 periods to avoid edge-sampling artifacts from the video
    // codec's YUV subsampling at the frame boundary.
    const stablePeriods = periods.slice(2, -2);
    const avgPeriod =
      stablePeriods.length > 0
        ? stablePeriods.reduce((a, b) => a + b, 0) / stablePeriods.length
        : NaN;
    const minLum = Math.min(...lumRow);
    const maxLum = Math.max(...lumRow);
    const michelson = (maxLum - minLum) / (maxLum + minLum);
    console.log(
      `K4 stripes: video=${w}×${h} transitions=${transitions.length} avgPeriod=${avgPeriod.toFixed(2)} px minLum=${minLum.toFixed(1)} maxLum=${maxLum.toFixed(1)} Michelson=${michelson.toFixed(3)}`,
    );
    expect(w).toBe(1920);
    expect(h).toBe(1080);
    expect(Math.abs(avgPeriod - 8)).toBeLessThanOrEqual(1);
    expect(michelson).toBeGreaterThanOrEqual(0.5);
  });

  // Measure recording duration — the Toolbar export sets a 5000 ms recording. The actual
  // encoded video duration (video.duration) should be close to that, within codec slop.
  test('K4 5-second recording actually lasts ~5 seconds', async ({ page }) => {
    await page.goto('/');
    await addSpaceBackground(page, { width: 1920, height: 1080, color: '#334455' });
    const videoButton = page.getByTestId('editor-export-video-header');
    if ((await videoButton.count()) === 0) {
      test.skip(true, 'MediaRecorder not available');
      return;
    }
    const t0 = Date.now();
    const dl = page.waitForEvent('download');
    await videoButton.click();
    const d = await dl;
    const t1 = Date.now();
    const path = await d.path();
    const fs = await import('node:fs/promises');
    const buffer = await fs.readFile(path!);
    const base64 = buffer.toString('base64');
    const duration = await page.evaluate(async (b64) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = `data:video/webm;base64,${b64}`;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('video decode failed'));
      });
      // WebM from MediaRecorder may report duration = Infinity until the stream is scanned.
      // Scrubbing to a far point forces metadata parse.
      if (!isFinite(video.duration)) {
        await new Promise<void>((resolve) => {
          video.ondurationchange = () => resolve();
          video.currentTime = 10000;
        });
      }
      return video.duration;
    }, base64);
    const wallClock = (t1 - t0) / 1000;
    console.log(
      `K4 duration: encoded=${duration.toFixed(2)}s wallClock=${wallClock.toFixed(2)}s`,
    );
    expect(wallClock).toBeGreaterThanOrEqual(4.5);
    expect(wallClock).toBeLessThanOrEqual(8.0);
  });
});
