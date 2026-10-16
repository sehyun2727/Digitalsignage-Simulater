/**
 * [3-2] アップロード条件の事前案内
 *
 * 측정: 공간 사진·콘텐츠 업로드 버튼 옆의 힌트 문구 안에 상수(폼팻, 용량, 해상도, 길이)가
 * 포함돼 있는지 확인한다.
 */
import { test, expect } from '@playwright/test';
import { openAppJa, addSpaceBg, expandSection } from './_shared.js';

test('[3-2] upload hints include format/size/dimension/duration constants', async ({ page }) => {
  await openAppJa(page);

  // Space photo hint — before any upload, it should be visible in the Space section.
  const spaceHint = page.getByTestId('editor-space-background-upload-hint');
  await spaceHint.waitFor({ state: 'visible' });
  const spaceHintText = await spaceHint.innerText();
  console.log(`[3-2] space hint = ${JSON.stringify(spaceHintText)}`);
  expect(spaceHintText).toMatch(/PNG|JPEG|WebP/);
  expect(spaceHintText).toMatch(/MB/);
  expect(spaceHintText).toMatch(/px/);

  // Add space to unlock signage, then add LED to make the content section active.
  await addSpaceBg(page);
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await expandSection(page, /画面コンテンツ/);

  const imageHint = page.getByTestId('editor-content-upload-hint-image');
  const videoHint = page.getByTestId('editor-content-upload-hint-video');
  await imageHint.waitFor({ state: 'visible' });
  const imageHintText = await imageHint.innerText();
  const videoHintText = await videoHint.innerText();
  console.log(`[3-2] content image hint = ${JSON.stringify(imageHintText)}`);
  console.log(`[3-2] content video hint = ${JSON.stringify(videoHintText)}`);
  expect(imageHintText).toMatch(/MB/);
  expect(imageHintText).toMatch(/px/);
  expect(videoHintText).toMatch(/MB/);
  expect(videoHintText).toMatch(/\d+秒/);
  expect(videoHintText).toMatch(/4K|3840/);
});
