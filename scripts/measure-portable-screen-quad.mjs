#!/usr/bin/env node
/**
 * Scans src/assets/portable/{front,angled}.png and prints pixel-accurate screen
 * quad corners for each. "Screen" == the food-photo display opening, i.e. NOT
 * the white bezel around it.
 *
 * Algorithm:
 *  1. Decode the PNG.
 *  2. Classify every pixel as bezel-white vs non-bezel. The bezel is very
 *     desaturated *and* very bright (near pure white); anything else — including
 *     the food photo's own white plates, since they're inside colorful content
 *     region and slightly warm-toned — is "not bezel".
 *  3. Flood-fill from every image corner across the pure white PNG background;
 *     mark those pixels as "outside product". Any not-bezel pixel that is NOT
 *     outside is a candidate for the screen interior.
 *  4. Find the largest connected region of screen-interior candidates.
 *  5. For every row/column of the bounding box of that region, record the
 *     inner-most (leftmost / rightmost / topmost / bottommost) screen-interior
 *     pixel — those are the four edges of the display opening.
 *  6. Robust OLS-fit each edge to a straight line, discarding the outer 20% of
 *     samples per edge to reject corner rounding.
 *  7. Intersect the four fitted lines to get topLeft / topRight / bottomRight /
 *     bottomLeft, then print pixel and normalized (0..1) coordinates.
 *
 * Usage:  node scripts/measure-portable-screen-quad.mjs
 * pngjs is installed with --no-save so it does not pollute package.json.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const IMAGES = [
  { name: 'front', path: resolve(REPO_ROOT, 'src/assets/portable/front.png') },
  { name: 'angled-left', path: resolve(REPO_ROOT, 'src/assets/portable/angled.png') },
];

/** Pure-white background pixel (PNG canvas) AND the product's white bezel share
 *  the same "very bright + no chroma" fingerprint. That's fine — we distinguish
 *  them by connectivity, not appearance. */
function isBezelOrBackground(r, g, b) {
  const brightness = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return brightness > 235 && chroma < 18;
}

function decode(path) {
  const buf = readFileSync(path);
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
}

/** BFS from all four image corners across bezel-white pixels. Marks every
 *  pixel that is "background reachable from outside the product". */
function floodFillOutside(img) {
  const { width, height, data } = img;
  const outside = new Uint8Array(width * height);
  const stack = [0, 0, width - 1, 0, 0, height - 1, width - 1, height - 1];
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const flat = y * width + x;
    if (outside[flat]) continue;
    const i = flat * 4;
    if (!isBezelOrBackground(data[i], data[i + 1], data[i + 2])) continue;
    outside[flat] = 1;
    stack.push(x - 1, y, x + 1, y, x, y - 1, x, y + 1);
  }
  return outside;
}

/** Colorful pixels inside the product (not outside AND not bezel-white). Used
 *  purely to pick a seed inside the biggest colorful blob — the screen — so we
 *  can then flood the whole opening (including any bright plates/foods that
 *  read as bezel-white). */
function buildScreenMask(img, outside) {
  const { width, height, data } = img;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const flat = y * width + x;
      if (outside[flat]) continue;
      const i = flat * 4;
      if (isBezelOrBackground(data[i], data[i + 1], data[i + 2])) continue;
      mask[flat] = 1;
    }
  }
  return mask;
}

/** Take the largest colorful component (the food photo minus its plates) and
 *  fill enclosed holes. Plates read as bezel-white and thus fall out of the
 *  colorful component; but they *are* enclosed by colorful food pixels on all
 *  sides, so a hole-fill from the image border re-includes them. The result is
 *  the full screen opening including plates.
 *
 *  This avoids the earlier body-flood approach's failure mode: plates joined to
 *  the product bezel by 1px anti-aliased bridges got treated as part of the
 *  impassable body and cut real holes in the mask. Here plates are just interior
 *  gaps in a solid colorful blob, and hole-filling closes them cleanly. */
