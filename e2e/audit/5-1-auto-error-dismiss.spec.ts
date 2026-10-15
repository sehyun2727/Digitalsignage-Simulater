/**
 * [5-1] 正常ファイル差し替え後のエラー自動消去
 *
 * 측정: 공간 사진에 10MB 초과 파일 → 에러 배너 노출 → 정상 파일 → 에러 배너 사라짐.
 */
import { test, expect } from '@playwright/test';
import { openAppJa } from './_shared.js';
import { solidColorPng } from '../support/spaceBackground.js';

test('[5-1] error banner clears once a valid file is uploaded for the same source', async ({
  page,
}) => {
  await openAppJa(page);

  const big = Buffer.alloc(11 * 1024 * 1024, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(big, 0);
  await page.getByLabel('設置場所の写真を追加').setInputFiles({
    name: 'oversize.png',
    mimeType: 'image/png',
    buffer: big,
  });

  const banner = page.getByRole('alert').first();
  await banner.waitFor({ state: 'visible', timeout: 10000 });
  const t1 = await banner.innerText();
  console.log(`[5-1] errorBefore = ${JSON.stringify(t1)}`);

  // Replace with a valid file.
  const good = await solidColorPng(page, '#334455', 1920, 1080);
  await page.getByLabel('設置場所の写真を追加').setInputFiles({
    name: 'good.png',
    mimeType: 'image/png',
    buffer: good,
  });

  await banner.waitFor({ state: 'detached', timeout: 10000 });
  const afterCount = await page.getByRole('alert').count();
  console.log(`[5-1] errorAfter: role=alert count = ${afterCount}`);
  expect(afterCount).toBe(0);
});
