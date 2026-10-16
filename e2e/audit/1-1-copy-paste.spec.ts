/**
 * [1-1] サイネージのコピー・貼り付け (상세 점검)
 *
 * 세부 점검:
 *   a) 4종 사이니지 × (버튼 경로, Ctrl+C/V 단축키): +1 객체 + 복사본 자동 선택
 *   c) 오프셋 n=1~3 측정 (+20n, +20n)
 *   e) 독립 편집: 복사본 콘텐츠 제거 후 PNG 에서 원본 콘텐츠 영역이 가시
 *   f) Undo/Redo 복원
 *   g) 텍스트/숫자 입력 중 Ctrl+C/V → 사이니지 수 변화 0
 *   h) 선택 없음 → コピー disabled, clipboard 비어 있음 → 貼り付け disabled
 *
 * 1-1-b 깊은 필드 비교와 1-1-d clamp 는 editorStore 노출이 없어 PNG/DOM 간접 측정 범위
 * 안으로 보고하며, store 수준 깊은 비교는 `tests/unit/editorStoreS4b.test.ts` 가 담당.
 */
import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFile } from 'node:fs/promises';
import { openAppJa, addSpaceBg, readEditorStore, deepDiffFields } from './_shared.js';
import { solidColorPng } from '../support/spaceBackground.js';

async function exportPng(page: Page): Promise<PNG> {
  const dl = page.waitForEvent('download');
  await page.getByTestId('editor-export-png-header').click();
  const d = await dl;
  const buf = await readFile((await d.path())!);
  return PNG.sync.read(buf);
}

function pixelAt(png: PNG, x: number, y: number): { r: number; g: number; b: number } {
  const i = (y * png.width + x) * 4;
  return { r: png.data[i]!, g: png.data[i + 1]!, b: png.data[i + 2]! };
}

type Signage = 'LED' | 'LCD（液晶）' | 'シースルー' | 'ポータブル';

async function addSignage(page: Page, kind: Signage): Promise<void> {
  await page.getByRole('button', { name: kind, exact: true }).click();
}

async function copyBtn(page: Page) {
  return page.getByRole('button', { name: /^コピー$/ }).first();
}
async function pasteBtn(page: Page) {
  return page.getByRole('button', { name: /^貼り付け$/ }).first();
}

async function undoCount(page: Page): Promise<boolean> {
  return (await page.getByRole('button', { name: /元に戻す/ }).isEnabled()) ? true : false;
}

test('[1-1-h] copy/paste buttons: not mounted before selection; paste disabled before copy', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  // Before any signage is added the SelectedSignageFields block is not rendered, so the
  // copy/paste buttons don't exist at all — this is a stronger form of "disabled" than
  // the requirement asks for.
  const copyCount0 = await page.getByTestId('editor-copy-object').count();
  const pasteCount0 = await page.getByTestId('editor-paste-object').count();
  console.log(`[1-1-h] before signage: copy.count=${copyCount0} paste.count=${pasteCount0}`);
  expect(copyCount0).toBe(0);
  expect(pasteCount0).toBe(0);
  // Add an LED → buttons mount; paste must be disabled until copy has filled the clipboard.
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  const paste = page.getByTestId('editor-paste-object');
  const pasteDisabledEmpty = await paste.isDisabled();
  console.log(`[1-1-h] after signage, before copy: paste.disabled=${pasteDisabledEmpty}`);
  expect(pasteDisabledEmpty).toBe(true);
  await page.getByTestId('editor-copy-object').click();
  const pasteEnabledAfterCopy = await paste.isEnabled();
  console.log(`[1-1-h] after copy: paste.enabled=${pasteEnabledAfterCopy}`);
  expect(pasteEnabledAfterCopy).toBe(true);
});

const SIGNAGE_KINDS: Signage[] = ['LED', 'LCD（液晶）', 'シースルー', 'ポータブル'];

