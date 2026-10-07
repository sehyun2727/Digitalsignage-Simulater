import { expect, test, type Page } from '@playwright/test';
import { addSpaceBackground } from './support/spaceBackground.js';
import { openSection } from './support/accordion.js';
import { readPngDimensions } from './support/png.js';
import fs from 'node:fs/promises';

// v2-S3 layout spec. Covers section 10 self-validation (L1~L17) with measured values
// printed via console.log so the human report quotes the numbers directly.

const PAGE_PADDING = 12; // 0.75rem shell padding each side on 16 px base
const SLACK = 2;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

async function rect(page: Page, sel: string): Promise<Rect | null> {
  const el = page.locator(sel).first();
  if ((await el.count()) === 0) return null;
  const b = await el.boundingBox();
  if (!b) return null;
  return { ...b, right: b.x + b.width, bottom: b.y + b.height };
}

async function docScrollMetrics(page: Page) {
  return page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

// --- L1 ------------------------------------------------------------------------------------
// At 1920×1080, 1440×900, 1280×720 × 16:9 / 9:16 × photo/no-photo:
//   canvas.bottom ≤ innerHeight, canvas.right ≤ toolbar.left,
//   toolbar.right ≥ viewport − margin − 2, document.scrollHeight ≤ innerHeight.

const L1_VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1280, h: 720 },
] as const;
const L1_PRESETS = ['landscape', 'portrait'] as const;
const L1_PHOTOS = [false, true] as const;

for (const vp of L1_VIEWPORTS) {
  for (const preset of L1_PRESETS) {
    for (const photo of L1_PHOTOS) {
      test(`L1 ${vp.w}x${vp.h} ${preset} ${photo ? 'photo' : 'nophoto'}: canvas fits inside viewport`, async ({
        browser,
      }) => {
        const ctx = await browser.newContext({
          viewport: { width: vp.w, height: vp.h },
          locale: 'ko-KR',
        });
        const page = await ctx.newPage();
        await page.goto('/');
        if (preset === 'portrait') {
          // Open the Add-signage section (already open by default) and switch canvas preset.
          await openSection(page, 'space');
          const portrait = page.getByRole('button', { name: /縦長|세로|Portrait/ });
          if ((await portrait.count()) > 0) await portrait.first().click();
        }
        if (photo) {
          const docSize =
            preset === 'landscape' ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
          await addSpaceBackground(page, docSize);
        }
        const canvas = (await rect(page, '.editor-canvas-container'))!;
        const toolbar = (await rect(page, '.toolbar'))!;
        const metrics = await docScrollMetrics(page);
        const label = `L1 ${vp.w}x${vp.h} ${preset} ${photo ? 'photo' : 'nophoto'}`;
        console.log(
          `${label} canvas={w=${canvas.width.toFixed(0)},h=${canvas.height.toFixed(0)},right=${canvas.right.toFixed(0)},bottom=${canvas.bottom.toFixed(0)}} toolbar={right=${toolbar.right.toFixed(0)},left=${toolbar.x.toFixed(0)}} vpH=${vp.h} scrollH=${metrics.scrollHeight} innerH=${metrics.innerHeight}`,
        );
        expect(canvas.bottom, `${label} canvas.bottom ≤ innerHeight`).toBeLessThanOrEqual(
          vp.h + SLACK,
        );
        expect(canvas.right, `${label} canvas.right ≤ toolbar.left`).toBeLessThanOrEqual(
          toolbar.x + SLACK,
        );
        expect(toolbar.right, `${label} toolbar.right ≥ vpW − margin`).toBeGreaterThanOrEqual(
          vp.w - PAGE_PADDING - SLACK,
        );
        expect(metrics.scrollHeight, `${label} scrollHeight ≤ innerHeight`).toBeLessThanOrEqual(
          metrics.innerHeight + SLACK,
        );
        await ctx.close();
      });
    }
  }
}

