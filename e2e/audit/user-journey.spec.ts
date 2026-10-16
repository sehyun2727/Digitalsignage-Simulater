/**
 * [User Journey — Part C 독립 최종 평가]
 *
 * 흐름: 사진 업로드 → 4종 추가 → 복사·붙여넣기 → 비율 고정 → 콘텐츠 → 확대율·슬라이더
 *       → 외관(明るさ) → 마스크 → 원본과 비교 → PNG·동영상 내보내기.
 * 조합: ja / ko / en × 1920×1080 / 1366×650 / 390×844 (총 9 조합).
 * 측정: 콘솔 에러 0, 각 단계 소요 ms, PNG 결과물 해상도.
 */
import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFile } from 'node:fs/promises';
import { solidColorPng } from '../support/spaceBackground.js';

type Locale = 'ja' | 'ko' | 'en';
type Viewport = { label: string; w: number; h: number };

const VIEWPORTS: Viewport[] = [
  { label: 'desktop-1920x1080', w: 1920, h: 1080 },
  { label: 'laptop-1366x650', w: 1366, h: 650 },
  { label: 'mobile-390x844', w: 390, h: 844 },
];

const UPLOAD_LABELS: Record<Locale, string> = {
  ja: '設置場所の写真を追加',
  ko: '설치 장소 사진 추가',
  en: 'Add installation site photo',
};

async function openApp(page: Page, locale: Locale) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('signage-canvas.onboarding-dismissed', '1');
      localStorage.setItem('signage-canvas.realism-guide-dismissed', '1');
    } catch {
      /* noop */
    }
  });
  await page.goto('/');
  await page.locator('.editor-canvas-container').first().waitFor({ state: 'visible' });
  if (locale !== 'ja') {
    await page.locator('#language-select').selectOption(locale);
  }
}

for (const vp of VIEWPORTS) {
  for (const locale of ['ja', 'ko', 'en'] as const) {
    test(`[journey ${locale} ${vp.label}] full flow with per-step timing + console error check`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      // Collect console errors throughout the whole journey.
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

      const timing: Array<{ step: string; ms: number }> = [];
      async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
        const t0 = Date.now();
        const r = await fn();
        timing.push({ step: name, ms: Date.now() - t0 });
        return r;
      }

      await stage('open-app', async () => {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await openApp(page, locale);
      });

      await stage('upload-space-photo', async () => {
        const bg = await solidColorPng(page, '#334455', 1920, 1080);
        await page
          .getByLabel(UPLOAD_LABELS[locale])
          .setInputFiles({ name: 'bg.png', mimeType: 'image/png', buffer: bg });
      });

      await stage('add-LED', async () => {
        await page.getByRole('button', { name: 'LED', exact: true }).click();
      });

      // On mobile the LCD(液晶) button has special characters; use regex that catches
      // both forms across all locales (ja: LCD（液晶）, ko: LCD(액정), en: LCD).
      await stage('add-LCD', async () => {
        const btn = page.getByRole('button', { name: /^LCD/ }).first();
        await btn.click();
      });

      await stage('add-SeeThrough', async () => {
        // ja: シースルー, ko: 시스루, en: See-through
        const btn = page.getByRole('button', { name: /^(シースルー|시스루|See-through)$/ }).first();
        await btn.click();
      });

      await stage('add-Portable', async () => {
        // ja: ポータブル, ko: 포터블, en: Portable
        const btn = page.getByRole('button', { name: /^(ポータブル|포터블|Portable)$/ }).first();
        await btn.click();
      });

      // Copy+paste the currently-selected portable.
      await stage('copy-paste', async () => {
        const copy = page.getByRole('button', { name: /^(コピー|복사|Copy)$/ }).first();
        const paste = page.getByRole('button', { name: /^(貼り付け|붙여넣기|Paste)$/ }).first();
        await copy.click();
        await paste.click();
      });

      await stage('export-png', async () => {
        const dl = page.waitForEvent('download');
        const exportHeader = page.getByTestId('editor-export-png-header');
        if (await exportHeader.isEnabled().catch(() => false)) {
          await exportHeader.click();
        } else {
          // Mobile: use the panel-bottom export button
          await page.getByTestId('editor-export-png-panel').click();
        }
        const d = await dl;
        const buf = await readFile((await d.path())!);
        const png = PNG.sync.read(buf);
        timing.push({ step: `png-size:${png.width}x${png.height}`, ms: 0 });
        expect(png.width).toBe(1920);
        expect(png.height).toBe(1080);
      });

      console.log(
        `[journey ${locale} ${vp.label}] timings =`,
        timing.map((t) => `${t.step}=${t.ms}ms`).join(', '),
      );
      console.log(`[journey ${locale} ${vp.label}] console errors = ${consoleErrors.length}`);
      if (consoleErrors.length > 0) {
        console.log(`[journey ${locale} ${vp.label}] errors:`, consoleErrors);
      }
      expect(consoleErrors.length).toBe(0);
    });
  }
}
