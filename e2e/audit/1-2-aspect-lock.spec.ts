/**
 * [1-2] 縦横比を固定
 *
 * - 폭 입력 옆에 비율 고정 토글이 있음 (aria-pressed)
 * - ON 상태에서 폭 960 → 높이 540 자동 조정
 * - OFF 상태에서는 폭만 바뀜
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg, expandPositionSize } from './_shared.js';

test('[1-2] aspect lock: width 960 → height 540 (±0.5)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  // Expand the selected signage section + position-size sub-accordion.
  const selected = page.getByRole('button', { name: /^選択中のサイネージ/ }).first();
  const exp = await selected.getAttribute('aria-expanded').catch(() => null);
  if (exp === 'false') await selected.click();
  await expandPositionSize(page);

  const toggle = page.getByTestId('toolbar-aspect-lock-toggle');
  await toggle.waitFor({ state: 'visible' });

  // Scoped to the position-size subsection to disambiguate from similar labels elsewhere
  // (e.g. contact-shadow 幅（広がり）).
  const positionSizeBody = page.locator('#toolbar-subsection-position-size-body');
  const widthInput = positionSizeBody.getByLabel('幅', { exact: true });
  const heightInput = positionSizeBody.getByLabel('高さ', { exact: true });
  await widthInput.waitFor({ state: 'visible' });

  const toggleRect = await toggle.boundingBox();
  const widthRect = await widthInput.boundingBox();
  // Measure proximity (CSS pixels).
  const dist =
    toggleRect && widthRect
      ? Math.max(
          0,
          toggleRect.x - (widthRect.x + widthRect.width),
          widthRect.x - (toggleRect.x + toggleRect.width),
        )
      : -1;
  console.log(`[1-2] toggle↔width distance=${dist.toFixed(1)}px`);

  // Make sure toggle is ON (aria-pressed=true).
  let pressed = await toggle.getAttribute('aria-pressed');
  if (pressed === 'false') await toggle.click();
  pressed = await toggle.getAttribute('aria-pressed');
  console.log(`[1-2] aria-pressed before width change = ${pressed}`);
  expect(pressed).toBe('true');

  // Set width to 960 and blur.
  await widthInput.fill('960');
  await widthInput.blur();

  const heightValue = Number(await heightInput.inputValue());
  console.log(`[1-2] after width=960 (ON), height=${heightValue}`);
  expect(Math.abs(heightValue - 540)).toBeLessThanOrEqual(0.5);

  // Now flip OFF and set width 500 — height should stay 540.
  await toggle.click();
  pressed = await toggle.getAttribute('aria-pressed');
  expect(pressed).toBe('false');
  await widthInput.fill('500');
  await widthInput.blur();
  const heightOff = Number(await heightInput.inputValue());
  console.log(`[1-2] after width=500 (OFF), height=${heightOff}`);
  expect(Math.abs(heightOff - 540)).toBeLessThanOrEqual(0.5);
});
