import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSection } from './support/accordion.js';
import { addSpaceBackground } from './support/spaceBackground.js';

// v2-S4 Step 0-3 / a-pre. The frozen Stage frame — the editor's `.editor-canvas-container`
// div (the border-box the Stage mounts inside, which is the single on-screen rectangle the
// user can actually see and drag into) — is pinned to the v2-S3-ok reference bbox at every
// supported viewport × preset. Any size/position drift means someone touched a value listed
// under CLAUDE.md §4bis "동결 대상" without going through [canvas-approved].
//
// Why `.editor-canvas-container` and not `.konvajs-content`: the inner Konva wrapper leaks
// one CSS px past its parent on each side at non-integer fit scales, so its reported bbox is
// off by ~1 px even when the fit math is exactly right. The border-box container is the
// single stable rectangle every L/G/B/L2 e2e in the suite already measures against.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const freeze = JSON.parse(
  readFileSync(join(__dirname, '..', 'docs', 'v2', 'canvas-freeze.json'), 'utf8'),
);
const SELECTOR: string = freeze.stage.selector;
const TOLERANCE: number = freeze.stage.tolerance_px;

interface Scenario {
  viewport: { w: number; h: number };
  preset: 'landscape' | 'portrait';
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Awaits one browser animation frame. Replaces a magic-number waitForTimeout — the Stage's
 *  ResizeObserver fires on the next frame after a layout change, so a single rAF yields the
 *  settled bbox far more reliably than a fixed sleep (and finishes instantly in CI). */
async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

/** Polls `locator.boundingBox()` once per animation frame until two consecutive reads match
 *  within 0.01 px on every edge, then returns that bbox. Guards against mid-layout reads: the
 *  measurement is only accepted once the box has stopped changing. */
async function waitForStableBbox(
  page: Page,
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const MAX_FRAMES = 120;
  const EPS = 0.01;
  let prev: { x: number; y: number; width: number; height: number } | null = null;
  for (let i = 0; i < MAX_FRAMES; i++) {
    const box = await locator.boundingBox();
    if (box == null) {
      await nextFrame(page);
      continue;
    }
    if (
      prev &&
      Math.abs(box.x - prev.x) < EPS &&
      Math.abs(box.y - prev.y) < EPS &&
      Math.abs(box.width - prev.width) < EPS &&
      Math.abs(box.height - prev.height) < EPS
    ) {
      return box;
    }
    prev = box;
    await nextFrame(page);
  }
  throw new Error(
    `${SELECTOR} bbox did not stabilize within ${MAX_FRAMES} frames (last=${JSON.stringify(prev)})`,
  );
}

for (const scenario of freeze.stage.scenarios as Scenario[]) {
  const label = `canvas-freeze ${scenario.viewport.w}x${scenario.viewport.h} ${scenario.preset}`;
  test(label, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: scenario.viewport.w, height: scenario.viewport.h },
      locale: 'ja-JP',
    });
    const page = await ctx.newPage();
    await page.goto('/');
    if (scenario.preset === 'portrait') {
      await openSection(page, 'space');
      // Must exist exactly once in every supported viewport; no silent skip.
      const portraitBtn = page.getByRole('button', { name: /縦長/ });
      await expect(portraitBtn).toHaveCount(1);
      await portraitBtn.click();
      // Store-rooted click acknowledgement: Toolbar binds aria-pressed to canvasPreset.
      await expect(portraitBtn).toHaveAttribute('aria-pressed', 'true');
      // Document-size check: once the preset switch has propagated through the fit math, the
      // Stage container's own aspect ratio must flip from landscape (w/h > 1) to portrait
      // (w/h < 1). This asserts the document actually resized, not just that the button toggled.
      await expect
        .poll(async () => {
          const box = await page.locator(SELECTOR).boundingBox();
          return box ? box.width / box.height : null;
        })
        .toBeLessThan(1);
    }
    // Load a photo so the Stage renders at its full fitted box (nophoto still renders the
    // Stage, but with the shell's status-area/hint area layout the position is the same —
    // the baseline table was recorded with a photo for parity with the L1 photo variant).
    await addSpaceBackground(page, {
      width: scenario.preset === 'landscape' ? 1920 : 1080,
      height: scenario.preset === 'landscape' ? 1080 : 1920,
    });
    // Wait for the bbox to converge on two consecutive frames (ResizeObserver + fit calc +
    // photo decode can all shift the layout by one frame each; the 2-frame-stable rule
    // guards against reading mid-settle).
    const stage = page.locator(SELECTOR);
    await stage.waitFor();
    const actual = await waitForStableBbox(page, stage);
    const log = `${label} actual={x=${actual.x.toFixed(2)},y=${actual.y.toFixed(2)},w=${actual.width.toFixed(2)},h=${actual.height.toFixed(2)}} expected={x=${scenario.x},y=${scenario.y},w=${scenario.width},h=${scenario.height}}`;
    console.log(log);
    expect(Math.abs(actual.x - scenario.x), `${label} Stage.x drift`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(Math.abs(actual.y - scenario.y), `${label} Stage.y drift`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(
      Math.abs(actual.width - scenario.width),
      `${label} Stage.width drift`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      Math.abs(actual.height - scenario.height),
      `${label} Stage.height drift`,
    ).toBeLessThanOrEqual(TOLERANCE);
    await ctx.close();
  });
}