function fillScreenOpening(img, outside, seedComponent) {
  const { width, height } = img;
  if (seedComponent == null) return null;
  const opening = new Uint8Array(seedComponent);
  const notOpening = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) if (!opening[i]) notOpening[i] = 1;
  const reachable = new Uint8Array(width * height);
  const borderQueue = [];
  for (let x = 0; x < width; x++) borderQueue.push(x, 0, x, height - 1);
  for (let y = 0; y < height; y++) borderQueue.push(0, y, width - 1, y);
  while (borderQueue.length) {
    const yy = borderQueue.pop();
    const xx = borderQueue.pop();
    if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
    const flat = yy * width + xx;
    if (reachable[flat] || !notOpening[flat]) continue;
    reachable[flat] = 1;
    borderQueue.push(xx - 1, yy, xx + 1, yy, xx, yy - 1, xx, yy + 1);
  }
  for (let i = 0; i < width * height; i++) {
    if (notOpening[i] && !reachable[i]) opening[i] = 1;
  }
  return opening;
}

/** Largest connected component of `mask`. Returns a fresh mask with only that
 *  component set. Component finding via iterative BFS with a Uint32 label buffer. */
function largestComponent(mask, width, height) {
  const label = new Uint32Array(width * height);
  let bestLabel = 0;
  let bestCount = 0;
  let next = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const flat = y * width + x;
      if (!mask[flat] || label[flat]) continue;
      const id = next++;
      let count = 0;
      const queue = [x, y];
      while (queue.length) {
        const qy = queue.pop();
        const qx = queue.pop();
        if (qx < 0 || qx >= width || qy < 0 || qy >= height) continue;
        const f = qy * width + qx;
        if (!mask[f] || label[f]) continue;
        label[f] = id;
        count++;
        queue.push(qx - 1, qy, qx + 1, qy, qx, qy - 1, qx, qy + 1);
      }
      if (count > bestCount) { bestCount = count; bestLabel = id; }
    }
  }
  const out = new Uint8Array(width * height);
  for (let i = 0; i < label.length; i++) if (label[i] === bestLabel) out[i] = 1;
  return { mask: out, count: bestCount };
}

function collectEdgePoints(mask, width, height) {
  const topByX = new Array(width).fill(-1);
  const bottomByX = new Array(width).fill(-1);
  const leftByY = new Array(height).fill(-1);
  const rightByY = new Array(height).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (topByX[x] === -1) topByX[x] = y;
      bottomByX[x] = y;
      if (leftByY[y] === -1) leftByY[y] = x;
      rightByY[y] = x;
    }
  }
  const topPts = [];
  const bottomPts = [];
  const leftPts = [];
  const rightPts = [];
  for (let x = 0; x < width; x++) {
    if (topByX[x] !== -1) topPts.push({ x, y: topByX[x] });
    if (bottomByX[x] !== -1) bottomPts.push({ x, y: bottomByX[x] });
  }
  for (let y = 0; y < height; y++) {
    if (leftByY[y] !== -1) leftPts.push({ x: leftByY[y], y });
    if (rightByY[y] !== -1) rightPts.push({ x: rightByY[y], y });
  }
  return { topPts, bottomPts, leftPts, rightPts };
}

/**
 * @param orient 'top' | 'bottom' | 'left' | 'right'
 *
 * For tilted screens, "topmost per column" mixes true top-edge points (small y)
 * with left/right-edge points (large y, near the corner where top-edge and side-
 * edge meet at columns just outside the top-edge's x span). A positional trim
 * (sort by x, keep middle 60%) can't tell them apart when the corner-mixing
 * happens *inside* the middle. Instead: for the top edge, sort by y ascending
 * and keep the smallest 45% — those are guaranteed to be on the top edge and
 * not on the sides. Analogous for the other three edges.
 */
