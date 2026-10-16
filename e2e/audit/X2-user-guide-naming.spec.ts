/**
 * [X2] 使い方ガイド 명칭 통일 (D7)
 *
 * 요구: 헤더 버튼 가시 라벨 = 모달 제목 = 「使い方ガイド」 (ja). ko = 「사용 가이드」,
 * en = 「User guide」. 푸터 📖 는 aria-label 로 같은 문구를 쓴다 (아이콘 only).
 */
import { test, expect } from '@playwright/test';
import { openAppJa } from './_shared.js';

const BUTTON_LABEL: Record<'ja' | 'ko' | 'en', string> = {
  ja: '使い方ガイド',
  ko: '사용 가이드',
  en: 'User guide',
};

for (const locale of ['ja', 'ko', 'en'] as const) {
  test(`[X2 ${locale}] header button label === modal title`, async ({ page }) => {
    await openAppJa(page);
    if (locale !== 'ja') await page.locator('#language-select').selectOption(locale);

    const headerBtn = page.getByTestId('editor-header-user-guide');
    const headerLabel = (await headerBtn.textContent())?.trim();
    console.log(`[X2 ${locale}] headerBtn label = ${JSON.stringify(headerLabel)}`);
    expect(headerLabel).toBe(BUTTON_LABEL[locale]);

    // Open the modal via the header button and read its title.
    await headerBtn.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    const title = (await dialog.locator('h2').first().textContent())?.trim();
    console.log(`[X2 ${locale}] modal title = ${JSON.stringify(title)}`);
    expect(title).toBe(BUTTON_LABEL[locale]);
  });
}