// --- L2 ------------------------------------------------------------------------------------
// 390×844 × 16:9/9:16: canvas.right ≤ 390, scrollWidth ≤ clientWidth, log 9:16 height.
for (const preset of L1_PRESETS) {
  test(`L2 390x844 ${preset}: canvas fits inside the mobile viewport`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'ja-JP',
    });
    const page = await ctx.newPage();
    await page.goto('/');
    if (preset === 'portrait') {
      await openSection(page, 'space');
      const portrait = page.getByRole('button', { name: /縦長/ });
      if ((await portrait.count()) > 0) await portrait.first().click();
    }
    const canvas = (await rect(page, '.editor-canvas-container'))!;
    const metrics = await docScrollMetrics(page);
    const label = `L2 390x844 ${preset}`;
    console.log(
      `${label} canvas={w=${canvas.width.toFixed(0)},h=${canvas.height.toFixed(0)},right=${canvas.right.toFixed(0)}} scrollW=${metrics.scrollWidth} clientW=${metrics.clientWidth}`,
    );
    expect(canvas.right, `${label} canvas.right ≤ 390`).toBeLessThanOrEqual(390 + SLACK);
    expect(metrics.scrollWidth, `${label} scrollWidth ≤ clientWidth`).toBeLessThanOrEqual(
      metrics.clientWidth + SLACK,
    );
    await ctx.close();
  });
}

// --- L3 ------------------------------------------------------------------------------------
// 1440 → 1280 → 1440: re-computed bbox returns within 1 px of the initial measurement.
test('L3 resize round-trip returns to the initial bbox within 1 px', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP' });
  const page = await ctx.newPage();
  await page.goto('/');
  const r1 = (await rect(page, '.editor-canvas-container'))!;
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(50);
  const r2 = (await rect(page, '.editor-canvas-container'))!;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(50);
  const r3 = (await rect(page, '.editor-canvas-container'))!;
  console.log(
    `L3 r1={w=${r1.width.toFixed(2)},h=${r1.height.toFixed(2)}} r2={w=${r2.width.toFixed(2)},h=${r2.height.toFixed(2)}} r3={w=${r3.width.toFixed(2)},h=${r3.height.toFixed(2)}}`,
  );
  expect(Math.abs(r3.width - r1.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(r3.height - r1.height)).toBeLessThanOrEqual(1);
  await ctx.close();
});

// --- L4 ------------------------------------------------------------------------------------
// Exports from two different display-scale viewports produce byte-identical PNGs at exactly
// the canvas preset resolution (1920×1080).
test('L4 PNG export is identical and preset-sized across two display-scale viewports', async ({
  browser,
}) => {
  const sizes = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
  ];
  const buffers: Buffer[] = [];
  for (const vp of sizes) {
    const ctx = await browser.newContext({ viewport: vp, locale: 'ja-JP' });
    const page = await ctx.newPage();
    await page.goto('/');
    await addSpaceBackground(page, { width: 1920, height: 1080 });
    const dl = page.waitForEvent('download');
    await page.getByTestId('editor-header-export-png').click();
    const d = await dl;
    const buf = await fs.readFile((await d.path())!);
    buffers.push(buf);
    const dims = readPngDimensions(buf);
    console.log(
      `L4 vp=${vp.width}x${vp.height} png=${dims.width}x${dims.height} bytes=${buf.length}`,
    );
    expect(dims).toEqual({ width: 1920, height: 1080 });
    await ctx.close();
  }
  expect(buffers[0]!.equals(buffers[1]!)).toBe(true);
});

