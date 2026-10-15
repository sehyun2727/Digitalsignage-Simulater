/**
 * [3-3] 슬라이더 현재값 — 상세 점검
 *
 * - 3-3-a 외관 + 詳細設定 완전 펼침 상태에서 range 수량 + 라벨 매트릭스 측정
 * - 3-3-b 각 슬라이더 ArrowRight×5 전/후 수치 일치 (기존 v2-s5-ui.spec.ts :: A4 가 커버)
 * - 3-3-d 「暖色・寒色トーン」 (범위 -100~+100) 값 부호 표시: +N / 0 / -N
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg, expandSection } from './_shared.js';

test('[3-3-a] slider count + labels (LED default, both advanced sections open)', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);
  // Open the appearance advanced-settings sub-accordion so grid/glow/contrast slot in.
  const advanced = page.getByRole('button', { name: /^詳細設定/ }).last();
  const expanded = await advanced.getAttribute('aria-expanded').catch(() => null);
  if (expanded === 'false') await advanced.click();

  // Enable Contact Shadow (so its sub-sliders mount: strength/blur/spread/depth/tint).
  const shadowToggle = page.getByLabel('接地シャドウを有効にする');
  if ((await shadowToggle.getAttribute('aria-checked')) !== 'true') {
    await shadowToggle.check().catch(() => undefined);
  }

  const sliders = page.locator('input[type="range"]');
  const count = await sliders.count();
  const labels: Array<{ i: number; label: string; display: string | null }> = [];
  for (let i = 0; i < count; i++) {
    const slider = sliders.nth(i);
    const label = await slider.evaluate((el: Element) => {
      let node: Element | null = el.parentElement;
      while (node && node.tagName.toLowerCase() !== 'label') node = node.parentElement;
      const spans = node?.querySelectorAll('span') ?? [];
      return spans[0]?.textContent?.trim() ?? '';
    });
    const display = await slider.evaluate((el: Element) => {
      let node: Element | null = el.parentElement;
      while (node && node.tagName.toLowerCase() !== 'label') node = node.parentElement;
      const target = node?.querySelector('[data-testid="toolbar-slider-value"]');
      return target?.textContent?.trim() ?? null;
    });
    labels.push({ i, label, display });
  }
  console.log(`[3-3-a] rangeCount=${count}`);
  console.log('[3-3-a] slider labels + values =', JSON.stringify(labels, null, 2));
  // Every slider must have a visible display (no `null` entries).
  const missing = labels.filter((l) => !l.display);
  console.log(`[3-3-a] sliders without a value display = ${missing.length}`);
  expect(missing.length).toBe(0);
  // Expect at least the known always-mounted sliders when Shadow is on and advanced is open:
  // 質感の強さ, 画面の明るさ, グリッド密度, 発光の強さ, コントラスト, 強さ, ぼかし, 幅,
  // 奥行き, 暖色・寒色トーン, なじませ強度 → ≥ 11.
  expect(count).toBeGreaterThanOrEqual(11);
});

test('[3-3-d] tint slider shows signed value: +N / 0 / -N', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);
  const advanced = page.getByRole('button', { name: /^詳細設定/ }).last();
  const expanded = await advanced.getAttribute('aria-expanded').catch(() => null);
  if (expanded === 'false') await advanced.click();
  // Enable contact shadow so tint slider mounts.
  const shadowToggle = page.getByLabel('接地シャドウを有効にする');
  if ((await shadowToggle.getAttribute('aria-checked')) !== 'true') {
    await shadowToggle.check().catch(() => undefined);
  }

  const tint = page.getByRole('slider', { name: '暖色・寒色トーン' });
  const label = page
    .locator('label')
    .filter({ has: page.locator('span').filter({ hasText: /^暖色・寒色トーン$/ }) });
  const valueSpan = label.getByTestId('toolbar-slider-value').first();

  // Set to +25 using keyboard: focus, Home sets to min, then press End to max, then step.
  await tint.focus();
  await tint.evaluate((el: HTMLInputElement) => {
    el.value = '25';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  });
  const pos = (await valueSpan.textContent())?.trim();
  await tint.evaluate((el: HTMLInputElement) => {
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  });
  const zero = (await valueSpan.textContent())?.trim();
  await tint.evaluate((el: HTMLInputElement) => {
    el.value = '-30';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  });
  const neg = (await valueSpan.textContent())?.trim();

  console.log(`[3-3-d] tint displayed: +25="${pos}" 0="${zero}" -30="${neg}"`);
  expect(pos).toBe('+25');
  expect(zero).toBe('0');
  expect(neg).toBe('-30');
});
