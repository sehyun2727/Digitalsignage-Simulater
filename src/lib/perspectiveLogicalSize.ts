import {
  isFiniteQuad,
  isQuadConvex,
  isQuadSelfIntersecting,
  normalizedQuadToDocument,
} from './quadGeometry';
import type { DocumentSize } from './quadGeometry';
import type { NormalizedQuad } from '../types/editor';

/**
 * Document-pixel apparent aspect ratio (width / height) of a perspective quad, used by the
 * display renderer to derive the "logical screen" aspect in perspective mode (ADR 0012 D-13).
 *
 * Estimated from the quad's four edges in **document pixel space** — the user's canvas is 16:9
 * or 9:16, so edge lengths computed from normalized (0..1 of document) coordinates alone would
 * shear whenever the canvas isn't square. Using `normalizedQuadToDocument` first collapses that
 * canvas shape into the measurement.
 *
 * ```
 *   apparent width  = (|top edge| + |bottom edge|) / 2
 *   apparent height = (|left edge| + |right edge|) / 2
 *   aspect          = apparent width / apparent height
 * ```
 *
 * Returns `null` for a quad that is not a valid convex, non-self-intersecting shape — in those
 * cases the renderer falls back to the stored object width/height (invariant A: never silently
 * stash a derived aspect that depends on a transient invalid draft). The function is pure, so
 * invariant A still holds: content layout stays a function of (current quad, current size, content),
 * no history/transient state.
 */
export function perspectiveLogicalAspect(
  quad: NormalizedQuad,
  documentSize: DocumentSize,
): number | null {
  if (!isFiniteQuad(quad) || isQuadSelfIntersecting(quad) || !isQuadConvex(quad)) return null;
  const d = normalizedQuadToDocument(quad, documentSize);
  const topEdge = Math.hypot(d.topRight.x - d.topLeft.x, d.topRight.y - d.topLeft.y);
  const bottomEdge = Math.hypot(d.bottomRight.x - d.bottomLeft.x, d.bottomRight.y - d.bottomLeft.y);
  const leftEdge = Math.hypot(d.bottomLeft.x - d.topLeft.x, d.bottomLeft.y - d.topLeft.y);
  const rightEdge = Math.hypot(d.bottomRight.x - d.topRight.x, d.bottomRight.y - d.topRight.y);
  const apparentWidth = (topEdge + bottomEdge) / 2;
  const apparentHeight = (leftEdge + rightEdge) / 2;
  if (apparentWidth <= 0 || apparentHeight <= 0) return null;
  return apparentWidth / apparentHeight;
}

/**
 * The size the display renderer uses as its *logical screen* when a perspective quad is active
 * (ADR 0012 D-13). The raster width is kept equal to the stored `objectWidth` so the offscreen
 * composition's pixel density matches the pre-perspective one; the raster height is derived
 * from the quad's apparent aspect, so content fit/scale/offset are evaluated against a body
 * whose shape matches what the warped output will show — eliminating the "letterbox-then-warp"
 * distortion the PDF 5-2 complaint describes.
 *
 * Falls back to the stored object dimensions in these cases:
 * - no quad (rect-mode object or portable without perspective — the function is still called
 *   from `getLogicalContentSize` so callers don't have to re-check `placementMode`);
 * - no document size available yet;
 * - the quad fails `perspectiveLogicalAspect`'s validity checks (not convex, self-intersecting,
 *   non-finite).
 *
 * The fallback matches the pre-fix behavior exactly, so a quad that becomes invalid mid-edit
 * (which the perspective-edit overlay prevents committing but the store draft can briefly hold)
 * doesn't flash the content into an unrelated shape.
 */
export function getPerspectiveLogicalSize(
  objectWidth: number,
  objectHeight: number,
  quad: NormalizedQuad | null,
  documentSize: DocumentSize | null,
): { width: number; height: number } {
  if (!quad || !documentSize) return { width: objectWidth, height: objectHeight };
  const aspect = perspectiveLogicalAspect(quad, documentSize);
  if (aspect === null) return { width: objectWidth, height: objectHeight };
  return { width: objectWidth, height: objectWidth / aspect };
}
