/**
 * [3-5] 手前の物で隠す（マスク）의 목적 명확화·단축 — 상세 점검
 *
 * - 3-5-a 명칭 「手前の物で隠す（マスク）」 노출
 * - 3-5-b 4번째 점 찍은 뒤 「適用」 버튼 enabled + 가시
 * - 3-5-c 단계 안내: 점 수 <4 → ステップ①, ≥4 → ステップ②, 상시 ステップ③
 */
import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFile } from 'node:fs/promises';
import { openAppJa, addSpaceBg, expandSection, readEditorStore } from './_shared.js';
import { solidColorPng } from '../support/spaceBackground.js';
import { deltaE76 } from '../../src/lib/colorDeltaE.js';

async function exportPng(page: Page): Promise<PNG> {
  const dl = page.waitForEvent('download');
  await page.getByTestId('editor-export-png-header').click();
  const d = await dl;
  const buf = await readFile((await d.path())!);
  return PNG.sync.read(buf);
}

async function placeFourMaskPoints(page: Page) {
  const canvasRect = await page.locator('.editor-canvas-container').first().boundingBox();
  if (!canvasRect) throw new Error('no canvas');
  const pts = [
    { x: canvasRect.x + canvasRect.width * 0.4, y: canvasRect.y + canvasRect.height * 0.4 },
    { x: canvasRect.x + canvasRect.width * 0.6, y: canvasRect.y + canvasRect.height * 0.4 },
    { x: canvasRect.x + canvasRect.width * 0.6, y: canvasRect.y + canvasRect.height * 0.6 },
    { x: canvasRect.x + canvasRect.width * 0.4, y: canvasRect.y + canvasRect.height * 0.6 },
  ];
  for (const p of pts) await page.mouse.click(p.x, p.y);
}

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

// --------------------------------------------------------------------------------------
// v2-P2 extensions: 3-5-e (ΔE), 3-5-f (cancel → 0 masks), 3-5-g (Undo/Redo per op).
// --------------------------------------------------------------------------------------

test('[3-5-e] applied mask covers signage pixels with the space photo (CIE Lab ΔE ≤ 10)', async ({
  page,
}) => {
  await openAppJa(page);
  // Load a distinct magenta space photo so the "space colour" is unambiguously identifiable.
  const magentaBg = await solidColorPng(page, '#ff00ff', 1920, 1080);
  await addSpaceBg(page, { file: magentaBg });
  // Add LED with no content so the signage body renders as grey material.
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);

  // Sample a pixel at the LED's screen centre BEFORE the mask: should be grey/dark (not
  // magenta) since no content yet.
  const pngBefore = await exportPng(page);
  const docW = pngBefore.width;
  const docH = pngBefore.height;
  const cx = Math.floor(docW / 2);
  const cy = Math.floor(docH / 2);
  const i = (cy * docW + cx) * 4;
  const beforePix = {
    r: pngBefore.data[i]!,
    g: pngBefore.data[i + 1]!,
    b: pngBefore.data[i + 2]!,
  };
  const spaceColor = { r: 255, g: 0, b: 255 };
  const deBefore = deltaE76(beforePix, spaceColor);
  console.log(
    `[3-5-e] before mask: pixel at centre = rgb(${beforePix.r},${beforePix.g},${beforePix.b}) ΔE to space(#FF00FF) = ${deBefore.toFixed(2)}`,
  );
  expect(deBefore).toBeGreaterThan(20); // LED signage body != magenta

  // Draw a mask covering the signage centre and apply.
  await page.getByTestId('editor-occlusion-add').click();
  await placeFourMaskPoints(page);
  const applyBtn = page.getByTestId('editor-occlusion-apply');
  await applyBtn.click();
  // Export again and sample the same centre pixel: should now read as the space photo
  // (magenta) because the mask "hides" the signage behind the space photo.
  const pngAfter = await exportPng(page);
  const j = (cy * docW + cx) * 4;
  const afterPix = {
    r: pngAfter.data[j]!,
    g: pngAfter.data[j + 1]!,
    b: pngAfter.data[j + 2]!,
  };
  const deAfter = deltaE76(afterPix, spaceColor);
  console.log(
    `[3-5-e] after mask: pixel at centre = rgb(${afterPix.r},${afterPix.g},${afterPix.b}) ΔE to space(#FF00FF) = ${deAfter.toFixed(2)}`,
  );
  expect(deAfter).toBeLessThanOrEqual(10);
});

