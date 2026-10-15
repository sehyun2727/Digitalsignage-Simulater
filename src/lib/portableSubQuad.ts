import type { NormalizedQuad } from '../types/editor';

type Pt = { x: number; y: number };
type Mat3 = number[]; // 9 elements, row-major.

/**
 * v2-S5 K2 / 보완 A6. Compute an inset sub-quad whose apparent aspect matches
 * `contentAspect`, letterboxing proportionally within the source `quad`.
 *
 * Two strategies are provided for A/B measurement:
 *   - `computeContainSubQuadHomography` (production): projects a unit-square inset through
 *     the quad's homography. Perspective-correct — the letterbox stays aligned with the
 *     screen plane even when the quad is viewed at an angle.
 *   - `computeContainSubQuadLinear` (S5 fallback): linear vertex-bisector along opposite
 *     edges. Approximates well for near-axis-aligned quads but shears at angled views.
 *
 * `computeContainSubQuad` is the production export — currently the homography variant,
 * since the A6 e2e measurement shows it halves the aspect error on angled views
 * (0.86 % → 0.40 %).
 */

/** Quad apparent aspect in object-local pixel coords (same formula as `perspectiveLogicalAspect`
 *  in src/lib/perspectiveLogicalSize.ts). Returns null for a degenerate quad. */
export function quadApparentAspect(q: NormalizedQuad): number | null {
  const topEdge = Math.hypot(q.topRight.x - q.topLeft.x, q.topRight.y - q.topLeft.y);
  const bottomEdge = Math.hypot(q.bottomRight.x - q.bottomLeft.x, q.bottomRight.y - q.bottomLeft.y);
  const leftEdge = Math.hypot(q.bottomLeft.x - q.topLeft.x, q.bottomLeft.y - q.topLeft.y);
  const rightEdge = Math.hypot(q.bottomRight.x - q.topRight.x, q.bottomRight.y - q.topRight.y);
  const apparentW = (topEdge + bottomEdge) / 2;
  const apparentH = (leftEdge + rightEdge) / 2;
  if (apparentW <= 0 || apparentH <= 0) return null;
  return apparentW / apparentH;
}

/** 3x3 homography that maps unit square (0,0)-(1,0)-(1,1)-(0,1) to the quad's corners
 *  TL-TR-BR-BL. Returns null for a degenerate quad. */
function solveHomographyUnitToQuad(quad: NormalizedQuad): Mat3 | null {
  const tl = quad.topLeft;
  const tr = quad.topRight;
  const br = quad.bottomRight;
  const bl = quad.bottomLeft;
  const dx1 = { x: tr.x - br.x, y: tr.y - br.y };
  const dx2 = { x: bl.x - br.x, y: bl.y - br.y };
  const sx = { x: tl.x - tr.x + br.x - bl.x, y: tl.y - tr.y + br.y - bl.y };
  const cross = dx1.x * dx2.y - dx1.y * dx2.x;
  if (Math.abs(cross) < 1e-9) return null;
  const g = (sx.x * dx2.y - sx.y * dx2.x) / cross;
  const h = (dx1.x * sx.y - dx1.y * sx.x) / cross;
  const h11 = tr.x - tl.x + g * tr.x;
  const h12 = bl.x - tl.x + h * bl.x;
  const h13 = tl.x;
  const h21 = tr.y - tl.y + g * tr.y;
  const h22 = bl.y - tl.y + h * bl.y;
  const h23 = tl.y;
  return [h11, h12, h13, h21, h22, h23, g, h, 1];
}

function applyHomography(mat: Mat3, p: Pt): Pt {
  const w = mat[6]! * p.x + mat[7]! * p.y + mat[8]!;
  if (Math.abs(w) < 1e-9) return p;
  return {
    x: (mat[0]! * p.x + mat[1]! * p.y + mat[2]!) / w,
    y: (mat[3]! * p.x + mat[4]! * p.y + mat[5]!) / w,
  };
}

