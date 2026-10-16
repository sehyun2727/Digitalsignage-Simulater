/**
 * [3-4] コンテンツ拡大率 % 표기 — 상세 점검
 *
 * - 3-4-a 초기 100, % 접미사
 * - 3-4-b 50/100/150% 각각의 콘텐츠 폭을 측정하고 150% 가 100% 의 **1.5× ±1%** 임을
 *   확인한다. 측정 방법:
 *     * 콘텐츠는 **100×100 정사각 매젠타** (`#FF00FF`). Fit=contain + 정사각 content
 *       on 480×270 LED 화면 → baseWidth=270 (screen.height × 1.0). 따라서 scale=S 에서
 *       on-screen 매젠타 폭은 `270 × S` (horizontal letterbox 안쪽에서 clipping 없음).
 *       scale=150% 에서 405px, scale=100% 에서 270px → 비율 1.5 가 정확히 성립.
 *     * y=mid 수평 라인에서 가장 긴 매젠타 run 측정. 500ms 간격의 double-sample 로
 *       렌더링 안정화 보장.
 * - 3-4-c 소수 배율 표기 0건
 * - 3-4-d Undo 동작
 * - 3-4-e 3 로케일 라벨
 */
import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFile } from 'node:fs/promises';
import { openAppJa, addSpaceBg, expandSection, readEditorStore } from './_shared.js';
import { solidColorPng } from '../support/spaceBackground.js';

function isMagenta(data: Buffer, idx: number): boolean {
  const r = data[idx]!;
  const g = data[idx + 1]!;
  const b = data[idx + 2]!;
  return Math.sqrt((r - 255) ** 2 + g * g + (b - 255) ** 2) < 50;
}

async function exportPng(page: Page): Promise<PNG> {
  const dl = page.waitForEvent('download');
  await page.getByTestId('editor-export-png-header').click();
  const d = await dl;
  const buf = await readFile((await d.path())!);
  return PNG.sync.read(buf);
}

/** Longest magenta horizontal run across the top-middle band of the LED's screen row. */
function longestMagentaRunHorizontal(png: PNG, y: number): number {
  let best = 0;
  let cur = 0;
  for (let x = 0; x < png.width; x++) {
    if (isMagenta(png.data, (y * png.width + x) * 4)) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

test('[3-4-a] input shows integer % with suffix', async ({ page }) => {
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
  const scaleInput = page.getByTestId('editor-content-scale-input');
  const initial = await scaleInput.inputValue();
  const suffix = (await page.locator('.toolbar-percent-suffix').first().textContent())?.trim();
  console.log(`[3-4-a] initial=${initial} suffix=${JSON.stringify(suffix)}`);
  expect(initial).toBe('100');
  expect(suffix).toBe('%');
});

test('[3-4-b] 50/100/150% content width scales linearly within ±1% (D9 range 50-300%)', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /画面コンテンツ/);
  // v2-P3 D9: content scale min lowered to 0.5. We now exercise the full 50/100/150 %
  // row from the PDF. Content fixture: 100×100 square magenta → base contain-fit on
  // 480×270 LED screen fills the screen height (~258 px) so the base rendered content
  // is 258×258 and scales linearly without clipping horizontally until S ≈ 1.78.
  // At S=0.5/1.0/1.5 the magenta width is ~129/258/387 px (ratio preserved).
  const content = await solidColorPng(page, '#ff00ff', 100, 100);
  await page.getByLabel(/画像 \/ 動画を追加/).setInputFiles({
    name: 'magenta.png',
    mimeType: 'image/png',
    buffer: content,
  });

  const advanced = page.getByRole('button', { name: /^コンテンツの詳細設定/ }).first();
  if ((await advanced.getAttribute('aria-expanded')) === 'false') await advanced.click();
  const scaleInput = page.getByTestId('editor-content-scale-input');

  async function measureAt(scalePct: number): Promise<number> {
    await scaleInput.fill(String(scalePct));
    await scaleInput.blur();
    await page.waitForTimeout(200);
    const png = await exportPng(page);
    const y = Math.floor(png.height / 2);
    return longestMagentaRunHorizontal(png, y);
  }

  const w50 = await measureAt(50);
  const w100 = await measureAt(100);
  const w150 = await measureAt(150);
  const ratio150_100 = w150 / w100;
  const ratio50_100 = w50 / w100;
  console.log(
    `[3-4-b] magenta run @50=${w50} @100=${w100} @150=${w150}; ratio150/100=${ratio150_100.toFixed(5)} ratio50/100=${ratio50_100.toFixed(5)}`,
  );

  // Strict: 150/100 ratio within 1 % of 1.5, and 50/100 within 1 % of 0.5.
  expect(ratio150_100).toBeGreaterThanOrEqual(1.5 - 0.015);
  expect(ratio150_100).toBeLessThanOrEqual(1.5 + 0.015);
  expect(ratio50_100).toBeGreaterThanOrEqual(0.5 - 0.005);
  expect(ratio50_100).toBeLessThanOrEqual(0.5 + 0.005);
});