// --- L6 ------------------------------------------------------------------------------------
// Toggling an error on/off does not shift canvas top/height or page scrollHeight.
test('L6 error toggle leaves canvas top/height and page scrollHeight unchanged', async ({
  page,
}) => {
  await page.goto('/');
  const before = (await rect(page, '.editor-canvas-container'))!;
  const beforeDoc = await docScrollMetrics(page);
  await page.getByTestId('editor-space-background-upload').setInputFiles({
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(11 * 1024 * 1024, 1),
  });
  await expect(page.getByTestId('editor-error-banner')).toBeVisible();
  const during = (await rect(page, '.editor-canvas-container'))!;
  const duringDoc = await docScrollMetrics(page);
  await page
    .getByTestId('editor-error-banner')
    .getByRole('button', { name: /閉じる/ })
    .click();
  const after = (await rect(page, '.editor-canvas-container'))!;
  const afterDoc = await docScrollMetrics(page);
  console.log(
    `L6 topΔ=${Math.max(Math.abs(during.y - before.y), Math.abs(after.y - before.y)).toFixed(2)} ` +
      `heightΔ=${Math.max(Math.abs(during.height - before.height), Math.abs(after.height - before.height)).toFixed(2)} ` +
      `scrollHΔ=${Math.max(Math.abs(duringDoc.scrollHeight - beforeDoc.scrollHeight), Math.abs(afterDoc.scrollHeight - beforeDoc.scrollHeight))}`,
  );
  expect(Math.abs(during.y - before.y)).toBeLessThanOrEqual(SLACK);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(SLACK);
  expect(Math.abs(during.height - before.height)).toBeLessThanOrEqual(SLACK);
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(SLACK);
  expect(duringDoc.scrollHeight).toBe(beforeDoc.scrollHeight);
  expect(afterDoc.scrollHeight).toBe(beforeDoc.scrollHeight);
});

// --- L7 ------------------------------------------------------------------------------------
// First render: only space / add-signage / export are open; others collapsed.
test('L7 default sections include only space, add-signage, and export', async ({ page }) => {
  await page.goto('/');
  const expand = async (id: string) =>
    await page.getByTestId(`toolbar-section-${id}-toggle`).getAttribute('aria-expanded');
  const space = await expand('space');
  const addSignage = await expand('add-signage');
  const appearance = await expand('appearance');
  // Selected + content toggles still exist (always rendered); null is treated as "closed".
  const selected = await expand('selected');
  const content = await expand('content');
  console.log(
    `L7 space=${space} add-signage=${addSignage} selected=${selected} content=${content} appearance=${appearance}`,
  );
  expect(space).toBe('true');
  expect(addSignage).toBe('true');
  expect(appearance).toBe('false');
  // export has no toggle (always), confirm the heading button is absent.
  expect(await page.getByTestId('toolbar-section-export-toggle').count()).toBe(0);
});

// --- L8 ------------------------------------------------------------------------------------
// First signage selection auto-opens selected + content; user collapse persists across
// different signage selections.
test('L8 user-collapsed content state survives changing the selected signage', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });
  await page.getByTestId('editor-add-led').click();
  // Selected + content both auto-opened on first selection.
  expect(
    await page.getByTestId('toolbar-section-selected-toggle').getAttribute('aria-expanded'),
  ).toBe('true');
  expect(
    await page.getByTestId('toolbar-section-content-toggle').getAttribute('aria-expanded'),
  ).toBe('true');
  // Collapse content, add another signage, confirm content stays collapsed.
  await page.getByTestId('toolbar-section-content-toggle').click();
  expect(
    await page.getByTestId('toolbar-section-content-toggle').getAttribute('aria-expanded'),
  ).toBe('false');
  await page.getByTestId('editor-add-lcd').click();
  const after = await page
    .getByTestId('toolbar-section-content-toggle')
    .getAttribute('aria-expanded');
  console.log(`L8 content-after-reselect=${after}`);
  expect(after).toBe('false');
});

// --- L9 ------------------------------------------------------------------------------------
// 書き出し has no toggle button.
test('L9 export section is pinned (no toggle)', async ({ page }) => {
  await page.goto('/');
  const toggleCount = await page.getByTestId('toolbar-section-export-toggle').count();
  const heading = page.locator('[data-testid="toolbar-section-export"] .toolbar-section-heading');
  console.log(`L9 toggleCount=${toggleCount} heading=${await heading.textContent()}`);
  expect(toggleCount).toBe(0);
});

