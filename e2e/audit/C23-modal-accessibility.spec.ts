/**
 * [C23] 중앙 모달 제거 후에도 키보드 조작/포커스 이동/Esc 유지
 *
 * 지금 중앙 상세 설정 모달은 모두 패널 인라인으로 통합됐지만 TOS/UserGuide 두 모달은
 * `useModalDialog` 를 통해 role=dialog 로 남아 있다. 두 모달의 접근성이 **깨지지 않았는지**
 * 를 자동화한다.
 *
 * - C23-a: 모달 열기 → Esc 키 → 모달 닫힘.
 * - C23-b: 포커스 트랩. Tab 과 Shift+Tab 이 다이얼로그 안의 포커스 가능 요소 사이에서
 *   순환하고, 다이얼로그 밖으로 포커스가 벗어나지 않음.
 * - C23-c: 닫힌 뒤 포커스가 **원래 launcher 버튼**으로 복귀.
 */
import { test, expect, type Page } from '@playwright/test';
import { openAppJa } from './_shared.js';

async function activeTestId(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
}

async function activeText(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.textContent?.trim() ?? null);
}

interface ModalScenario {
  label: string;
  openerTestId: string;
}

const MODALS: ModalScenario[] = [
  { label: 'UserGuide', openerTestId: 'editor-header-user-guide' },
  // The ToS modal is opened via the footer "利用規約" link. HullCta renders it with a button.
  // We locate by role instead of testId.
];

for (const m of MODALS) {
  test(`[C23-a] ${m.label}: Esc closes the modal`, async ({ page }) => {
    await openAppJa(page);
    await page.getByTestId(m.openerTestId).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    const after = await page.getByRole('dialog').count();
    console.log(`[C23-a ${m.label}] role=dialog count after Esc = ${after}`);
    expect(after).toBe(0);
  });

  test(`[C23-b] ${m.label}: focus stays trapped inside the dialog on Tab cycling`, async ({
    page,
  }) => {
    await openAppJa(page);
    await page.getByTestId(m.openerTestId).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    // Collect all focusable elements inside the dialog.
    const focusables = await dialog.evaluate((el) => {
      const SEL =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(el.querySelectorAll<HTMLElement>(SEL)).map((e, i) => ({
        i,
        tag: e.tagName,
        text: (e.textContent ?? '').trim().slice(0, 40),
      }));
    });
    console.log(`[C23-b ${m.label}] focusable count = ${focusables.length}`);
    expect(focusables.length).toBeGreaterThan(0);
    // The modal auto-focuses the first focusable element on mount.
    // Tab through all elements + 1 extra (should wrap to the first).
    for (let i = 0; i <= focusables.length; i++) {
      await page.keyboard.press('Tab');
    }
    // After `focusables.length + 1` Tabs starting from the first element, focus should be
    // on the second element (wrap once + 1 Tab).
    const activeStillInsideDialog = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d?.contains(document.activeElement) ?? false;
    });
    console.log(
      `[C23-b ${m.label}] focus still inside dialog after wrap = ${activeStillInsideDialog}`,
    );
    expect(activeStillInsideDialog).toBe(true);
    // Shift+Tab from the first element wraps backwards to the last.
    // Click first focusable to normalise position.
    const firstFocusHandle = page.getByRole('dialog').locator('button, a, input, select').first();
    await firstFocusHandle.focus();
    await page.keyboard.press('Shift+Tab');
    const activeAfterShiftTab = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d?.contains(document.activeElement) ?? false;
    });
    console.log(
      `[C23-b ${m.label}] focus inside dialog after Shift+Tab wrap = ${activeAfterShiftTab}`,
    );
    expect(activeAfterShiftTab).toBe(true);
  });

  test(`[C23-c] ${m.label}: focus returns to the launcher after close`, async ({ page }) => {
    await openAppJa(page);
    const opener = page.getByTestId(m.openerTestId);
    await opener.focus();
    const beforeId = await activeTestId(page);
    const beforeTxt = await activeText(page);
    console.log(
      `[C23-c ${m.label}] opener focused: testid=${beforeId} text=${JSON.stringify(beforeTxt)}`,
    );
    await opener.click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    // After close, focus returns to the previously-focused element (the launcher).
    const afterId = await activeTestId(page);
    const afterTxt = await activeText(page);
    console.log(
      `[C23-c ${m.label}] after close: testid=${afterId} text=${JSON.stringify(afterTxt)}`,
    );
    expect(afterId).toBe(m.openerTestId);
  });
}

// ToS modal is opened via the HullCta "利用規約" button (not a testId; uses role).
test('[C23-a ToS] Esc closes the Terms of Service modal', async ({ page }) => {
  await openAppJa(page);
  await page.getByRole('button', { name: '利用規約' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  console.log('[C23-a ToS] Esc closed the dialog');
});

test('[C23-c ToS] focus returns to 利用規約 launcher after close', async ({ page }) => {
  await openAppJa(page);
  const launcher = page.getByRole('button', { name: '利用規約' }).first();
  await launcher.focus();
  await launcher.click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  const afterText = await activeText(page);
  console.log(`[C23-c ToS] active text after close = ${JSON.stringify(afterText)}`);
  expect(afterText).toContain('利用規約');
});
