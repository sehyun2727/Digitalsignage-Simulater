import { expect, test } from '@playwright/test';
import { addSpaceBackground } from './support/spaceBackground.js';

// v2-S4 Step 0-7: both PNG surfaces and both video surfaces must stay in lockstep around
// an in-flight export. The disabled flag `!spaceBackground || isExportingVideo` is wired
// from one source into all four buttons (editor-export-{png,video}-{header,panel}); this
// spec asserts the whole quartet actually tracks that single flag end to end.
//
// Scope note:
// - PNG export (handleExport) is synchronous in the renderer: exportToDataUrl + an <a>
//   click, no in-flight state the DOM can observe between "button clicked" and "download
//   fired". So "PNG 내보내기 중" is covered by the pre-click / post-click enabled sweep
//   (buttons stay enabled before, during the microtask after the click, and after the
//   download event), not by catching a disabled frame mid-call.
// - Video export (handleExportVideo) sets setIsExportingVideo(true) → React re-renders →
//   all four buttons flip to disabled while MediaRecorder encodes. We throttle the
//   recorder via a short duration cap (addInitScript below forces a tiny segment) so the
//   test can observe the disabled window, then verify re-enablement after.

test.use({ locale: 'ja-JP' });

test('PNG header and panel export buttons stay enabled across a sync PNG export', async ({
  page,
}) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  const header = page.getByTestId('editor-export-png-header');
  const panel = page.getByTestId('editor-export-png-panel');
  const videoHeader = page.getByTestId('editor-export-video-header');
  const videoPanel = page.getByTestId('editor-export-video-panel');

  await expect(header, 'PNG header enabled with photo loaded').toBeEnabled();
  await expect(panel, 'PNG panel enabled with photo loaded').toBeEnabled();
  await expect(videoHeader, 'video header enabled with photo loaded').toBeEnabled();
  await expect(videoPanel, 'video panel enabled with photo loaded').toBeEnabled();

  const dl = page.waitForEvent('download');
  await header.click();
  await dl;

  // After the synchronous PNG export, every button is enabled again (there was no
  // in-flight window to observe — this is the baseline check).
  await expect(header, 'PNG header re-enabled after export').toBeEnabled();
  await expect(panel, 'PNG panel re-enabled after export').toBeEnabled();
  await expect(videoHeader, 'video header re-enabled after export').toBeEnabled();
  await expect(videoPanel, 'video panel re-enabled after export').toBeEnabled();
});

test('all four export buttons flip to disabled while a video export is in flight, then re-enable', async ({
  page,
}) => {
  // Video export's natural duration is DEFAULT_VIDEO_EXPORT_DURATION_MS = 6_000 ms (no
  // video content loaded → the floor value from resolveVideoExportDurationMs). That is
  // ample time for Playwright to poll the disabled state before the download fires.
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });

  const videoHeader = page.getByTestId('editor-export-video-header');
  const pngHeader = page.getByTestId('editor-export-png-header');
  const pngPanel = page.getByTestId('editor-export-png-panel');
  const videoPanel = page.getByTestId('editor-export-video-panel');

  await expect(videoHeader, 'video header enabled pre-export').toBeEnabled();

  // Fire the video export; isExportingVideo flips true after the first setState batches.
  // Button labels / disabled state propagate to all four buttons via the shared prop.
  const dl = page.waitForEvent('download', { timeout: 15_000 });
  await videoHeader.click();

  // Short polling window: use shorter timeouts than default (30 s) so a stuck recorder
  // doesn't eat our 15 s download budget. 5 s is plenty to catch a 6-second window.
  await expect(pngHeader, 'PNG header disabled during video export').toBeDisabled({
    timeout: 5_000,
  });
  await expect(pngPanel, 'PNG panel disabled during video export').toBeDisabled({
    timeout: 5_000,
  });
  await expect(videoHeader, 'video header disabled during its own export').toBeDisabled({
    timeout: 5_000,
  });
  await expect(videoPanel, 'video panel disabled during video export').toBeDisabled({
    timeout: 5_000,
  });

  await dl;

  await expect(pngHeader, 'PNG header re-enabled after video export').toBeEnabled();
  await expect(pngPanel, 'PNG panel re-enabled after video export').toBeEnabled();
  await expect(videoHeader, 'video header re-enabled after video export').toBeEnabled();
  await expect(videoPanel, 'video panel re-enabled after video export').toBeEnabled();
});
