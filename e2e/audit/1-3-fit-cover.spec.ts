/**
 * [1-3] 設置場所の写真の表示方法 (Fit / Cover)
 *
 * 측정: 기본값이 Fit 인지, Cover 로 전환하면 안내문이 나오는지.
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg } from './_shared.js';

test('[1-3] default is Fit; Cover shows the cropping hint', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  const fit = page.getByTestId('editor-space-background-fit-contain');
  const cover = page.getByTestId('editor-space-background-fit-cover');
  await fit.waitFor({ state: 'visible' });
  const fitPressed = await fit.getAttribute('aria-pressed');
  const coverPressed = await cover.getAttribute('aria-pressed');
  console.log(`[1-3] default fit=${fitPressed} cover=${coverPressed}`);
  expect(fitPressed).toBe('true');
  expect(coverPressed).toBe('false');

  await cover.click();
  const nowCover = await cover.getAttribute('aria-pressed');
  expect(nowCover).toBe('true');
  const hintVisible = await page
    .getByText('写真の一部が切れて表示される場合があります。')
    .isVisible();
  console.log(`[1-3] cover hint visible = ${hintVisible}`);
  expect(hintVisible).toBe(true);
});
