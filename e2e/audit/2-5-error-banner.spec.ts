/**
 * [2-5] エラーメッセージの視認性
 *
 * 측정: 10MB 넘는 이미지 업로드 실패 시 ErrorBanner 가 노출되는지, 그때
 * fontSize/대비/overlap 수치를 기록한다.
 */
import { test, expect } from '@playwright/test';
import { openAppJa, contrastRatio, rgbToHex } from './_shared.js';

test('[2-5] error banner: font-size ≥ 1rem and WCAG AA contrast', async ({ page }) => {
  await openAppJa(page);

  // Build an oversized "image" by feeding a 11MB file; the uploader will reject it with a
  // "too large" cause and remedy. We fake a 11 MB PNG by writing bytes to a Buffer — the
  // mimetype gate is first, so pass image/png.
  const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 0);
  // Prepend a (truncated) PNG magic header so sniffers accept it.
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  png.copy(bigBuffer, 0);

  await page.getByLabel('設置場所の写真を追加').setInputFiles({
    name: 'oversize.png',
    mimeType: 'image/png',
    buffer: bigBuffer,
  });

  const banner = page.getByRole('alert').first();
  await banner.waitFor({ state: 'visible', timeout: 10000 });

  const measurement = await banner.evaluate((el: Element) => {
    const he = el as HTMLElement;
    const style = window.getComputedStyle(he);
    // Walk ancestors to find an opaque background.
    let bg = style.backgroundColor;
    let node: HTMLElement | null = he;
    while (node && (bg === 'rgba(0, 0, 0, 0)' || !bg)) {
      node = node.parentElement;
      if (node) bg = window.getComputedStyle(node).backgroundColor;
    }
    const rect = he.getBoundingClientRect();
    return {
      fontSize: style.fontSize,
      color: style.color,
      bg,
      role: he.getAttribute('role'),
      ariaLive: he.getAttribute('aria-live'),
      rectTop: rect.top,
      rectHeight: rect.height,
      rectWidth: rect.width,
      innerText: he.innerText,
    };
  });

  const fg = rgbToHex(measurement.color);
  const bg = rgbToHex(measurement.bg);
  const ratio = contrastRatio(fg, bg);
  const fontPx = parseFloat(measurement.fontSize);
  console.log(
    `[2-5] banner fontSize=${measurement.fontSize} fg=${fg} bg=${bg} contrastRatio=${ratio.toFixed(2)}:1 rect={top:${measurement.rectTop.toFixed(0)}, w:${measurement.rectWidth.toFixed(0)}, h:${measurement.rectHeight.toFixed(0)}} role=${measurement.role} aria-live=${measurement.ariaLive}`,
  );
  console.log('[2-5] bannerText =', JSON.stringify(measurement.innerText));

  // Must be ≥ 16 px (1 rem).
  expect(fontPx).toBeGreaterThanOrEqual(16);
  // Must meet WCAG AA for normal text (4.5:1).
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  // Must have a role=alert for assistive tech.
  expect(measurement.role).toBe('alert');
});
