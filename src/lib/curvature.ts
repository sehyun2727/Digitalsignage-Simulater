import { MAX_CURVATURE_AMOUNT, MIN_CURVATURE_AMOUNT } from '../types/editor';
import type { Curvature, DisplayMaterial } from '../types/editor';
import type { Rect } from './contentLayout';

/**
 * Curvature is a 2D visual approximation, not true 3D/perspective (see ADR 0007). LCD stays
 * flat-only because its uniform glass surface reads as visibly wrong once warped by the same
 * strip technique that works for LED's already-segmented pixel grid.
 */
export function isCurvatureSupported(material: DisplayMaterial): boolean {
  return material === 'led' || material === 'transparent-led';
}

export function clampCurvatureAmount(amount: number): number {
  return Math.min(MAX_CURVATURE_AMOUNT, Math.max(MIN_CURVATURE_AMOUNT, amount));
}

/** Default number of vertical strips used to approximate curvature. Each strip's top/bottom
 *  edge is computed from its *center* x, so within a strip the top/bottom is flat — the visible
 *  stepping between neighboring strips is the strip width times the depth function's local
 *  gradient. Bumping this to 80 shrinks that per-strip step below 1 px at typical screen sizes,
 *  so both the stretch inside the strip and the outer silhouette read as continuously smooth
 *  rather than as visibly banded columns. */
export const CURVATURE_SLICE_COUNT = 80;

/** Number of samples per edge when tracing the curve as a polyline (silhouette outline or
 *  outer clip path). Independent of `CURVATURE_SLICE_COUNT` because a smooth outline is cheap
 *  (just points, not additional draw calls) while another strip triples per-frame work. Kept
 *  a bit higher than the strip count so the outer clip has no visible facets even when the
 *  strips inside it happen to align with a sub-pixel edge. */
export const CURVATURE_OUTLINE_SAMPLES = 120;

/** Maximum top/bottom edge displacement at the screen's center, as a fraction of screen height. */
const MAX_CURVE_DEPTH_RATIO = 0.18;

/**
 * Each strip is clipped and rendered as its own Konva Group, so adjacent strips can leave a
 * hairline anti-aliasing gap at their shared edge. Widening each interior edge's clip rect by
 * half this amount closes that gap; since neighboring strips' `groupY`/`groupScaleY` differ only
 * slightly (the curvature depth function is smooth across strip width), the resulting overlap is
 * visually seamless rather than a doubled/ghosted edge.
 */
const STRIP_SEAM_OVERLAP_PX = 1;

export interface CurvatureStrip {
  index: number;
  /** Strip's true (non-overlapping) x position and width, in the screen rect's local space. */
  x: number;
  width: number;
  /** Clip rect x/width, widened at interior edges by `STRIP_SEAM_OVERLAP_PX` to hide seams. */
  clipX: number;
  clipWidth: number;
  /** Konva Group `y`/`scaleY` that reproduces this strip's warped top/bottom edges. */
  groupY: number;
  groupScaleY: number;
}

/**
 * Computes per-strip vertical offset/scale for a "strip-based vertical segmentation" curvature
 * approximation (see ADR 0007): the screen is divided into `sliceCount` equal-width vertical
 * strips; each strip's top/bottom edge is displaced by a parabola that is zero at the screen's
 * left/right edges and maximal at its horizontal center, so edges stay anchored while the
 * center bulges (convex) or recedes (concave). Returns `[]` for flat/zero-amount curvature, so
 * callers can fall back to simple, uncurved rendering without any special-casing.
 *
 * For strip `i` spanning local x `[x0, x1)`, let `t` be its center's position mapped to -1..1
 * across the screen width. The edge depth is `depth(t) = maxDepth * (1 - t^2)`, and:
 *   - convex: topOffset = -depth(t), bottomOffset = +depth(t)  (center taller: bulges out)
 *   - concave: topOffset = +depth(t), bottomOffset = -depth(t) (center shorter: recedes)
 * A Konva Group with `y = topOffset` and `scaleY = (screen.height + bottomOffset - topOffset) /
 * screen.height` maps every child drawn at the screen's normal (flat) local coordinates onto
 * those warped edges, so the same content/material rendering used for flat screens can be
 * reused verbatim inside each strip's Group.
 */
