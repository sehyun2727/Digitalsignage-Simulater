import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { openSection } from './support/accordion.js';
import { addSpaceBackground } from './support/spaceBackground.js';

// v2-S4 Step 0-3. The exported Stage box (.konvajs-content) is the single surface the
// user can draw into; freezing its outer rectangle across every supported viewport × preset
// is the runtime half of the canvas-freeze guard. The structural half is the SHA check
// (`npm run check:canvas`). Any size/position drift here means someone touched a value
// listed under CLAUDE.md §4bis "동결 대상" without going through [canvas-approved].

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const freeze = JSON.parse(
  readFileSync(join(__dirname, '..', 'docs', 'v2', 'canvas-freeze.json'), 'utf8'),
);
const SELECTOR: string = freeze.stage.selector;
const TOLERANCE: number = freeze.stage.tolerance_px;

interface Scenario {
  viewport: { w: number; h: number };
  preset: 'landscape' | 'portrait';
  x: number;
  y: number;
  width: number;
  height: number;
}

for (const scenario of freeze.stage.scenarios as Scenario[]) {
  const label = `canvas-freeze ${scenario.viewport.w}x${scenario.viewport.h} ${scenario.preset}`;
  test(label, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: scenario.viewport.w, height: scenario.viewport.h },
      locale: 'ja-JP',
    });
    const page = await ctx.newPage();
    await page.goto('/');
    if (scenario.preset === 'portrait') {
      await openSection(page, 'space');
      const portraitBtn = page.getByRole('button', { name: /縦長/ });
      if ((await portraitBtn.count()) > 0) await portraitBtn.first().click();
    }
    // Load a photo so the Stage renders at its full fitted box (nophoto still renders the
    // Stage, but with the shell's status-area/hint area layout the position is the same —
    // the baseline table was recorded with a photo for parity with the L1 photo variant).
    await addSpaceBackground(page, {
      width: scenario.preset === 'landscape' ? 1920 : 1080,
      height: scenario.preset === 'landscape' ? 1080 : 1920,
    });
    // Give the ResizeObserver one more frame so the Stage bbox settles.
    await page.waitForTimeout(100);
    const box = await page.locator(SELECTOR).boundingBox();
    expect(box, `${label}: ${SELECTOR} must render`).not.toBeNull();
    const actual = box!;
    const log = `${label} actual={x=${actual.x.toFixed(2)},y=${actual.y.toFixed(2)},w=${actual.width.toFixed(2)},h=${actual.height.toFixed(2)}} expected={x=${scenario.x},y=${scenario.y},w=${scenario.width},h=${scenario.height}}`;
    console.log(log);
    expect(Math.abs(actual.x - scenario.x), `${label} Stage.x drift`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(Math.abs(actual.y - scenario.y), `${label} Stage.y drift`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(
      Math.abs(actual.width - scenario.width),
      `${label} Stage.width drift`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      Math.abs(actual.height - scenario.height),
      `${label} Stage.height drift`,
    ).toBeLessThanOrEqual(TOLERANCE);
    await ctx.close();
  });
}
