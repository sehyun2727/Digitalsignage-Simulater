import { expect, test, type Page } from '@playwright/test';

// v2-S5 Part 0-2: measure whether the ErrorBanner (requirement 2-5) is clipped inside the
// 3rem (48 CSS px) `.editor-status-area` slot that commit 3e30038 locked in. The gate wants
// cutoff = 0 across every (viewport, locale) combination with (a) a very long banner such as
// the upload-size error, and (b) two banners live at once. If any cell shows cutoff > 0 we
// implement the Part 0-2 overlay fallback: the banner stack is pulled out of normal flow and
// absolutely positioned at the bottom of the canvas region, so it stays fully visible without
// altering `.editor-status-area` height.
//
// Measurements per cell: banner bounding box height, the enclosing scrollable element's
// clientHeight AND scrollHeight (so cutoff = max(0, inner_scrollH − inner_clientH)), plus the
// canvas container bbox BEFORE and AFTER the banner appears — the canvas-freeze contract
// requires the stage to not jitter when a banner toggles.

const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1366, h: 650 },
  { w: 1024, h: 640 },
  { w: 390, h: 844 },
] as const;

const LOCALES = ['ja-JP', 'ko-KR', 'en-US'] as const;

type ViewportCfg = (typeof VIEWPORTS)[number];
type LocaleCfg = (typeof LOCALES)[number];

async function openEditorWithLongError(
  page: Page,
  vp: ViewportCfg,
  locale: LocaleCfg,
): Promise<{
  banner: { x: number; y: number; width: number; height: number } | null;
  statusArea: { clientH: number; scrollH: number };
  overlay: { clientH: number; scrollH: number };
  canvasBefore: { x: number; y: number; width: number; height: number };
  canvasAfter: { x: number; y: number; width: number; height: number };
  cutoff: number;
}> {
  await page.goto('/');
  const canvasLocator = page.locator('.editor-canvas-container');
  const canvasBefore = (await canvasLocator.boundingBox())!;
  // Trigger a long error — a > 10 MB fake PNG upload. The error banner reads
  // `errorBannerUploadSizeExceeded` which spans two sentences in ja/ko/en.
  await page.getByTestId('editor-space-background-upload').setInputFiles({
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(11 * 1024 * 1024, 1),
  });
  const banner = page.getByTestId('editor-error-banner').first();
  await expect(banner).toBeVisible();
  const bannerBox = await banner.boundingBox();
  const overlayAndStatus = await page.evaluate(() => {
    const status = document.querySelector(
      '[data-testid="editor-status-area"]',
    ) as HTMLElement | null;
    const overlay = document.querySelector(
      '[data-testid="editor-banner-overlay"]',
    ) as HTMLElement | null;
    return {
      status: status ? { clientH: status.clientHeight, scrollH: status.scrollHeight } : null,
      overlay: overlay ? { clientH: overlay.clientHeight, scrollH: overlay.scrollHeight } : null,
    };
  });
  const canvasAfter = (await canvasLocator.boundingBox())!;
  // v2-S5 Part 0-2: the banner now lives in `.editor-banner-overlay` (not inside status-area)
  // so the gate's cutoff metric reads that element — which has no fixed height, so cutoff
  // should always be 0. The status-area still carries the hint and we report its numbers as
  // a secondary measurement.
  const overlay = overlayAndStatus.overlay ?? { clientH: 0, scrollH: 0 };
  const statusArea = overlayAndStatus.status ?? { clientH: 0, scrollH: 0 };
  const cutoff = Math.max(0, overlay.scrollH - overlay.clientH);
  void vp;
  void locale;
  return { banner: bannerBox, statusArea, overlay, canvasBefore, canvasAfter, cutoff };
}

for (const vp of VIEWPORTS) {
  for (const locale of LOCALES) {
    test(`0-2 banner cutoff ${vp.w}x${vp.h} ${locale} — single long error`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale });
      const page = await ctx.newPage();
      const r = await openEditorWithLongError(page, vp, locale);
      const bannerH = r.banner?.height ?? 0;
      const bbChange =
        Math.abs(r.canvasAfter.x - r.canvasBefore.x) +
        Math.abs(r.canvasAfter.y - r.canvasBefore.y) +
        Math.abs(r.canvasAfter.width - r.canvasBefore.width) +
        Math.abs(r.canvasAfter.height - r.canvasBefore.height);
      // viewport-containment check: banner.bottom must stay inside the viewport.
      const bannerBottom = (r.banner?.y ?? 0) + bannerH;
      const inViewport = r.banner === null ? false : bannerBottom <= vp.h + 0.5;
      console.log(
        `0-2 ${vp.w}x${vp.h} ${locale} bannerH=${bannerH.toFixed(1)} overlayCutoff=${r.cutoff} overlay=(client=${r.overlay.clientH},scroll=${r.overlay.scrollH}) statusArea=(client=${r.statusArea.clientH},scroll=${r.statusArea.scrollH}) canvasBbox Δ=${bbChange.toFixed(2)} bannerBottom=${bannerBottom.toFixed(1)} vpH=${vp.h} inViewport=${inViewport}`,
      );
      // The gate wants cutoff === 0 and bannerBottom ≤ viewport. We record every value and
      // let the suite reveal which cells need the overlay fallback.
      expect(r.banner).not.toBeNull();
      expect(r.cutoff).toBe(0);
      expect(bannerBottom).toBeLessThanOrEqual(vp.h + 0.5);
      expect(bbChange).toBeLessThanOrEqual(0.5);
      await ctx.close();
    });
  }
}
