/**
 * Representative screenshots per master ID.
 *
 * 요구: docs/v2/audit/img/{ID}.png 를 ja + 1920×1080 뷰포트로 캡처. D2/D3/D4/D7 은
 * ko/en 도 함께 캡처한다.
 *
 * 이 스펙은 측정 테스트가 아니라 **문서용 이미지 생성** 테스트다. 어서션은 캡처한 PNG 가
 * 존재+크기 >0 임을 확인하는 수준으로만 한다.
 */
import { test, expect, type Page } from '@playwright/test';
import { openAppJa, addSpaceBg, expandSection, expandPositionSize } from './_shared.js';
import { solidColorPng } from '../support/spaceBackground.js';

const DOCS_IMG_DIR = 'docs/v2/audit/img';

async function switchLocale(page: Page, locale: 'ja' | 'ko' | 'en'): Promise<void> {
  if (locale === 'ja') return;
  await page.locator('#language-select').selectOption(locale);
}

async function fullCapture(page: Page, name: string): Promise<void> {
  const screenshotPath = `${DOCS_IMG_DIR}/${name}.png`;
  const buf = await page.screenshot({ path: screenshotPath, fullPage: false });
  expect(buf.byteLength).toBeGreaterThan(2000);
  console.log(`[screenshot] ${name} wrote ${buf.byteLength} bytes to ${screenshotPath}`);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
});

// 1-x
test('[screenshot] 1-1 copy/paste buttons visible (ja, LED selected)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await fullCapture(page, '1-1');
});

test('[screenshot] 1-2 aspect-lock toggle (ja, LED selected, position-size expanded)', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  const selected = page.getByRole('button', { name: /^選択中のサイネージ/ }).first();
  if ((await selected.getAttribute('aria-expanded')) === 'false') await selected.click();
  await expandPositionSize(page);
  await fullCapture(page, '1-2');
});

test('[screenshot] 1-3 Fit vs Cover segment (ja, space photo loaded)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page, { file: await solidColorPng(page, '#808080', 1600, 1200) });
  await fullCapture(page, '1-3');
});

// 2-x
test('[screenshot] 2-1 canvas fit (ja, default)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await fullCapture(page, '2-1');
});

test('[screenshot] 2-2 accordion panel (ja)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await fullCapture(page, '2-2');
});

test('[screenshot] 2-3 advanced settings inline (ja, appearance expanded)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);
  const advanced = page.getByRole('button', { name: /^詳細設定/ }).last();
  if ((await advanced.getAttribute('aria-expanded')) === 'false') await advanced.click();
  await fullCapture(page, '2-3');
});

test('[screenshot] 2-4 export panel (ja)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  // Scroll the panel so the export subsection is visible.
  const pngBtn = page.getByTestId('editor-export-png-panel');
  await pngBtn.scrollIntoViewIfNeeded();
  await fullCapture(page, '2-4');
});

test('[screenshot] 2-5 error banner (ja, 10MB over)', async ({ page }) => {
  await openAppJa(page);
  const big = Buffer.alloc(11 * 1024 * 1024, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(big, 0);
  await page.getByLabel('設置場所の写真を追加').setInputFiles({
    name: 'oversize.png',
    mimeType: 'image/png',
    buffer: big,
  });
  await page.getByRole('alert').first().waitFor({ state: 'visible' });
  await fullCapture(page, '2-5');
});

// 3-x
test('[screenshot] 3-1 position-size subsection (ja)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  const selected = page.getByRole('button', { name: /^選択中のサイネージ/ }).first();
  if ((await selected.getAttribute('aria-expanded')) === 'false') await selected.click();
  await expandPositionSize(page);
  await fullCapture(page, '3-1');
});

test('[screenshot] 3-2 upload hint (ja)', async ({ page }) => {
  await openAppJa(page);
  await fullCapture(page, '3-2');
});

test('[screenshot] 3-3 slider units + signed tint (ja)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);
  const advanced = page.getByRole('button', { name: /^詳細設定/ }).last();
  if ((await advanced.getAttribute('aria-expanded')) === 'false') await advanced.click();
  const shadowToggle = page.getByLabel('接地シャドウを有効にする');
  if ((await shadowToggle.getAttribute('aria-checked')) !== 'true') {
    await shadowToggle.check().catch(() => undefined);
  }
  // Nudge tint so sign shows positive.
  const tint = page.getByRole('slider', { name: '暖色・寒色トーン' });
  await tint.evaluate((el: HTMLInputElement) => {
    el.value = '25';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  });
  await fullCapture(page, '3-3');
});

