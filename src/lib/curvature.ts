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

/** Default number of vertical strips used to approximate curvature. */
export const CURVATURE_SLICE_COUNT = 20;

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
 * The curved top/bottom edge points (screen-local coordinates) used to draw a bezel outline
 * that visually follows the curvature instead of a flat rectangle sitting around a warped
 * screen. Returns `null` for flat/zero-amount curvature.
 */
export function computeCurvatureOutlinePoints(
  screen: Rect,
  curvature: Curvature,
  sliceCount: number = CURVATURE_SLICE_COUNT,
): number[] | null {
  const strips = computeCurvatureStrips(screen, curvature, sliceCount);
  if (strips.length === 0) return null;

  const top: number[] = [];
  for (const strip of strips) {
    const topY = screen.y + strip.groupY;
    top.push(strip.x, topY, strip.x + strip.width, topY);
  }
  // Walked right-to-left so the polyline forms one continuous outline (top edge left-to-right,
  // then bottom edge right-to-left) suitable for a single closed Konva Line.
  const bottom: number[] = [];
  for (const strip of [...strips].reverse()) {
    const bottomY = screen.y + strip.groupY + screen.height * strip.groupScaleY;
    bottom.push(strip.x + strip.width, bottomY, strip.x, bottomY);
  }
  return [...top, ...bottom];
}
