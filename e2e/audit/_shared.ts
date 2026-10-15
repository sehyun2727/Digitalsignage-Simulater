import type { Page } from '@playwright/test';
import { solidColorPng } from '../support/spaceBackground.js';

export async function openAppJa(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('signage-canvas.onboarding-dismissed', '1');
      localStorage.setItem('signage-canvas.realism-guide-dismissed', '1');
    } catch {
      /* storage may be denied in some contexts */
    }
  });
  await page.goto('/');
  await page.locator('.editor-canvas-container').first().waitFor({ state: 'visible' });
}

export async function addSpaceBg(
  page: Page,
  opts: { w?: number; h?: number; color?: string; file?: Buffer; name?: string } = {},
): Promise<void> {
  const { w = 1920, h = 1080, color = '#4a4a4a', file, name = 'space.png' } = opts;
  const buf = file ?? (await solidColorPng(page, color, w, h));
  await page.getByLabel('設置場所の写真を追加').setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: buf,
  });
  // Wait for the space photo to be rendered — the heading becomes visible.
  await page
    .getByRole('button', { name: /^設置場所の写真/ })
    .first()
    .waitFor({ state: 'visible' });
}

export async function expandSection(page: Page, headingRegex: RegExp): Promise<void> {
  const toggle = page.getByRole('button', { name: headingRegex }).first();
  const expanded = await toggle.getAttribute('aria-expanded').catch(() => null);
  if (expanded === 'false') await toggle.click();
}

export async function expandPositionSize(page: Page): Promise<void> {
  const sub = page.getByTestId('toolbar-subsection-position-size-toggle').first();
  const expanded = await sub.getAttribute('aria-expanded').catch(() => null);
  if (expanded === 'false') await sub.click();
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const to = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * to(r) + 0.7152 * to(g) + 0.0722 * to(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [a, b] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

export function rgbToHex(rgb: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) return '#000000';
  const [, r, g, b] = m;
  return '#' + [r, g, b].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
}