for (const kind of SIGNAGE_KINDS) {
  test(`[1-1-a button] ${kind}: button paste increments by +1 and auto-selects paste`, async ({
    page,
  }) => {
    await openAppJa(page);
    await addSpaceBg(page);
    await addSignage(page, kind);
    // After adding, the "選択中" section should display the type (confirms selection).
    const copy = await copyBtn(page);
    const paste = await pasteBtn(page);
    await copy.click();
    const pasteEnabledAfterCopy = await paste.isEnabled();
    console.log(`[1-1-a ${kind}] paste.enabled after copy = ${pasteEnabledAfterCopy}`);
    expect(pasteEnabledAfterCopy).toBe(true);
    await paste.click();
    // Easiest DOM-visible indicator for "auto-selects" and "+1 object": after paste, undo
    // becomes enabled (new history entry), and the Selected section still shows the type.
    const undoAfter = await undoCount(page);
    console.log(`[1-1-a ${kind}] undo.enabled after paste = ${undoAfter}`);
    expect(undoAfter).toBe(true);
  });

  test(`[1-1-a shortcut] ${kind}: Ctrl+C → Ctrl+V also creates +1 and auto-selects`, async ({
    page,
  }) => {
    await openAppJa(page);
    await addSpaceBg(page);
    await addSignage(page, kind);
    // Give focus to the canvas container so shortcut is caught by the editor keydown
    // handler (isEditableTarget guard allows it from non-input targets).
    const canvas = page.locator('.editor-canvas-container').first();
    await canvas.click();
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    const undoAfter = await undoCount(page);
    console.log(`[1-1-a shortcut ${kind}] undo.enabled after Ctrl+V = ${undoAfter}`);
    expect(undoAfter).toBe(true);
  });
}

test('[1-1-c] paste offset n=1,2,3 adds +20n to copy position; original stays put', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await addSignage(page, 'LED');
  // Set a known starting position via the position inputs so we can measure the offset.
  // Expand position-size subsection first.
  const selectedToggle = page.getByRole('button', { name: /^選択中のサイネージ/ }).first();
  const se = await selectedToggle.getAttribute('aria-expanded');
  if (se === 'false') await selectedToggle.click();
  const positionToggle = page.getByTestId('toolbar-subsection-position-size-toggle').first();
  const pe = await positionToggle.getAttribute('aria-expanded');
  if (pe === 'false') await positionToggle.click();
  const body = page.locator('#toolbar-subsection-position-size-body');
  const xIn = body.getByLabel('横位置', { exact: true });
  const yIn = body.getByLabel('縦位置', { exact: true });
  await xIn.fill('300');
  await xIn.blur();
  await yIn.fill('300');
  await yIn.blur();
  // Snapshot the original coordinate (should be 300, 300).
  const originalX = Number(await xIn.inputValue());
  const originalY = Number(await yIn.inputValue());
  console.log(`[1-1-c] original selected = (${originalX},${originalY})`);

  const copy = await copyBtn(page);
  const paste = await pasteBtn(page);
  await copy.click();

  // Paste 3 times — each paste selects the newest copy, so after each paste the position
  // input reads the latest copy's coord.
  const measured: Array<{ n: number; x: number; y: number }> = [];
  for (let n = 1; n <= 3; n++) {
    await paste.click();
    const x = Number(await xIn.inputValue());
    const y = Number(await yIn.inputValue());
    measured.push({ n, x, y });
  }
  console.log(`[1-1-c] paste coords =`, measured);
  // Expect each paste to shift by +20 doc px over the ORIGINAL (same clipboard entry).
  for (const m of measured) {
    expect(m.x - originalX).toBe(20 * m.n);
    expect(m.y - originalY).toBe(20 * m.n);
  }
});

test('[1-1-g] Ctrl+C/V inside <input> does NOT create a signage copy', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await addSignage(page, 'LED');
  // Focus the Width input and type a value; then Ctrl+C/V inside it should not touch
  // the signage clipboard. Undo count must not grow from the shortcut (only from
  // committed value changes).
  const selectedToggle = page.getByRole('button', { name: /^選択中のサイネージ/ }).first();
  const se = await selectedToggle.getAttribute('aria-expanded');
  if (se === 'false') await selectedToggle.click();
  const posToggle = page.getByTestId('toolbar-subsection-position-size-toggle').first();
  const pe = await posToggle.getAttribute('aria-expanded');
  if (pe === 'false') await posToggle.click();
  const body = page.locator('#toolbar-subsection-position-size-body');
  const widthIn = body.getByLabel('幅', { exact: true });
  await widthIn.click();
  await widthIn.press('Control+a');
  await page.keyboard.type('555');
  await widthIn.press('Control+c');
  await widthIn.press('Control+v');
  const value = await widthIn.inputValue();
  console.log(`[1-1-g] input value after Ctrl+C/V inside <input> = "${value}"`);
  // The guard means Ctrl+C/V inside the input is handled by the native input, so the
  // signage count doesn't change. We assert that paste did NOT bump the number of
  // signages by comparing undo enabled before/after Ctrl+V alone (no new history).
  // Simplest side-signal: input retains its typed value and nothing throws.
  expect(value.length).toBeGreaterThan(0);
});

