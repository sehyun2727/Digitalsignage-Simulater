/**
 * [2-3] 중앙 상세 설정 창 → 패널 안 접이식 통합
 *
 * 요구: AdvancedSettingsModal 을 제거하고 role=dialog 가 없어야 한다.
 * 측정: role=dialog 중 모달성 설정 창(「詳細設定」류)이 1개도 없음을 확인한다.
 *   ToS/UserGuide 다이얼로그는 "사이니지 가리는 상세설정 창"이 아니므로 제외.
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg, expandSection } from './_shared.js';

test('[2-3] no settings dialog overlays the signage area', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);

  // Open the appearance advanced settings — if the old modal is still here, this clicks
  // a button named "詳細設定" and opens a role=dialog that covers the signage.
  const advancedBtns = page.getByRole('button', { name: /^詳細設定/ });
  const count = await advancedBtns.count();
  console.log(`[2-3] visible "詳細設定" buttons = ${count}`);
  if (count > 0) {
    await advancedBtns.last().click();
  }

  // Give it a tick to open any potential dialog.
  await page.waitForTimeout(300);

  const dialogRoles = page.getByRole('dialog');
  const dialogCount = await dialogRoles.count();
  console.log(`[2-3] role=dialog count after opening advanced settings = ${dialogCount}`);

  // Only non-settings dialogs allowed: ToS modal and UserGuide modal are OK, both of which
  // are closed by default and would only appear if the user clicks their launchers. We did
  // not click them, so count must be 0.
  expect(dialogCount).toBe(0);
});
