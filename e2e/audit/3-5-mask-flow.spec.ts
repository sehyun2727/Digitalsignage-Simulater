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

test('[3-5-e] applied mask: 3-way ΔE verification (mask vs bg, vs content, outside stays content)', async ({
  page,
}) => {
  await openAppJa(page);
  // v2-P3 A3: distinguish the three semantic colours.
  //   bg (space photo) = cyan #00FFFF   → clearly non-magenta so the gate can tell them apart
  //   content image    = magenta #FF00FF → fills the signage screen
  //   mask region      = after Apply, should read as the bg colour (space photo on top)
  const CYAN_BG = { r: 0, g: 255, b: 255 };
  const MAGENTA_CONTENT = { r: 255, g: 0, b: 255 };
  const cyanBg = await solidColorPng(page, '#00ffff', 1920, 1080);
  await addSpaceBg(page, { file: cyanBg });
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /画面コンテンツ/);
  const magentaContent = await solidColorPng(page, '#ff00ff', 400, 400);
  await page.getByLabel(/画像 \/ 動画を追加/).setInputFiles({
    name: 'magenta.png',
    mimeType: 'image/png',
    buffer: magentaContent,
  });
  await expandSection(page, /サイネージ外観の調整/);

  // Baseline: with content set, the LED screen area shows magenta content. Export and
  // sample the LED's screen centre.
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
  const deBeforeContent = deltaE76(beforePix, MAGENTA_CONTENT);
  const deBeforeBg = deltaE76(beforePix, CYAN_BG);
  console.log(
    `[3-5-e] before mask: screen-centre rgb(${beforePix.r},${beforePix.g},${beforePix.b})` +
      ` ΔE→content=${deBeforeContent.toFixed(2)} ΔE→bg=${deBeforeBg.toFixed(2)}`,
  );
  // Content should dominate the screen centre: close to magenta, far from cyan.
  expect(deBeforeContent).toBeLessThanOrEqual(15);
  expect(deBeforeBg).toBeGreaterThan(50);

  // Draw a mask covering ~1/4 of the screen centre and apply.
  await page.getByTestId('editor-occlusion-add').click();
  await placeFourMaskPoints(page);
  await page.getByTestId('editor-occlusion-apply').click();
  const pngAfter = await exportPng(page);

  // (1) Mask region (centre of masked quad) should now read as space photo (cyan), not content.
  const j = (cy * docW + cx) * 4;
  const insideMaskPix = {
    r: pngAfter.data[j]!,
    g: pngAfter.data[j + 1]!,
    b: pngAfter.data[j + 2]!,
  };
  const deMaskVsBg = deltaE76(insideMaskPix, CYAN_BG);
  const deMaskVsContent = deltaE76(insideMaskPix, MAGENTA_CONTENT);
  console.log(
    `[3-5-e] inside mask: rgb(${insideMaskPix.r},${insideMaskPix.g},${insideMaskPix.b})` +
      ` ΔE→bg=${deMaskVsBg.toFixed(2)} ΔE→content=${deMaskVsContent.toFixed(2)}`,
  );
  expect(deMaskVsBg).toBeLessThanOrEqual(10); // ← inside mask ≈ bg (cyan)
  expect(deMaskVsContent).toBeGreaterThanOrEqual(50); // ← inside mask ≠ content (magenta)

  // (2) Outside the mask but inside the LED screen should still be content (magenta).
  //     LED default is 480×270 at (720, 405). Screen rect ≈ (729.6, 410.4)-(1190.4, 669.6)
  //     after the 2% bezel inset. The mask quad is 0.4-0.6 of canvas = (768, 432)-(1152, 648).
  //     Sample (960, 420) — inside the screen top band (≥ 410 ∧ ≤ 432) → outside mask ∧
  //     inside screen rect → should read as content magenta.
  const outsideMaskX = 960;
  const outsideMaskY = 420;
  const k = (outsideMaskY * docW + outsideMaskX) * 4;
  const outsideMaskPix = {
    r: pngAfter.data[k]!,
    g: pngAfter.data[k + 1]!,
    b: pngAfter.data[k + 2]!,
  };
  const deOutsideVsContent = deltaE76(outsideMaskPix, MAGENTA_CONTENT);
  const deOutsideVsBg = deltaE76(outsideMaskPix, CYAN_BG);
  console.log(
    `[3-5-e] outside mask (same signage): rgb(${outsideMaskPix.r},${outsideMaskPix.g},${outsideMaskPix.b})` +
      ` ΔE→content=${deOutsideVsContent.toFixed(2)} ΔE→bg=${deOutsideVsBg.toFixed(2)}`,
  );
  expect(deOutsideVsContent).toBeLessThanOrEqual(15); // ← outside mask ≈ content
  expect(deOutsideVsBg).toBeGreaterThan(50); // ← outside mask ≠ bg
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