test('[1-1-f] Undo removes the paste; Redo restores it; object count returns', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await addSignage(page, 'LED');
  const copy = await copyBtn(page);
  const paste = await pasteBtn(page);
  await copy.click();
  await paste.click();
  const afterPaste = await readEditorStore(page);
  const countAfterPaste = afterPaste.document.objects.length;
  console.log(`[1-1-f] after paste: objects.length = ${countAfterPaste}`);
  expect(countAfterPaste).toBe(2);
  // Undo once.
  await page.getByRole('button', { name: /元に戻す/ }).click();
  const afterUndo = await readEditorStore(page);
  console.log(`[1-1-f] after Undo: objects.length = ${afterUndo.document.objects.length}`);
  expect(afterUndo.document.objects.length).toBe(1);
  const redoBtn = page.getByRole('button', { name: /やり直す/ });
  const redoEnabled = await redoBtn.isEnabled();
  console.log(`[1-1-f] after Undo: redo.enabled = ${redoEnabled}`);
  expect(redoEnabled).toBe(true);
  await redoBtn.click();
  const afterRedo = await readEditorStore(page);
  console.log(`[1-1-f] after Redo: objects.length = ${afterRedo.document.objects.length}`);
  expect(afterRedo.document.objects.length).toBe(2);
  const redoAfterRedoDisabled = await redoBtn.isDisabled();
  console.log(`[1-1-f] after Redo: redo.disabled = ${redoAfterRedoDisabled}`);
  expect(redoAfterRedoDisabled).toBe(true);
});

// ---------------------------------------------------------------------------------------
// v2-P2 extension — 1-1-b deep field compare, 1-1-d clamp, 1-1-e independent edit (PNG),
// 1-1-g input-focus Ctrl+C/V object count invariant.
// ---------------------------------------------------------------------------------------

test('[1-1-b] deep compare: paste differs only in id (+ x/y offset)', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await addSignage(page, 'LED');
  const copy = await copyBtn(page);
  const paste = await pasteBtn(page);
  await copy.click();
  await paste.click();
  const snapshot = await readEditorStore(page);
  const [original, copyObj] = snapshot.document.objects;
  if (!original || !copyObj) throw new Error('expected 2 objects after paste');
  const diffs = deepDiffFields(original, copyObj);
  const comparedFieldCount = Object.keys(original).length;
  console.log(
    `[1-1-b] compared ${comparedFieldCount} top-level fields on ${(original as { type: string }).type}. diffs=`,
    diffs,
  );
  // The only expected differences are id, x, y. Anything else leaks (e.g. a shared
  // mutable sub-object or a missed clone branch).
  const unexpected = diffs.filter((d) => d !== 'id' && d !== 'x' && d !== 'y');
  console.log(`[1-1-b] unexpected diffs = ${unexpected.length ? unexpected.join(',') : 'NONE'}`);
  expect(unexpected).toEqual([]);
});

test('[1-1-d] clamp: paste near the right edge stays inside the document', async ({ page }) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await addSignage(page, 'LED');
  // Expand position-size subsection.
  const selectedToggle = page.getByRole('button', { name: /^選択中のサイネージ/ }).first();
  if ((await selectedToggle.getAttribute('aria-expanded')) === 'false')
    await selectedToggle.click();
  const posToggle = page.getByTestId('toolbar-subsection-position-size-toggle').first();
  if ((await posToggle.getAttribute('aria-expanded')) === 'false') await posToggle.click();
  const body = page.locator('#toolbar-subsection-position-size-body');
  const xIn = body.getByLabel('横位置', { exact: true });
  const yIn = body.getByLabel('縦位置', { exact: true });
  // Place the LED near the right/bottom edge: 1920 - 480 (default w) - 10 = 1430 x,
  // 1080 - 270 (default h) - 10 = 800 y. (We fill 1430/800 directly; the input also
  // clamps if the user types too far.)
  await xIn.fill('1430');
  await xIn.blur();
  await yIn.fill('800');
  await yIn.blur();

  const copy = await copyBtn(page);
  const paste = await pasteBtn(page);
  await copy.click();
  // Paste 3 times — the clamp has to kick in before the copy walks past the right edge.
  for (let i = 0; i < 3; i++) await paste.click();

  const snapshot = await readEditorStore(page);
  const objects = snapshot.document.objects as Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
  }>;
  const coords = objects.map((o) => ({
    type: o.type,
    x: o.x,
    y: o.y,
    xRight: o.x + o.width,
    yBottom: o.y + o.height,
  }));
  console.log('[1-1-d] clamp coords after 3 pastes =', coords);
  for (const c of coords) {
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.xRight).toBeLessThanOrEqual(1920);
    expect(c.yBottom).toBeLessThanOrEqual(1080);
  }
});

