import type { Locator, Page } from '@playwright/test';

/** Awaits one browser animation frame. Replaces magic-number waitForTimeout — the Konva
 *  Stage's ResizeObserver fires on the next frame after a layout change, so a single rAF
 *  yields the settled bbox far more reliably than a fixed sleep (and finishes instantly in CI). */
export async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

/** Awaits `count` consecutive animation frames. Useful when a Konva-rendered node needs a
 *  couple of extra frames beyond the DOM container settling before pointer events bind to
 *  the right draggable target — the Transformer attach + draggable=true pass happens on a
 *  tick after React's commit, so the first frame after `expect(selectedLabel).toBeVisible()`
 *  is often one frame too early for a mouse.down to land on the Konva Node. */
export async function waitFrames(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) await nextFrame(page);
}

/** Polls `locator.boundingBox()` once per animation frame until two consecutive reads match
 *  within 0.01 CSS px on every edge, then returns that bbox. Guards against mid-layout reads:
 *  callers (canvas-freeze, L5) read bbox-derived numbers before dispatching pointer events —
 *  any transient layout shift between the measurement and the dispatch moves the target out
 *  from under the cursor and manifests as a flaky off-by-one in the asserted store value. */
export async function waitForStableBbox(
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
    `bbox did not stabilize within ${MAX_FRAMES} frames (last=${JSON.stringify(prev)})`,
  );
}
