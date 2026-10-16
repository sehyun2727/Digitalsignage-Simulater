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

/**
 * v2-P2: read the editor store state through the dev backdoor exposed by `src/main.tsx`
 * (`window.__editorStoreGetState`). Returns the full editor state so audit specs can
 * assert on document.objects / clipboard / past / future without going through the DOM.
 */
export interface EditorStoreSnapshot {
  document: {
    objects: Array<Record<string, unknown>>;
    spaceBackground: Record<string, unknown> | null;
    canvasPreset: string;
  };
  selectedId: string | null;
  past: unknown[];
  future: unknown[];
  clipboard: unknown;
}

export async function readEditorStore(page: Page): Promise<EditorStoreSnapshot> {
  return page.evaluate(() => {
    const w = window as unknown as { __editorStoreGetState?: () => EditorStoreSnapshot };
    const get = w.__editorStoreGetState;
    if (!get) throw new Error('editor store backdoor missing: window.__editorStoreGetState');
    return get();
  });
}

/** Deep-equal utility that reports the list of differing field paths. We use this in
 *  1-1-b to prove the copy only differs on id/x/y (and nothing else). */
export function deepDiffFields(a: unknown, b: unknown, path = '', into: string[] = []): string[] {
  if (a === b) return into;
  if (typeof a !== typeof b) {
    into.push(path || '(root)');
    return into;
  }
  if (a === null || b === null) {
    into.push(path || '(root)');
    return into;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) into.push(`${path}.length`);
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) deepDiffFields(a[i], b[i], `${path}[${i}]`, into);
    return into;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    const keys = new Set([...ka, ...kb]);
    for (const k of keys) {
      deepDiffFields(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        path ? `${path}.${k}` : k,
        into,
      );
    }
    return into;
  }
  into.push(path || '(root)');
  return into;
}