test('[3-5-f] cancel after drawing points → 0 masks on the object', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);
  const beforeStore = await readEditorStore(page);
  const beforeMasks = (beforeStore.document.objects[0] as { occlusionMasks: unknown[] })
    .occlusionMasks.length;
  console.log(`[3-5-f] before Add: masks=${beforeMasks}`);
  expect(beforeMasks).toBe(0);
  await page.getByTestId('editor-occlusion-add').click();
  await placeFourMaskPoints(page);
  // Cancel instead of Apply.
  await page.getByRole('button', { name: 'キャンセル', exact: true }).first().click();
  const afterStore = await readEditorStore(page);
  const afterMasks = (afterStore.document.objects[0] as { occlusionMasks: unknown[] })
    .occlusionMasks.length;
  console.log(`[3-5-f] after Cancel: masks=${afterMasks}`);
  expect(afterMasks).toBe(0);
});

test('[3-5-g] Add → Edit → Delete each produces a reversible history entry', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /サイネージ外観の調整/);

  // --- Add + Apply (creates 1 mask).
  await page.getByTestId('editor-occlusion-add').click();
  await placeFourMaskPoints(page);
  await page.getByTestId('editor-occlusion-apply').click();
  const addedStore = await readEditorStore(page);
  const ledId = (addedStore.document.objects[0] as { id: string }).id;
  const addedMasks = (addedStore.document.objects[0] as { occlusionMasks: unknown[] })
    .occlusionMasks.length;
  console.log(`[3-5-g] after Add: masks=${addedMasks} past.length=${addedStore.past.length}`);
  expect(addedMasks).toBe(1);

  // --- Undo removes the mask. Redo restores it.
  await page.getByRole('button', { name: /元に戻す/ }).click();
  // undo clears selectedId. Re-select the LED and re-check masks.
  await page.evaluate((id) => {
    const w = window as unknown as {
      __editorStoreGetState?: () => { selectObject: (id: string | null) => void };
    };
    w.__editorStoreGetState?.().selectObject(id);
  }, ledId);
  const undoAdd = await readEditorStore(page);
  const undoAddMasks = (undoAdd.document.objects[0] as { occlusionMasks: unknown[] }).occlusionMasks
    .length;
  console.log(`[3-5-g] after Undo Add: masks=${undoAddMasks}`);
  expect(undoAddMasks).toBe(0);
  await page.getByRole('button', { name: /やり直す/ }).click();
  await page.evaluate((id) => {
    const w = window as unknown as {
      __editorStoreGetState?: () => { selectObject: (id: string | null) => void };
    };
    w.__editorStoreGetState?.().selectObject(id);
  }, ledId);
  const redoAdd = await readEditorStore(page);
  const redoAddMasks = (redoAdd.document.objects[0] as { occlusionMasks: unknown[] }).occlusionMasks
    .length;
  console.log(`[3-5-g] after Redo Add: masks=${redoAddMasks}`);
  expect(redoAddMasks).toBe(1);

  // --- Delete the mask (via list delete button).
  const deleteBtn = page.getByRole('button', { name: /^削除$/ }).last();
  await deleteBtn.click();
  await page.evaluate((id) => {
    const w = window as unknown as {
      __editorStoreGetState?: () => { selectObject: (id: string | null) => void };
    };
    w.__editorStoreGetState?.().selectObject(id);
  }, ledId);
  const afterDelete = await readEditorStore(page);
  const deletedMasks = (afterDelete.document.objects[0] as { occlusionMasks: unknown[] })
    .occlusionMasks.length;
  console.log(`[3-5-g] after Delete mask: masks=${deletedMasks}`);
  expect(deletedMasks).toBe(0);

  // Undo the deletion → mask comes back.
  await page.getByRole('button', { name: /元に戻す/ }).click();
  await page.evaluate((id) => {
    const w = window as unknown as {
      __editorStoreGetState?: () => { selectObject: (id: string | null) => void };
    };
    w.__editorStoreGetState?.().selectObject(id);
  }, ledId);
  const undoDelete = await readEditorStore(page);
  const undoDeleteMasks = (undoDelete.document.objects[0] as { occlusionMasks: unknown[] })
    .occlusionMasks.length;
  console.log(`[3-5-g] after Undo Delete: masks=${undoDeleteMasks}`);
  expect(undoDeleteMasks).toBe(1);
});