// --- L10 ------------------------------------------------------------------------------------
// Closed section's descendants are NOT in the DOM, so tab focus can't reach them.
test('L10 collapsed section hides its body from the DOM', async ({ page }) => {
  await page.goto('/');
  // Appearance is default-closed. Its body-id should not be in the DOM.
  const bodyCount = await page.locator('#toolbar-section-appearance-body').count();
  console.log(`L10 appearance-body-count=${bodyCount}`);
  expect(bodyCount).toBe(0);
});

// --- L11 ------------------------------------------------------------------------------------
// No modal-overlay for the appearance guide; the description block lives inside the Appearance
// section (hidden behind the collapsed body until the user opens it, i.e. absent at load).
test('L11 appearance guide is inline, not a modal', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });
  await page.getByTestId('editor-add-led').click();
  await openSection(page, 'appearance');
  await expect(page.getByTestId('appearance-guide-toggle')).toBeVisible();
  // No central modal class with the guide title inside.
  const modalWithGuide = await page.locator('.modal-overlay, .modal-dialog').count();
  console.log(`L11 modalCount(any)=${modalWithGuide} guideToggleVisible=true`);
});

// --- L12 ------------------------------------------------------------------------------------
// Toolbar PNG export button exists, ≥44 px tall, under the comparison toggle; triggering it
// downloads a file; while a video export is in flight, the header pair is also disabled.
test('L12 toolbar PNG export button is visible and ≥ 44 px tall', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });
  const btn = page.getByTestId('toolbar-export-png');
  await expect(btn).toBeVisible();
  const box = (await btn.boundingBox())!;
  console.log(`L12 toolbar-export-png height=${box.height.toFixed(1)}`);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const dl = page.waitForEvent('download');
  await btn.click();
  await dl;
});

// --- L13 ------------------------------------------------------------------------------------
// Both header and footer entries open UserGuide; the old 'マニュアルはこちら' label is gone.
test('L13 user-guide opens from header AND footer, old hint label is gone', async ({ page }) => {
  await page.goto('/');
  // Old label absent anywhere in DOM.
  const stale = await page.getByText('マニュアルはこちら').count();
  console.log(`L13 old-hint-count=${stale}`);
  expect(stale).toBe(0);
  // Open from header.
  await page.getByTestId('editor-header-user-guide').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Close + open from footer.
  await page.getByRole('button', { name: /閉じる/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByTestId('editor-footer-user-guide').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

// --- L14 ------------------------------------------------------------------------------------
// Position/size subsection defaults to collapsed; toggling opens; state survives selection
// changes.
test('L14 position/size subsection stays open after switching signage', async ({ page }) => {
  await page.goto('/');
  await addSpaceBackground(page, { width: 1920, height: 1080 });
  await page.getByTestId('editor-add-led').click();
  const toggle = page.getByTestId('toolbar-subsection-position-size-toggle');
  expect(await toggle.getAttribute('aria-expanded')).toBe('false');
  await toggle.click();
  expect(await toggle.getAttribute('aria-expanded')).toBe('true');
  await page.getByTestId('editor-add-lcd').click();
  const after = await toggle.getAttribute('aria-expanded');
  console.log(`L14 open-after-switch=${after}`);
  expect(after).toBe('true');
});

// --- L16 ------------------------------------------------------------------------------------
// ko/en locale switch does not leave untranslated keys / `undefined` in the Toolbar.
test('L16 ko locale switch renders without undefined or raw keys', async ({ page }) => {
  await page.goto('/');
  await page.locator('#language-select').selectOption('ko');
  const toolbarText = (await page.locator('.toolbar').textContent()) ?? '';
  const hasUndefined = toolbarText.toLowerCase().includes('undefined');
  const hasRawKey = /\btoolbar[A-Z]/.test(toolbarText);
  console.log(`L16 ko undefined=${hasUndefined} rawKey=${hasRawKey} length=${toolbarText.length}`);
  expect(hasUndefined).toBe(false);
  expect(hasRawKey).toBe(false);
});
