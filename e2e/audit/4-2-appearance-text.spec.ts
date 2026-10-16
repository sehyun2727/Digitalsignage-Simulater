/**
 * [4-2] 외관 설명문 — PDF 원문 ja 문장과 **정확히 일치**
 *
 * 요구 (ja): 「サイネージ本体を「設置場所の写真」に馴染ませるために、明るさを調整できます。
 * 下の「詳細設定」から、さらに細かな調整ができます。」
 */
import { test, expect, type Page } from '@playwright/test';
import { openAppJa, expandSection } from './_shared.js';
import { solidColorPng } from '../support/spaceBackground.js';

const REQUIRED_JA =
  'サイネージ本体を「設置場所の写真」に馴染ませるために、明るさを調整できます。下の「詳細設定」から、さらに細かな調整ができます。';
const REQUIRED_KO =
  '사이니지 본체를 「설치 장소 사진」에 어울리게 하기 위해 밝기를 조정할 수 있습니다. 아래의 「세부 설정」에서 더 세밀하게 조정할 수 있습니다.';
const REQUIRED_EN =
  'Adjust the brightness so the signage blends into the installation site photo. Open "Advanced settings" below for finer control.';

async function openAppInLocale(page: Page, locale: 'ja' | 'ko' | 'en'): Promise<void> {
  await openAppJa(page);
  if (locale !== 'ja') await page.locator('#language-select').selectOption(locale);
  const UPLOAD_LABELS: Record<'ja' | 'ko' | 'en', string> = {
    ja: '設置場所の写真を追加',
    ko: '설치 장소 사진 추가',
    en: 'Add installation site photo',
  };
  const buf = await solidColorPng(page, '#4a4a4a', 1920, 1080);
  await page
    .getByLabel(UPLOAD_LABELS[locale])
    .setInputFiles({ name: 'bg.png', mimeType: 'image/png', buffer: buf });
}

async function appearanceDescription(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整|사이니지 외관 조정|Signage appearance/);
  // The realism guide card is the first content inside the appearance section.
  const body = page.locator('.realism-guide-card-body p').first();
  await body.waitFor({ state: 'visible' });
  return (await body.textContent())?.trim() ?? '';
}

test('[4-2 ja] appearance description equals the exact PDF sentence', async ({ page }) => {
  await openAppInLocale(page, 'ja');
  const got = await appearanceDescription(page);
  console.log(`[4-2 ja] = ${JSON.stringify(got)}`);
  expect(got).toBe(REQUIRED_JA);
});

test('[4-2 ko] appearance description equals the required ko translation', async ({ page }) => {
  await openAppInLocale(page, 'ko');
  const got = await appearanceDescription(page);
  console.log(`[4-2 ko] = ${JSON.stringify(got)}`);
  expect(got).toBe(REQUIRED_KO);
});

test('[4-2 en] appearance description equals the required en translation', async ({ page }) => {
  await openAppInLocale(page, 'en');
  const got = await appearanceDescription(page);
  console.log(`[4-2 en] = ${JSON.stringify(got)}`);
  expect(got).toBe(REQUIRED_EN);
});
