/**
 * A screen region on a user-uploaded portable product photo, expressed as a fraction of the
 * photo's own pixel dimensions (0-1). Kept as a flat object of primitives (not nested inside
 * another object) so it stays compatible with the editor store's one-level-deep no-op change
 * detection (see `hasObjectChange` in src/store/editorStore.ts) when saved via
 * `commitObjectChange`.
 */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A region smaller than this fraction of the photo in either axis is rejected as unusable. */
export const MIN_SCREEN_REGION_FRACTION = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Clamps a rect so it stays fully inside the 0-1x0-1 unit square, preserving its size. */
export function clampNormalizedRect(rect: NormalizedRect): NormalizedRect {
  const width = Math.min(1, Math.max(0, rect.width));
  const height = Math.min(1, Math.max(0, rect.height));
  const x = Math.min(1 - width, Math.max(0, rect.x));
  const y = Math.min(1 - height, Math.max(0, rect.y));
  return { x, y, width, height };
}

// Rects built by subtracting two derived 0-1 coordinates (as resizeNormalizedRectClamped does
// when clamping a dragged corner to exactly `fixed + minFraction`) can land a hair below the
// minimum due to floating-point rounding even though the intended size is exactly the minimum.
// A tolerance well under any meaningful screen-region difference absorbs that without allowing
// genuinely undersized rects through.
const SIZE_EPSILON = 1e-9;

/** True when both axes meet the minimum usable screen-region size. */
export function isNormalizedRectLargeEnough(rect: NormalizedRect): boolean {
  return (
    rect.width >= MIN_SCREEN_REGION_FRACTION - SIZE_EPSILON &&
    rect.height >= MIN_SCREEN_REGION_FRACTION - SIZE_EPSILON
  );
}

/** A centered, generously-sized starting region for a freshly uploaded photo. */
export function defaultScreenRegion(): NormalizedRect {
  return { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
}

/** Builds a normalized rect from two opposite corners (already in 0-1 space), order-independent. */
export function normalizedRectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): NormalizedRect {
  const x0 = clamp01(Math.min(a.x, b.x));
  const y0 = clamp01(Math.min(a.y, b.y));
  const x1 = clamp01(Math.max(a.x, b.x));
  const y1 = clamp01(Math.max(a.y, b.y));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Converts a pointer position within a preview element into 0-1 photo-relative coordinates. */
export function previewPointToNormalized(
  point: { x: number; y: number },
  previewSize: { width: number; height: number },
): { x: number; y: number } {
  if (previewSize.width <= 0 || previewSize.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp01(point.x / previewSize.width),
    y: clamp01(point.y / previewSize.height),
  };
}

/** Moves a rect by a 0-1-space delta, clamping so it stays fully inside the unit square. */
export function moveNormalizedRect(
  rect: NormalizedRect,
  delta: { dx: number; dy: number },
): NormalizedRect {
  return clampNormalizedRect({ ...rect, x: rect.x + delta.dx, y: rect.y + delta.dy });
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

/**
 * Resizes a rect by dragging one corner handle to a new 0-1 position, keeping the opposite
 * corner fixed. The result is not pre-clamped to the minimum-size requirement — callers
 * validate that separately (see `isNormalizedRectLargeEnough`) so an in-progress drag can pass
 * through invalid sizes before the user releases the handle.
 */
export function resizeNormalizedRect(
  rect: NormalizedRect,
  handle: ResizeHandle,
  point: { x: number; y: number },
): NormalizedRect {
  const fixed = {
    x: handle === 'ne' || handle === 'se' ? rect.x : rect.x + rect.width,
    y: handle === 'sw' || handle === 'se' ? rect.y : rect.y + rect.height,
  };
  return normalizedRectFromPoints(fixed, { x: clamp01(point.x), y: clamp01(point.y) });
}

/**
 * Same corner-handle resize as `resizeNormalizedRect`, but also enforces `minFraction` on both
 * axes live, during the drag itself, by clamping the dragged corner's distance from the fixed
 * opposite corner instead of letting the rect shrink past the minimum and only rejecting it on
 * release. Chosen over "stop at the last valid position" (which would require remembering and
 * reverting to a stale rect) because clamping keeps the box tracking the pointer smoothly right
 * up to the boundary. Because the dragged corner is always pushed to the correct side of the
 * fixed corner, the rect can never invert even if the pointer crosses over it.
 */
export function resizeNormalizedRectClamped(
  rect: NormalizedRect,
  handle: ResizeHandle,
  point: { x: number; y: number },
  minFraction: number = MIN_SCREEN_REGION_FRACTION,
): NormalizedRect {
  const fixed = {
    x: handle === 'ne' || handle === 'se' ? rect.x : rect.x + rect.width,
    y: handle === 'sw' || handle === 'se' ? rect.y : rect.y + rect.height,
  };
  const growsRight = handle === 'ne' || handle === 'se';
  const growsDown = handle === 'sw' || handle === 'se';

  const rawX = clamp01(point.x);
  const x = growsRight
    ? Math.min(1, Math.max(rawX, fixed.x + minFraction))
    : Math.max(0, Math.min(rawX, fixed.x - minFraction));

  const rawY = clamp01(point.y);
  const y = growsDown
    ? Math.min(1, Math.max(rawY, fixed.y + minFraction))
    : Math.max(0, Math.min(rawY, fixed.y - minFraction));

  return normalizedRectFromPoints(fixed, { x, y });
}

/**
 * Where a photo renders inside a `background-size: contain` preview box (as
 * `.portable-region-preview` uses): centered, scaled to the largest size that fits both axes,
 * leaving letterbox bands on the other axis when the photo's aspect ratio doesn't match the
 * container's. Pointer coordinates must be mapped against this rect — not the raw container —
 * or a region drawn/moved/resized on a non-4:3 photo lands in the wrong place relative to the
 * photo's own pixels.
 */
export function computeContainRect(
  container: { width: number; height: number },
  image: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  if (container.width <= 0 || container.height <= 0 || image.width <= 0 || image.height <= 0) {
    return { x: 0, y: 0, width: container.width, height: container.height };
  }
  const containerAspect = container.width / container.height;
  const imageAspect = image.width / image.height;
  let width = container.width;
  let height = container.height;
  if (imageAspect > containerAspect) {
    height = container.width / imageAspect;
  } else {
    width = container.height * imageAspect;
  }
  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  };
}

/**
 * Default placement size (in canvas px) for a newly added portable object: as large as
 * reasonable while staying within the document template bounds and preserving the product
 * photo's own aspect ratio, so the object never distorts the photo.
 */
export function computeDefaultPortableSize(
  intrinsic: { width: number; height: number },
  template: { width: number; height: number },
): { width: number; height: number } {
  const maxWidth = template.width * 0.5;
  const maxHeight = template.height * 0.5;
  const aspect = intrinsic.width / intrinsic.height;
  let width = maxWidth;
  let height = width / aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  return { width, height };
}
