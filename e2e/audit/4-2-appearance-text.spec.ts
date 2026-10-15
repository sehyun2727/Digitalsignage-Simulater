/**
 * [4-2] 외관 섹션 설명문 확인
 *
 * 요구 문: 「サイネージ本体を「設置場所の写真」に馴染ませるために、明るさを調整できます。
 * 下の「詳細設定」から、さらに細かな調整ができます。」
 *
 * 현재 realismGuideDescription 은 다른 문장이다. 측정값으로 기록한다.
 */
import { test } from '@playwright/test';
import { openAppJa, addSpaceBg, expandSection } from './_shared.js';

const REQUIRED_JA =
  'サイネージ本体を「設置場所の写真」に馴染ませるために、明るさを調整できます。下の「詳細設定」から、さらに細かな調整ができます。';

test('[4-2] appearance description text (ja) match', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  // Add LED so appearance section is populated.
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);
  // Collect visible paragraphs within the appearance section.
  const paragraphs = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('button')).find((b) =>
      /サイネージ外観の調整/.test(b.textContent ?? ''),
    );
    if (!heading) return [];
    // Walk forward until next section heading.
    const texts: string[] = [];
    let node: Element | null = heading.parentElement?.nextElementSibling ?? null;
    while (node && !/サイネージ外観の調整|書き出し/.test(node.textContent?.slice(0, 30) ?? '')) {
      const ps = node.querySelectorAll('p, .toolbar-notice, .toolbar-subsection-heading');
      ps.forEach((p) => texts.push(p.textContent?.trim() ?? ''));
      node = node.nextElementSibling;
    }
    return texts.filter(Boolean);
  });
  console.log('[4-2] appearanceParagraphs =', paragraphs);
  const match = paragraphs.find((p) => p === REQUIRED_JA);
  console.log('[4-2] requiredPresent =', Boolean(match));
  // Also report the closest realism/appearance notice we found.
  console.log(
    '[4-2] closestRelatedText =',
    paragraphs.find((p) => p.includes('明るさ') && p.includes('設置場所の写真')),
  );
});
