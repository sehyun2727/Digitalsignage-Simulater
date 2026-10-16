import { expect, type Locator, type Page } from '@playwright/test';

/**
 * v2-S3 D-5 helper: capture a PNG export on a mobile iOS-emulated viewport. The desktop test
 * suite reads exports via `page.waitForEvent('download')`, but on an iPhone userAgent the app
 * takes the iOS-safe fallback path (`EditorLayout.handleExport` — see the `isIos` branch): it
 * calls `window.open(dataUrl, '_blank')` instead of synthesising an `<a download>` click, so
 * no DOM Download event ever fires. Rather than keep both paths test-visible, we install a
 * per-page interceptor on `window.open` that records the data URL into a known key, and read
 * it back out after the export click.
 *
 * Call `installMobileExportCapture(page)` once per Page (right after `page.goto('/')`), then
 * use `clickExportAndCapturePng(page, button)` wherever the desktop suite would await a
 * download event.
 */
export async function installMobileExportCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalOpen = window.open.bind(window);
    (window as unknown as { __mobileExportDataUrl?: string }).__mobileExportDataUrl = undefined;
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      if (typeof url === 'string' && url.startsWith('data:image/')) {
        (window as unknown as { __mobileExportDataUrl?: string }).__mobileExportDataUrl = url;
        // Return a non-null stub so handleExport's `if (!opened)` fallback does not try the
        // extra `<a>` click path on top of the capture; the test only cares that export
        // completed and produced a PNG the mobile user would have landed on.
        return {} as Window;
      }
      return originalOpen(url as string, target, features);
    }) as typeof window.open;
  });
}

export async function clickExportAndCapturePng(page: Page, button: Locator): Promise<Buffer> {
  // Reset the capture slot so a stale value from a prior export in the same test doesn't leak.
  await page.evaluate(() => {
    (window as unknown as { __mobileExportDataUrl?: string }).__mobileExportDataUrl = undefined;
  });
  await button.click();
  // Poll until handleExport finishes synchronously (it does — exportToDataUrl is sync and
  // window.open is invoked right after); a short waitForFunction keeps this resilient to any
  // React scheduling that might defer the click handler by a frame.
  await page.waitForFunction(
    () => (window as unknown as { __mobileExportDataUrl?: string }).__mobileExportDataUrl != null,
    null,
    { timeout: 10000 },
  );
  const dataUrl = await page.evaluate(
    () => (window as unknown as { __mobileExportDataUrl?: string }).__mobileExportDataUrl!,
  );
  expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  const base64 = dataUrl.split(',', 2)[1]!;
  return Buffer.from(base64, 'base64');
}