function fitLine(points, orient) {
  const horizontalLike = orient === 'top' || orient === 'bottom';
  // TOP/BOTTOM: pick the columns whose topmost/bottommost pixel is actually on
  //   the horizontal edge (not on a side that happens to poke into this column
  //   near a corner). Those have the most extreme y values, so sort by y and
  //   keep the smallest (top) or largest (bottom) 45%.
  // LEFT/RIGHT: for a tilted screen, "leftmost per row" at rows near the top
  //   or bottom actually sits on the top/bottom edge (near the corners). Only
  //   rows in the middle of the vertical span are guaranteed to be on the true
  //   side edge, so sort by y and keep the middle 60%.
  let trimmed;
  if (horizontalLike) {
    const wantSmallest = orient === 'top';
    const sorted = [...points].sort((a, b) => a.y - b.y);
    const keep = Math.max(8, Math.floor(sorted.length * 0.45));
    trimmed = wantSmallest ? sorted.slice(0, keep) : sorted.slice(sorted.length - keep);
  } else {
    const sorted = [...points].sort((a, b) => a.y - b.y);
    const lo = Math.floor(sorted.length * 0.2);
    const hi = Math.ceil(sorted.length * 0.8);
    trimmed = sorted.slice(lo, hi);
  }
  if (horizontalLike) {
    // y = a + b*x
    const n = trimmed.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of trimmed) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; }
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const a = (sy - b * sx) / n;
    return { orient: 'h', a, b };
  }
  // x = a + b*y
  const n = trimmed.length;
  let sx = 0, sy = 0, syy = 0, sxy = 0;
  for (const p of trimmed) { sx += p.x; sy += p.y; syy += p.y * p.y; sxy += p.x * p.y; }
  const b = (n * sxy - sx * sy) / (n * syy - sy * sy);
  const a = (sx - b * sy) / n;
  return { orient: 'v', a, b };
}

function intersect(l1, l2) {
  // General form: A*x + B*y = C.
  const toGeneral = (l) => (l.orient === 'h' ? { A: -l.b, B: 1, C: l.a } : { A: 1, B: -l.b, C: l.a });
  const g1 = toGeneral(l1);
  const g2 = toGeneral(l2);
  const det = g1.A * g2.B - g2.A * g1.B;
  if (Math.abs(det) < 1e-9) return null;
  const x = (g2.B * g1.C - g1.B * g2.C) / det;
  const y = (g1.A * g2.C - g2.A * g1.C) / det;
  return { x, y };
}

function drawLine(out, width, height, l, color) {
  // Sample the fitted line across the image and paint 1px stroke.
  const [r, g, b] = color;
  const stepsX = Math.max(2, width);
  for (let s = 0; s < stepsX; s++) {
    let x, y;
    if (l.orient === 'h') {
      x = s;
      y = Math.round(l.a + l.b * x);
    } else {
      y = s * (height / stepsX);
      x = Math.round(l.a + l.b * y);
      y = Math.round(y);
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const j = (py * width + px) * 4;
        out.data[j] = r; out.data[j + 1] = g; out.data[j + 2] = b; out.data[j + 3] = 255;
      }
    }
  }
}

function saveDebugMask(name, img, mask, corners, lines) {
  const { width, height, data } = img;
  const out = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const inMask = mask[i];
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    if (inMask) {
      // Tint the mask cyan by dampening R and boosting G/B a little.
      out.data[i * 4] = Math.floor(r * 0.4);
      out.data[i * 4 + 1] = Math.min(255, Math.floor(g * 0.7 + 80));
      out.data[i * 4 + 2] = Math.min(255, Math.floor(b * 0.7 + 100));
    } else {
      out.data[i * 4] = Math.floor(r * 0.6);
      out.data[i * 4 + 1] = Math.floor(g * 0.6);
      out.data[i * 4 + 2] = Math.floor(b * 0.6);
    }
    out.data[i * 4 + 3] = 255;
  }
  const drawDot = (pt, [dr, dg, db]) => {
    if (!pt) return;
    const cx = Math.round(pt.x);
    const cy = Math.round(pt.y);
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const j = (py * width + px) * 4;
        out.data[j] = dr;
        out.data[j + 1] = dg;
        out.data[j + 2] = db;
        out.data[j + 3] = 255;
      }
    }
  };
  if (lines) {
    drawLine(out, width, height, lines.top, [255, 40, 40]);
    drawLine(out, width, height, lines.bottom, [40, 255, 40]);
    drawLine(out, width, height, lines.left, [255, 200, 40]);
    drawLine(out, width, height, lines.right, [40, 200, 255]);
  }
  drawDot(corners.topLeft, [255, 0, 0]);
  drawDot(corners.topRight, [0, 255, 0]);
  drawDot(corners.bottomRight, [0, 128, 255]);
  drawDot(corners.bottomLeft, [255, 220, 0]);

  const dir = resolve(REPO_ROOT, 'tmp/quad-debug');
  mkdirSync(dir, { recursive: true });
  const target = resolve(dir, `${name}.png`);
  writeFileSync(target, PNG.sync.write(out));
  console.log(`  debug PNG: ${target}`);

  // Also emit a plain white-on-black mask so the mask shape is unambiguous.
  const maskOnly = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const v = mask[i] ? 255 : 0;
    maskOnly.data[i * 4] = v;
    maskOnly.data[i * 4 + 1] = v;
    maskOnly.data[i * 4 + 2] = v;
    maskOnly.data[i * 4 + 3] = 255;
  }
  const maskTarget = resolve(dir, `${name}-mask.png`);
  writeFileSync(maskTarget, PNG.sync.write(maskOnly));
  console.log(`  mask PNG:  ${maskTarget}`);
}