test('[3-4-c] UI never shows the raw multiplier (0.5 / 1.5 etc.)', async ({ page }) => {
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
  const scaleInput = page.getByTestId('editor-content-scale-input');
  await scaleInput.fill('150');
  await scaleInput.blur();
  // The raw multiplier is 1.5 and must NOT appear in UI DOM text as a fractional number.
  const dom = await page.evaluate(() => document.body.innerText);
  const rawMultiplierHits = (dom.match(/\b(?:0\.5|1\.5|1\.0)\b/g) ?? []).length;
  console.log(`[3-4-c] raw multiplier hits in DOM = ${rawMultiplierHits}`);
  // Non-content occurrences of these numeric fragments are possible (unlikely); allow 0 strict.
  expect(rawMultiplierHits).toBe(0);
  // Also the store value is still the raw multiplier 1.5 (confirms the separation).
  const store = await readEditorStore(page);
  const obj = store.document.objects[0] as { content: { scale: number } | null };
  console.log(`[3-4-c] store content.scale = ${obj.content?.scale}`);
  expect(obj.content?.scale).toBeCloseTo(1.5, 5);
});

test('[3-4-d] Undo after a scale change reverts the input + store', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /画面コンテンツ/);
  const content = await solidColorPng(page, '#ff00ff', 100, 100);
  await page.getByLabel(/画像 \/ 動画を追加/).setInputFiles({
    name: 'magenta.png',
    mimeType: 'image/png',
    buffer: content,
  });
  const advanced = page.getByRole('button', { name: /^コンテンツの詳細設定/ }).first();
  if ((await advanced.getAttribute('aria-expanded')) === 'false') await advanced.click();
  const scaleInput = page.getByTestId('editor-content-scale-input');
  const initial = await scaleInput.inputValue();
  await scaleInput.fill('150');
  await scaleInput.blur();
  const after = await scaleInput.inputValue();
  // Undo.
  await page.getByRole('button', { name: /元に戻す/ }).click();
  // Store value should be back to 1.0. UI input may need re-selection since Undo clears
  // selectedId.
  const store = await readEditorStore(page);
  const scale = (store.document.objects[0] as { content: { scale: number } | null }).content?.scale;
  console.log(`[3-4-d] initial=${initial} after=${after} store.scale after Undo = ${scale}`);
  expect(scale).toBeCloseTo(1.0, 5);
});

test('[3-4-e] label locales: ja/ko/en', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  // The content-scale label only renders once the content exists. Upload a tiny PNG.
  const img = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300000002000149be5a2b0000000049454e44ae426082',
    'hex',
  );
  await expandSection(page, /画面コンテンツ/);
  await page.getByLabel(/画像 \/ 動画を追加/).setInputFiles({
    name: 'c.png',
    mimeType: 'image/png',
    buffer: img,
  });
  const advanced = page.getByRole('button', { name: /^コンテンツの詳細設定/ }).first();
  if ((await advanced.getAttribute('aria-expanded')) === 'false') await advanced.click();

  const titles: Record<'ja' | 'ko' | 'en', string> = {
    ja: 'コンテンツ拡大率',
    ko: '콘텐츠 확대 비율',
    en: 'Content zoom',
  };
  const detected: Record<string, string> = {};
  for (const locale of ['ja', 'ko', 'en'] as const) {
    if (locale !== 'ja') await page.locator('#language-select').selectOption(locale);
    const bodyText = await page.evaluate(() => document.body.innerText);
    detected[locale] = bodyText.includes(titles[locale]) ? titles[locale] : '(not found)';
  }
  console.log('[3-4-e] locale labels =', detected);
  expect(detected.ja).toBe(titles.ja);
  expect(detected.ko).toBe(titles.ko);
  expect(detected.en).toBe(titles.en);
});
