import { expect, test, type Page } from '@playwright/test';
import { addSpaceBackground } from './support/spaceBackground.js';

// v2-S2 보완 Step 0-1: layout guard. The S2 refactor wrapped the canvas and the new status
// area under a `.editor-canvas-column` <div> but shipped no matching CSS, so under the parent
// `.editor-workspace { display: flex }` layout the column shrunk to its content width and the
// toolbar floated into the middle of the viewport instead of pinning to the right edge. This
// spec runs under four viewport × photo-presence conditions and asserts the toolbar reaches
// the right page edge AND the canvas column fills the remaining width, with and without an
// error banner showing. The 보고서 captures the exact bbox values each run prints.

const PAGE_PADDING = 32; // 1rem padding each side on the editor shell (CSS: padding: 1rem 2rem)
const WORKSPACE_GAP = 16; // 1rem gap between canvas column and toolbar (CSS: .editor-workspace gap)
const SLACK = 2; // one-pixel subpixel rounding tolerance per boundary

interface LayoutMetrics {
  viewport: { width: number; height: number };
  shell: DOMRect;
  canvasColumn: DOMRect;
  canvasContainer: DOMRect;
  toolbar: DOMRect;
  statusArea: DOMRect | null;
}

interface DOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

async function measure(page: Page): Promise<LayoutMetrics> {
  const vp = page.viewportSize()!;
  const asRect = async (sel: string): Promise<DOMRect | null> => {
    const el = page.locator(sel).first();
    if ((await el.count()) === 0) return null;
    const b = await el.boundingBox();
    if (!b) return null;
    return { ...b, right: b.x + b.width, bottom: b.y + b.height };
  };
  const shell = (await asRect('.editor-layout'))!;
  const canvasColumn = (await asRect('.editor-canvas-column'))!;
  const canvasContainer = (await asRect('.editor-canvas-container'))!;
  const toolbar = (await asRect('.toolbar'))!;
  const statusArea = await asRect('[data-testid="editor-status-area"]');
  return { viewport: vp, shell, canvasColumn, canvasContainer, toolbar, statusArea };
}

function logMetrics(label: string, m: LayoutMetrics) {
  const fmt = (r: DOMRect) =>
    `x=${r.x.toFixed(0)},y=${r.y.toFixed(0)},w=${r.width.toFixed(0)},h=${r.height.toFixed(0)},right=${r.right.toFixed(0)}`;

  console.log(
    `${label} vp=${m.viewport.width}x${m.viewport.height} column={${fmt(m.canvasColumn)}} container={${fmt(m.canvasContainer)}} toolbar={${fmt(m.toolbar)}}`,
  );
}

function assertLayout(m: LayoutMetrics, label: string) {
  // Toolbar must pin to the right edge of the page shell. The shell has 2rem (32 px) horizontal
  // padding, so the toolbar's right edge should match the shell's right edge − shell padding.
  const expectedToolbarRight = m.shell.right - 0; // toolbar sits inside shell content box
  expect(m.toolbar.right, `${label}: toolbar.right`).toBeGreaterThanOrEqual(
    expectedToolbarRight - SLACK,
  );

  // Canvas column must fill the remaining width (viewport − shell left pad − gap − toolbar).
  const availableColumnWidth =
    m.viewport.width - PAGE_PADDING - WORKSPACE_GAP - m.toolbar.width - PAGE_PADDING;
  expect(m.canvasColumn.width, `${label}: canvasColumn.width`).toBeGreaterThanOrEqual(
    availableColumnWidth - SLACK * 2,
  );

  // Canvas container inherits from the column.
  expect(m.canvasContainer.width, `${label}: canvasContainer.width`).toBeGreaterThanOrEqual(
    availableColumnWidth - SLACK * 4,
  );

  // Status area never overlaps the canvas container (W6 condition).
  if (m.statusArea) {
    expect(m.statusArea.y, `${label}: statusArea.y vs canvas.bottom`).toBeGreaterThanOrEqual(
      m.canvasContainer.bottom - 1,
    );
  }
}

async function openWithoutPhoto(page: Page) {
  await page.goto('/');
}
async function openWithPhoto(page: Page, size: { width: number; height: number }) {
  await page.goto('/');
  await addSpaceBackground(page, size);
}

const CONDS = [
  { vp: { width: 1920, height: 1080 }, photo: false, label: '1920x1080-nophoto' },
  { vp: { width: 1920, height: 1080 }, photo: true, label: '1920x1080-photo' },
  { vp: { width: 1440, height: 900 }, photo: false, label: '1440x900-nophoto' },
  { vp: { width: 1440, height: 900 }, photo: true, label: '1440x900-photo' },
] as const;

for (const cond of CONDS) {
  test(`L1 ${cond.label}: toolbar pins to right, canvas column fills the rest`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: cond.vp, locale: 'ko-KR' });
    const page = await ctx.newPage();
    if (cond.photo) await openWithPhoto(page, { width: 1920, height: 1080 });
    else await openWithoutPhoto(page);
    const m = await measure(page);
    logMetrics(`L1 ${cond.label}`, m);
    assertLayout(m, `L1 ${cond.label}`);
    await ctx.close();
  });
}

test('L2 error banner visible: layout still fills the viewport (1920x1080)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'ja-JP',
  });
  const page = await ctx.newPage();
  await page.goto('/');
  // Trigger a space-photo error so the banner is visible.
  await page.getByTestId('editor-space-background-upload').setInputFiles({
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(11 * 1024 * 1024, 1),
  });
  await expect(page.getByTestId('editor-error-banner')).toBeVisible();
  const m = await measure(page);
  logMetrics('L2 banner-visible', m);
  assertLayout(m, 'L2 banner-visible');
  await ctx.close();
});