/**
 * Direct four-corner extraction: for each of the four cardinal diagonals, find
 * the mask pixel that is most extreme along that axis. This works because the
 * screen is a convex quadrilateral — its four corners are exactly the four
 * pixels that stick out furthest in the four diagonal directions.
 *
 *   topLeft     = minimizes (x + y)
 *   topRight    = maximizes (x - y)
 *   bottomRight = maximizes (x + y)
 *   bottomLeft  = maximizes (y - x)
 *
 * Unaffected by internal plate holes (holes don't touch the convex envelope)
 * and by whether the top edge slopes up or down (the direction is diagonal).
 * A tiny neighborhood-average smooths off single-pixel noise on the picked
 * corner without shifting it away from the true extreme.
 */
function findCornersByDiagonals(mask, width, height) {
  let tlBest = Infinity, trBest = -Infinity, brBest = -Infinity, blBest = -Infinity;
  let tl = null, tr = null, br = null, bl = null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      const s1 = x + y;
      const s2 = x - y;
      if (s1 < tlBest) { tlBest = s1; tl = { x, y }; }
      if (s2 > trBest) { trBest = s2; tr = { x, y }; }
      if (s1 > brBest) { brBest = s1; br = { x, y }; }
      if (-s2 > blBest) { blBest = -s2; bl = { x, y }; }
    }
  }
  return { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
}

function measure(name, path) {
  const img = decode(path);
  const outside = floodFillOutside(img);
  const raw = buildScreenMask(img, outside);
  const { mask: seedMask } = largestComponent(raw, img.width, img.height);
  // seedMask alone is enough for corner extraction (diagonal extremes ignore
  // interior plate holes). Hole-filling is kept only so the debug PNG shows a
  // full silhouette instead of two visible black plates.
  const opening = fillScreenOpening(img, outside, seedMask);
  const mask = opening ?? seedMask;
  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
  const corners = findCornersByDiagonals(mask, img.width, img.height);
  saveDebugMask(name, img, mask, corners, null);
  return { img, count, corners };
}

function fmtPx(pt) { return `{ x: ${pt.x.toFixed(1)}, y: ${pt.y.toFixed(1)} }`; }
function fmtNorm(pt, w, h) { return `{ x: ${(pt.x / w).toFixed(4)}, y: ${(pt.y / h).toFixed(4)} }`; }

for (const { name, path } of IMAGES) {
  const { img, count, corners } = measure(name, path);
  console.log(`\n=== ${name} (${img.width} x ${img.height}, ${count}px screen region) ===`);
  console.log('Pixel:');
  console.log('  topLeft:    ', fmtPx(corners.topLeft));
  console.log('  topRight:   ', fmtPx(corners.topRight));
  console.log('  bottomRight:', fmtPx(corners.bottomRight));
  console.log('  bottomLeft: ', fmtPx(corners.bottomLeft));
  console.log('Normalized (0..1):');
  console.log('  topLeft:    ', fmtNorm(corners.topLeft, img.width, img.height));
  console.log('  topRight:   ', fmtNorm(corners.topRight, img.width, img.height));
  console.log('  bottomRight:', fmtNorm(corners.bottomRight, img.width, img.height));
  console.log('  bottomLeft: ', fmtNorm(corners.bottomLeft, img.width, img.height));
}
