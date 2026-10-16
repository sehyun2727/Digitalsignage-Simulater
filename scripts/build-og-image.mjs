#!/usr/bin/env node
// v2-release R2: generate a 1200×630 Open Graph preview PNG. Social media crawlers
// (Twitter/X, Facebook, LINE) expect a raster og:image at this exact aspect ratio to
// render the "summary_large_image" card. Previously the og:image meta pointed at the
// tiny 80×26 HULL watermark SVG, which crawlers either rejected (no vector support) or
// stretched into an unreadable sliver. This script composes a dark card with the HULL
// mark centered.
//
// Output: public/assets/brand/og-image.png (checked into git — the build step just
// copies it through Vite's static-assets pipeline). Re-run after changing the mark or
// the layout; a visual-regression check in CI would be overkill for a one-shot asset.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const SVG_PATH = resolve(ROOT, 'public/assets/brand/hull-watermark.svg');
const OUT_PATH = resolve(ROOT, 'public/assets/brand/og-image.png');

const CANVAS_W = 1200;
const CANVAS_H = 630;
const BG = { r: 11, g: 15, b: 25, alpha: 1 }; // #0b0f19 — close to the app's dark backing
const MARK_HEIGHT = 160; // visually balanced on a 630-tall canvas
const MARK_ASPECT = 80 / 26; // from the SVG viewBox
const MARK_WIDTH = Math.round(MARK_HEIGHT * MARK_ASPECT); // ≈ 492

async function main() {
  const svgRaw = await readFile(SVG_PATH, 'utf8');
  // Replace the fill="none" + white strokes on the mark so the logo reads as white against
  // the dark background. The source SVG uses stroked letters with no explicit fill — Sharp
  // renders those as transparent on the dark bg, which is what we want for a logo card.
  // Keep the SVG as-is and let the vector render against the dark background.
  const markBuffer = await sharp(Buffer.from(svgRaw), { density: 320 })
    .resize({ width: MARK_WIDTH, height: MARK_HEIGHT, fit: 'contain' })
    .png()
    .toBuffer();

  const canvas = sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: BG },
  })
    .composite([
      {
        input: markBuffer,
        left: Math.round((CANVAS_W - MARK_WIDTH) / 2),
        top: Math.round((CANVAS_H - MARK_HEIGHT) / 2),
      },
    ])
    .png({ compressionLevel: 9 });

  const png = await canvas.toBuffer();
  await writeFile(OUT_PATH, png);
  const { size, width, height } = await sharp(png).metadata();
  console.log(`og:image written → ${OUT_PATH}`);
  console.log(`  dimensions: ${width}×${height}px, ${size ?? png.length} bytes`);
  if (width !== CANVAS_W || height !== CANVAS_H) {
    throw new Error(`unexpected dimensions ${width}×${height}, want ${CANVAS_W}×${CANVAS_H}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
