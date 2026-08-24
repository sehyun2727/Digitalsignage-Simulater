import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from '@playwright/test';
import { addSpaceBackground } from './support/spaceBackground.js';

/**
 * Not a functional test — this spec exists purely to produce one full-page PNG per portable
 * template view so a human (or the Claude Code agent driving this branch) can look at what
 * the current template body actually renders as, at each of the three views. Assertions are
 * deliberately absent; the file's job is to write screenshots to tmp/portable-views/ and let
 * the reviewer read the pixels back.
 */

const VIEWS = ['angled-left', 'front', 'angled-right'] as const;

test.use({ locale: 'ja-JP', viewport: { width: 1600, height: 1000 } });

test('captures all portable template views', async ({ page }) => {
  const outDir = path.resolve(process.cwd(), 'tmp/portable-views');
  await fs.mkdir(outDir, { recursive: true });

  await page.goto('/');
  await addSpaceBackground(page, { width: 1600, height: 900, color: '#1e2530' });

  await page.getByRole('button', { name: 'ポータブル製品を追加' }).click();
  const viewSelect = page.getByRole('combobox', { name: 'ビュー' });

  for (const view of VIEWS) {
    await viewSelect.selectOption(view);
    // Wait long enough for the async image decode inside PortableTemplateBody to complete
    // and Konva to redraw with the loaded bitmap; without this a fresh open can capture the
    // black screen backdrop without its underlying photograph.
    await page.waitForTimeout(400);
    const stage = page.locator('.editor-canvas-container').first();
    const target = (await stage.count()) > 0 ? stage : page;
    await target.screenshot({ path: path.join(outDir, `${view}.png`) });
  }
});