export function computeCurvatureStrips(
  screen: Rect,
  curvature: Curvature,
  sliceCount: number = CURVATURE_SLICE_COUNT,
): CurvatureStrip[] {
  const amount = clampCurvatureAmount(curvature.amount);
  if (curvature.mode === 'flat' || amount <= 0 || screen.width <= 0 || screen.height <= 0) {
    return [];
  }

  const maxDepth = screen.height * MAX_CURVE_DEPTH_RATIO * (amount / 100);
  const sign = curvature.mode === 'convex' ? -1 : 1;
  const stripWidth = screen.width / sliceCount;

  const strips: CurvatureStrip[] = [];
  for (let index = 0; index < sliceCount; index += 1) {
    const stripX = index * stripWidth;
    const centerX = stripX + stripWidth / 2;
    const t = (centerX / screen.width) * 2 - 1;
    const depth = maxDepth * (1 - t * t);
    const topOffset = sign * depth;
    const bottomOffset = -sign * depth;
    const newHeight = screen.height + (bottomOffset - topOffset);
    const groupScaleY = newHeight / screen.height;
    const halfOverlap = STRIP_SEAM_OVERLAP_PX / 2;
    const leftExtend = index > 0 ? halfOverlap : 0;
    const rightExtend = index < sliceCount - 1 ? halfOverlap : 0;
    strips.push({
      index,
      x: screen.x + stripX,
      width: stripWidth,
      clipX: screen.x + stripX - leftExtend,
      clipWidth: stripWidth + leftExtend + rightExtend,
      groupY: topOffset,
      groupScaleY,
    });
  }
  return strips;
}

/**
 * Continuous per-x sample of the curvature's top/bottom edge — the smooth silhouette a strip's
 * displacement approximates in stepped form. Sampling the depth function directly (instead of
 * reusing per-strip constants like the previous implementation) removes the visible staircase
 * along the outline; `sampleCount + 1` points are emitted per edge (endpoints included) so the
 * closed loop still starts/ends exactly on the screen's left/right edges. Returns `null` for
 * flat/zero-amount curvature. Suitable both as a bezel outline (draw as `Line` with a stroke)
 * and as an outer clip path (feed into a `clipFunc` to trim strip content to the true curve).
 */
export function computeCurvatureOutlinePoints(
  screen: Rect,
  curvature: Curvature,
  sampleCount: number = CURVATURE_OUTLINE_SAMPLES,
): number[] | null {
  const amount = clampCurvatureAmount(curvature.amount);
  if (curvature.mode === 'flat' || amount <= 0 || screen.width <= 0 || screen.height <= 0) {
    return null;
  }
  const maxDepth = screen.height * MAX_CURVE_DEPTH_RATIO * (amount / 100);
  // sign matches computeCurvatureStrips: convex = -1 (top moves up, bottom moves down —
  // silhouette bulges outward), concave = +1 (top moves down, bottom moves up — silhouette
  // recedes inward). The previous version applied `sign * -depth` on top / `sign * depth` on
  // bottom, which inverted convex/concave for the outer clip only: strips still bulged outward
  // correctly, but the clip was concave-shaped and cropped the bulge away.
  const sign = curvature.mode === 'convex' ? -1 : 1;
  const samples = Math.max(2, Math.floor(sampleCount));

  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  for (let i = 0; i <= samples; i += 1) {
    const u = i / samples;
    const x = screen.x + u * screen.width;
    const t = u * 2 - 1;
    const depth = maxDepth * (1 - t * t);
    const topOffset = sign * depth; // convex: -depth (up); concave: +depth (down)
    const bottomOffset = -sign * depth; // convex: +depth (down); concave: -depth (up)
    top.push([x, screen.y + topOffset]);
    bottom.push([x, screen.y + screen.height + bottomOffset]);
  }
  // Walk the bottom right-to-left so the concatenation forms one continuous closed loop
  // (top edge left-to-right, then bottom edge right-to-left), suitable for a single Konva Line.
  const points: number[] = [];
  for (const [x, y] of top) points.push(x, y);
  for (let i = bottom.length - 1; i >= 0; i -= 1) points.push(bottom[i]![0], bottom[i]![1]);
  return points;
}

/** Minimum surface a `clipFunc` uses to trace a polygonal path — matches both Konva's
 *  `SceneContext` wrapper and a raw `CanvasRenderingContext2D`, so `traceOutlinePath` can be
 *  fed to either without a cast. */
export interface PolygonPathContext {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
}

/**
 * Draws `points` (a flat [x0,y0,x1,y1,...] polygon, as produced by `computeCurvatureOutlinePoints`)
 * as a `beginPath`/`moveTo`/`lineTo`/`closePath` sequence on the given 2D context — the primitive
 * a Konva `clipFunc` needs. Reused for both the outer clip that trims each screen's strip content
 * to its true curved silhouette and (elsewhere) the bezel body's own clipped shape.
 */
export function traceOutlinePath(ctx: PolygonPathContext, points: readonly number[]): void {
  if (points.length < 4) return;
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i]!, points[i + 1]!);
  }
  ctx.closePath();
}