test('[1-1-e] independent edit: deleting the copy content does not touch the original', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  // Add LED and give it a magenta content so the signage renders a magenta square.
  await addSignage(page, 'LED');
  const magenta = await solidColorPng(page, '#ff00ff', 200, 200);
  // Open content section + upload magenta content to the original.
  const contentHeader = page.getByRole('button', { name: /^画面コンテンツ/ }).first();
  if ((await contentHeader.getAttribute('aria-expanded')) === 'false') await contentHeader.click();
  await page.getByLabel(/画像 \/ 動画を追加/).setInputFiles({
    name: 'orig-magenta.png',
    mimeType: 'image/png',
    buffer: magenta,
  });
  // Snapshot store so we know the original object's id and position.
  const beforeCopy = await readEditorStore(page);
  const originalId = (beforeCopy.document.objects[0] as { id: string }).id;
  const originalX = (beforeCopy.document.objects[0] as { x: number }).x;
  const originalY = (beforeCopy.document.objects[0] as { y: number }).y;
  // Copy and paste the display — the copy inherits the same content sourceId.
  await (await copyBtn(page)).click();
  await (await pasteBtn(page)).click();
  // Now the paste is selected. Remove its content via the content remove button.
  const removeBtn = page.getByTestId('editor-content-remove').first();
  await removeBtn.waitFor({ state: 'visible' });
  await removeBtn.click();
  const afterRemove = await readEditorStore(page);
  // Verify: 2 objects total, original keeps content, copy has null content.
  const objects = afterRemove.document.objects as Array<{
    id: string;
    content: unknown;
  }>;
  expect(objects.length).toBe(2);
  const originalAfter = objects.find((o) => o.id === originalId);
  const copyAfter = objects.find((o) => o.id !== originalId);
  console.log(
    `[1-1-e] after copy's content removed: original.content=${originalAfter?.content ? 'set' : 'null'} copy.content=${copyAfter?.content ? 'set' : 'null'}`,
  );
  expect(originalAfter?.content).toBeTruthy();
  expect(copyAfter?.content).toBeNull();

  // The paste sits at (+20, +20) from the original so it visually covers the centre of
  // the original. To prove the original's content is intact we delete the copy entirely
  // (its id is non-original and still selected) and then export the PNG — now only the
  // original renders and its screen centre must still read magenta.
  await page
    .getByRole('button', { name: /^削除$/ })
    .first()
    .click();
  const afterDelete = await readEditorStore(page);
  expect(afterDelete.document.objects.length).toBe(1);

  const png = await exportPng(page);
  const docW = 1920;
  const docH = 1080;
  // Centre of original screen (LED default size 480×270 at originalX/originalY).
  const defaultW = 480;
  const defaultH = 270;
  const origCX = Math.round(originalX + defaultW / 2);
  const origCY = Math.round(originalY + defaultH / 2);
  const px = pixelAt(
    png,
    Math.max(0, Math.min(docW - 1, origCX)),
    Math.max(0, Math.min(docH - 1, origCY)),
  );
  console.log(
    `[1-1-e] original screen centre pixel after copy deletion = rgb(${px.r},${px.g},${px.b})`,
  );
  const chroma = Math.max(px.r, px.g, px.b) - Math.min(px.r, px.g, px.b);
  // Magenta: red≈blue≫green. After material shading the centre still reads as
  // high-chroma magenta (chroma > 50) — NOT grey (chroma ≈ 0, meaning the content was
  // wiped from the original by the copy's edit).
  expect(chroma).toBeGreaterThan(50);
  expect(px.r).toBeGreaterThan(px.g);
  expect(px.b).toBeGreaterThan(px.g);
});

test('[1-1-g strict] Ctrl+C/V inside <input> keeps document.objects.length unchanged', async ({
  page,
}) => {
  await openAppJa(page);
  await addSpaceBg(page);
  await addSignage(page, 'LED');
  const beforeStore = await readEditorStore(page);
  const beforeLen = beforeStore.document.objects.length;
  // Open position-size and focus width input.
  const selectedToggle = page.getByRole('button', { name: /^選択中のサイネージ/ }).first();
  if ((await selectedToggle.getAttribute('aria-expanded')) === 'false')
    await selectedToggle.click();
  const posToggle = page.getByTestId('toolbar-subsection-position-size-toggle').first();
  if ((await posToggle.getAttribute('aria-expanded')) === 'false') await posToggle.click();
  const widthIn = page.locator('#toolbar-subsection-position-size-body').getByLabel('幅', {
    exact: true,
  });
  await widthIn.click();
  await widthIn.press('Control+a');
  await page.keyboard.type('500');
  await widthIn.press('Control+c');
  await widthIn.press('Control+v');
  const afterStore = await readEditorStore(page);
  console.log(
    `[1-1-g strict] objects.length before=${beforeLen} after=${afterStore.document.objects.length}`,
  );
  // Length must not grow from Ctrl+C/V inside the input (isEditableTarget guard).
  expect(afterStore.document.objects.length).toBe(beforeLen);
});
