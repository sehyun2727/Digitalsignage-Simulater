/**
 * [3-5] モザイクの手順簡略化 + 명칭 확인
 *
 * - 「手前の物で隠す（マスク）」 명칭 노출
 * - 「追加」 클릭 수를 세고 적용까지의 조작 수 확인
 * - 4 번째 점을 찍은 뒤 '適用' 버튼이 다시 열기 없이 노출되는지
 * - 단계 안내 「ステップ…/隠したい範囲の角をクリック…」 이 있는지(없으면 null 로 보고)
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg, expandSection } from './_shared.js';

test('[3-5] mask flow: inline Apply visible after 4-th point, label matches glossary', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);

  // Check the label text — glossary ① calls it 「手前の物で隠す（マスク）」.
  const subsection = page.getByTestId('occlusion-inline-subsection');
  await subsection.waitFor({ state: 'visible' });
  const subsectionText = (await subsection.innerText()).trim();
  console.log('[3-5] subsectionText =', JSON.stringify(subsectionText));
  expect(subsectionText).toContain('手前の物で隠す（マスク）');

  // "追加" button is inside the subsection.
  const addBtn = page.getByTestId('editor-occlusion-add');
  await addBtn.click();

  // Draw 4 points inside the canvas. Use evaluate to find canvas rect.
  const canvasRect = await page.locator('.editor-canvas-container').first().boundingBox();
  if (!canvasRect) throw new Error('canvas rect not found');
  const cx = canvasRect.x;
  const cy = canvasRect.y;
  const cw = canvasRect.width;
  const ch = canvasRect.height;
  const pts = [
    { x: cx + cw * 0.35, y: cy + ch * 0.35 },
    { x: cx + cw * 0.65, y: cy + ch * 0.35 },
    { x: cx + cw * 0.65, y: cy + ch * 0.65 },
    { x: cx + cw * 0.35, y: cy + ch * 0.65 },
  ];
  for (const p of pts) {
    await page.mouse.click(p.x, p.y);
  }

  // Apply button must be visible and enabled WITHOUT having to re-open the detail panel.
  const applyBtn = page.getByTestId('editor-occlusion-apply');
  await applyBtn.waitFor({ state: 'visible' });
  const disabled = await applyBtn.getAttribute('disabled');
  const text = await applyBtn.textContent();
  console.log(`[3-5] applyBtn text="${text?.trim()}" disabled=${disabled}`);
  expect(disabled).toBeNull();

  // Check for step-indicator pattern — glossary ② specifies 「ステップ{current}/{total}」.
  const stepPresent = subsectionText.includes('ステップ');
  console.log(`[3-5] stepIndicatorPresent = ${stepPresent}`);
  // Report-only; do not fail if missing.
});
