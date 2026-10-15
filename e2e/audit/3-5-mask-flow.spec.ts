/**
 * [3-5] 手前の物で隠す（マスク）의 목적 명확화·단축 — 상세 점검
 *
 * - 3-5-a 명칭 「手前の物で隠す（マスク）」 노출
 * - 3-5-b 4번째 점 찍은 뒤 「適用」 버튼 enabled + 가시
 * - 3-5-c 단계 안내: 점 수 <4 → ステップ①, ≥4 → ステップ②, 상시 ステップ③
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg, expandSection } from './_shared.js';

test('[3-5-a/b] label + Apply visible after 4-th point without re-opening any panel', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);
  const sub = page.getByTestId('occlusion-inline-subsection');
  await sub.waitFor({ state: 'visible' });
  const subText = (await sub.innerText()).trim();
  console.log(`[3-5-a] subsection text = ${JSON.stringify(subText)}`);
  expect(subText).toContain('手前の物で隠す（マスク）');

  await page.getByTestId('editor-occlusion-add').click();
  const canvasRect = await page.locator('.editor-canvas-container').first().boundingBox();
  if (!canvasRect) throw new Error('no canvas');
  const pts = [
    { x: canvasRect.x + canvasRect.width * 0.35, y: canvasRect.y + canvasRect.height * 0.35 },
    { x: canvasRect.x + canvasRect.width * 0.65, y: canvasRect.y + canvasRect.height * 0.35 },
    { x: canvasRect.x + canvasRect.width * 0.65, y: canvasRect.y + canvasRect.height * 0.65 },
    { x: canvasRect.x + canvasRect.width * 0.35, y: canvasRect.y + canvasRect.height * 0.65 },
  ];
  for (const p of pts) await page.mouse.click(p.x, p.y);
  const applyBtn = page.getByTestId('editor-occlusion-apply');
  await applyBtn.waitFor({ state: 'visible' });
  const disabled = await applyBtn.getAttribute('disabled');
  console.log(`[3-5-b] applyBtn disabled=${disabled}`);
  expect(disabled).toBeNull();
});

test('[3-5-c] step indicator present and switches ① ↔ ② with point count', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);
  await page.getByTestId('editor-occlusion-add').click();

  // Right after entering draft (0 points): step ① visible with aria-current=step.
  const stepIndicator = page.getByTestId('editor-occlusion-step-indicator');
  await stepIndicator.waitFor({ state: 'visible' });
  const beforeHtml = await stepIndicator.innerHTML();
  console.log('[3-5-c] step-indicator initial HTML =', beforeHtml);
  const items0 = await stepIndicator.locator('li').allInnerTexts();
  console.log('[3-5-c] items @0 points =', items0);
  // 2 lines: primary (step1) + persistent step3.
  expect(items0.length).toBe(2);
  expect(items0[0]).toContain('4点');
  expect(items0[1]).toContain('適用');
  const activeAt0 = await stepIndicator
    .locator('li[aria-current="step"]')
    .innerText()
    .catch(() => '');
  console.log('[3-5-c] aria-current @0 =', JSON.stringify(activeAt0));
  expect(activeAt0).toContain('4点');

  // Place 4 points.
  const canvasRect = await page.locator('.editor-canvas-container').first().boundingBox();
  if (!canvasRect) throw new Error('no canvas');
  const pts = [
    { x: canvasRect.x + canvasRect.width * 0.35, y: canvasRect.y + canvasRect.height * 0.35 },
    { x: canvasRect.x + canvasRect.width * 0.65, y: canvasRect.y + canvasRect.height * 0.35 },
    { x: canvasRect.x + canvasRect.width * 0.65, y: canvasRect.y + canvasRect.height * 0.65 },
    { x: canvasRect.x + canvasRect.width * 0.35, y: canvasRect.y + canvasRect.height * 0.65 },
  ];
  for (const p of pts) await page.mouse.click(p.x, p.y);

  const items4 = await stepIndicator.locator('li').allInnerTexts();
  console.log('[3-5-c] items @4 points =', items4);
  expect(items4[0]).toContain('位置を調整');
  expect(items4[1]).toContain('適用');
  const activeAt4 = await stepIndicator
    .locator('li[aria-current="step"]')
    .allInnerTexts()
    .catch(() => []);
  console.log('[3-5-c] aria-current @4 =', activeAt4);
  // At 4 points, step ① is complete so nothing has aria-current=step (both are informational).
  expect(activeAt4.length).toBe(0);
});
