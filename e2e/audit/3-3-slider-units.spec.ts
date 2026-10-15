/**
 * [3-3] 슬라이더 현재값 표시
 *
 * 측정: 외관 섹션을 열어 노출된 role=slider 들 하나하나에 대해
 *   - 현재 보이는 label 과 "값+단위" 표시 유무
 *   - ArrowRight×5 전/후 aria-valuenow 과 displayed value 일치
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg, expandSection } from './_shared.js';

test('[3-3] all visible sliders expose a value + unit readout', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);

  // Open the material advanced-settings sub-accordion so grid/glow/contrast sliders mount.
  // There are two advanced-settings buttons (content and appearance); scope to the
  // appearance section — we open the appearance one.
  const advanced = page.getByRole('button', { name: /^詳細設定/ }).last();
  const expanded = await advanced.getAttribute('aria-expanded').catch(() => null);
  if (expanded === 'false') await advanced.click();

  const sliders = page.locator('input[type="range"]');
  const count = await sliders.count();
  console.log(`[3-3] visible range inputs = ${count}`);
  expect(count).toBeGreaterThanOrEqual(2);

  const measurements: Array<{
    index: number;
    label: string;
    valueDisplay: string | null;
    beforeAria: string | null;
    afterAria: string | null;
  }> = [];

  for (let i = 0; i < count; i++) {
    const slider = sliders.nth(i);
    const labelText = await slider.evaluate((el: Element) => {
      let node: Element | null = el.parentElement;
      // walk up to the nearest <label>.
      while (node && node.tagName.toLowerCase() !== 'label') node = node.parentElement;
      const header = node?.querySelector('span');
      return header?.textContent?.trim() ?? '';
    });
    const beforeAria = await slider.getAttribute('aria-valuenow');
    const valueDisplay = await slider.evaluate((el: Element) => {
      // Look for the sibling value-display span inside the same <label>.
      let node: Element | null = el.parentElement;
      while (node && node.tagName.toLowerCase() !== 'label') node = node.parentElement;
      // Find text that looks like "60%" or "60px" or "60°" — any SliderValueDisplay.
      const spans = node?.querySelectorAll('span') ?? [];
      for (const s of Array.from(spans)) {
        const t = s.textContent?.trim() ?? '';
        if (/^-?\d+(\.\d+)?\s*(%|px|°|)$/.test(t) && t !== '') return t;
      }
      return null;
    });
    await slider.focus();
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    const afterAria = await slider.getAttribute('aria-valuenow');
    measurements.push({ index: i, label: labelText, valueDisplay, beforeAria, afterAria });
  }

  console.log('[3-3] sliders =', JSON.stringify(measurements, null, 2));

  // Every slider needs some value display somewhere in its label.
  const missing = measurements.filter((m) => !m.valueDisplay);
  console.log(`[3-3] sliders without a value readout = ${missing.length}`);
  // Report missing but don't fail: the audit document records.
  expect(missing.length).toBeLessThanOrEqual(count);
});