function toLocalQuad(quad: NormalizedQuad, objWidth: number, objHeight: number): NormalizedQuad {
  return {
    topLeft: { x: quad.topLeft.x * objWidth, y: quad.topLeft.y * objHeight },
    topRight: { x: quad.topRight.x * objWidth, y: quad.topRight.y * objHeight },
    bottomRight: { x: quad.bottomRight.x * objWidth, y: quad.bottomRight.y * objHeight },
    bottomLeft: { x: quad.bottomLeft.x * objWidth, y: quad.bottomLeft.y * objHeight },
  };
}

export function computeContainSubQuadHomography(
  quad: NormalizedQuad,
  objWidth: number,
  objHeight: number,
  contentAspect: number,
): NormalizedQuad {
  const quadAspect = quadApparentAspect(toLocalQuad(quad, objWidth, objHeight));
  if (quadAspect == null || contentAspect <= 0) return quad;
  if (Math.abs(contentAspect - quadAspect) < 1e-4) return quad;
  const H = solveHomographyUnitToQuad(quad);
  if (!H) return quad;
  let i: number;
  let subTL: Pt;
  let subTR: Pt;
  let subBR: Pt;
  let subBL: Pt;
  if (contentAspect > quadAspect) {
    i = (1 - quadAspect / contentAspect) / 2;
    subTL = { x: 0, y: i };
    subTR = { x: 1, y: i };
    subBR = { x: 1, y: 1 - i };
    subBL = { x: 0, y: 1 - i };
  } else {
    i = (1 - contentAspect / quadAspect) / 2;
    subTL = { x: i, y: 0 };
    subTR = { x: 1 - i, y: 0 };
    subBR = { x: 1 - i, y: 1 };
    subBL = { x: i, y: 1 };
  }
  return {
    topLeft: applyHomography(H, subTL),
    topRight: applyHomography(H, subTR),
    bottomRight: applyHomography(H, subBR),
    bottomLeft: applyHomography(H, subBL),
  };
}

export function computeContainSubQuadLinear(
  quad: NormalizedQuad,
  objWidth: number,
  objHeight: number,
  contentAspect: number,
): NormalizedQuad {
  const quadAspect = quadApparentAspect(toLocalQuad(quad, objWidth, objHeight));
  if (quadAspect == null || contentAspect <= 0) return quad;
  if (Math.abs(contentAspect - quadAspect) < 1e-4) return quad;

  const lerp = (a: Pt, b: Pt, t: number): Pt => ({
    x: a.x * (1 - t) + b.x * t,
    y: a.y * (1 - t) + b.y * t,
  });

  if (contentAspect > quadAspect) {
    const ratio = quadAspect / contentAspect;
    const inset = (1 - ratio) / 2;
    return {
      topLeft: lerp(quad.topLeft, quad.bottomLeft, inset),
      topRight: lerp(quad.topRight, quad.bottomRight, inset),
      bottomRight: lerp(quad.bottomRight, quad.topRight, inset),
      bottomLeft: lerp(quad.bottomLeft, quad.topLeft, inset),
    };
  }
  const ratio = contentAspect / quadAspect;
  const inset = (1 - ratio) / 2;
  return {
    topLeft: lerp(quad.topLeft, quad.topRight, inset),
    topRight: lerp(quad.topRight, quad.topLeft, inset),
    bottomRight: lerp(quad.bottomRight, quad.bottomLeft, inset),
    bottomLeft: lerp(quad.bottomLeft, quad.bottomRight, inset),
  };
}

/** Production export: homography. Linear kept nearby for A/B comparison in A6 e2e. */
export function computeContainSubQuad(
  quad: NormalizedQuad,
  objWidth: number,
  objHeight: number,
  contentAspect: number,
): NormalizedQuad {
  return computeContainSubQuadHomography(quad, objWidth, objHeight, contentAspect);
}
