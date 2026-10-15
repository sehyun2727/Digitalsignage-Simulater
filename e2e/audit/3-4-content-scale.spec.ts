/**
 * [3-4] コンテンツ拡大率 % 표기
 *
 * 측정: 입력란이 숫자(%) 로 표시되고, 「%」 라벨이 보이는지. 그리고 150 입력 → store
 * 가 1.5 로 저장되는지(간접적으로 입력값이 150 으로 유지되는지).
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg, expandSection } from './_shared.js';

test('[3-4] content scale input shows percent + unit', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /画面コンテンツ/);

  // Upload a tiny PNG as content.
  const image = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300000002000149be5a2b0000000049454e44ae426082',
    'hex',
  );
  await page.getByLabel(/画像 \/ 動画を追加/).setInputFiles({
    name: 'c.png',
    mimeType: 'image/png',
    buffer: image,
  });

  // Open advanced content settings (the "コンテンツの詳細設定" accordion).
  const advanced = page.getByRole('button', { name: /^コンテンツの詳細設定/ }).first();
  await advanced.waitFor({ state: 'visible' });
  const expanded = await advanced.getAttribute('aria-expanded');
  if (expanded === 'false') await advanced.click();

  const scaleInput = page.getByTestId('editor-content-scale-input');
  await scaleInput.waitFor({ state: 'visible' });

  // Read initial value (expect 100).
  const initial = await scaleInput.inputValue();
  console.log(`[3-4] initialScaleInput = ${initial}`);
  expect(initial).toBe('100');

  // The % suffix must appear as a sibling.
  const suffix = page.locator('.toolbar-percent-suffix').first();
  const suffixText = await suffix.textContent();
  console.log(`[3-4] percentSuffix = ${JSON.stringify(suffixText)}`);
  expect(suffixText?.trim()).toBe('%');

  // Set to 150 and blur.
  await scaleInput.fill('150');
  await scaleInput.blur();
  const after = await scaleInput.inputValue();
  console.log(`[3-4] afterInput = ${after}`);
  expect(after).toBe('150');
});