test('[screenshot] 3-4 content scale % input (ja)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /画面コンテンツ/);
  const img = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300000002000149be5a2b0000000049454e44ae426082',
    'hex',
  );
  await page.getByLabel(/画像 \/ 動画を追加/).setInputFiles({
    name: 'c.png',
    mimeType: 'image/png',
    buffer: img,
  });
  const advanced = page.getByRole('button', { name: /^コンテンツの詳細設定/ }).first();
  if ((await advanced.getAttribute('aria-expanded')) === 'false') await advanced.click();
  await fullCapture(page, '3-4');
});

test('[screenshot] 3-5 mask inline flow (ja, 4 points placed, step indicator visible)', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);
  await page.getByTestId('editor-occlusion-add').click();
  const canvasRect = await page.locator('.editor-canvas-container').first().boundingBox();
  if (!canvasRect) throw new Error('no canvas');
  const pts = [
    { x: canvasRect.x + canvasRect.width * 0.35, y: canvasRect.y + canvasRect.height * 0.35 },
    { x: canvasRect.x + canvasRect.width * 0.65, y: canvasRect.y + canvasRect.height * 0.35 },
    { x: canvasRect.x + canvasRect.width * 0.65, y: canvasRect.y + canvasRect.height * 0.65 },
    { x: canvasRect.x + canvasRect.width * 0.35, y: canvasRect.y + canvasRect.height * 0.65 },
  ];
  for (const p of pts) await page.mouse.click(p.x, p.y);
  await fullCapture(page, '3-5');
});

// 4-x: ja + ko + en (D2/D3/D4 touch terminology/text).
// We upload the space photo in ja (addSpaceBg uses the ja label) BEFORE switching locale.
for (const locale of ['ja', 'ko', 'en'] as const) {
  test(`[screenshot] 4-1-4-2-4-3 appearance + onboarding (${locale})`, async ({ page }) => {
    await openAppJa(page);
    await addSpaceBg(page);
    await page.getByRole('button', { name: 'LED', exact: true }).click();
    await switchLocale(page, locale);
    const appearance = page
      .getByRole('button', { name: /サイネージ外観の調整|사이니지 외관 조정|Signage appearance/ })
      .first();
    if ((await appearance.getAttribute('aria-expanded')) === 'false') await appearance.click();
    await fullCapture(page, `4-${locale}`);
  });

  test(`[screenshot] D3 mask step indicator (${locale})`, async ({ page }) => {
    await openAppJa(page);
    await addSpaceBg(page);
    await page.getByRole('button', { name: 'LED', exact: true }).click();
    await switchLocale(page, locale);
    const appearance = page
      .getByRole('button', { name: /サイネージ外観の調整|사이니지 외관 조정|Signage appearance/ })
      .first();
    if ((await appearance.getAttribute('aria-expanded')) === 'false') await appearance.click();
    await page.getByTestId('editor-occlusion-add').click();
    const canvasRect = await page.locator('.editor-canvas-container').first().boundingBox();
    if (!canvasRect) throw new Error('no canvas');
    // Place 2 points so step ① is still active.
    await page.mouse.click(
      canvasRect.x + canvasRect.width * 0.4,
      canvasRect.y + canvasRect.height * 0.4,
    );
    await page.mouse.click(
      canvasRect.x + canvasRect.width * 0.6,
      canvasRect.y + canvasRect.height * 0.4,
    );
    await fullCapture(page, `D3-${locale}`);
  });

  test(`[screenshot] D7 user guide modal (${locale})`, async ({ page }) => {
    await openAppJa(page);
    await switchLocale(page, locale);
    await page.getByTestId('editor-header-user-guide').click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await fullCapture(page, `D7-${locale}`);
  });
}

test('[screenshot] 5-1 auto error dismiss (success state after dismissal, ja)', async ({
  page,
}) => {
  await openAppJa(page);
  const big = Buffer.alloc(11 * 1024 * 1024, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(big, 0);
  await page.getByLabel('設置場所の写真を追加').setInputFiles({
    name: 'oversize.png',
    mimeType: 'image/png',
    buffer: big,
  });
  await page.getByRole('alert').first().waitFor({ state: 'visible' });
  await addSpaceBg(page);
  await fullCapture(page, '5-1');
});

test('[screenshot] 5-2 size/perspective order (ja, perspective active, size locked)', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  // Click 空間に合わせて配置 (perspective button) to activate.
  await page.getByRole('button', { name: /空間に合わせて配置/ }).click();
  await fullCapture(page, '5-2');
});

test('[screenshot] X1 portable product (ja, portable selected)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'ポータブル', exact: true }).click();
  await fullCapture(page, 'X1');
});
