export interface DocumentSize {
  width: number;
  height: number;
}

export interface ObjectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Re-maps an object's geometry from one document size to another, preserving its *normalized*
 * center position and size (fractions of the document, 0-1) rather than raw pixels — used when
 * the space background photo is replaced with one of a different resolution/aspect ratio (see
 * ADR 0007). Rotation is intentionally left untouched by the caller; this only recomputes
 * x/y/width/height.
 *
 * The result is clamped so the object's center stays within the new document and at least half
 * of the object remains reachable near the bounds, instead of letting a replacement with a very
 * different aspect ratio push objects far outside the visible canvas.
 */
export function normalizeObjectGeometry(
  object: ObjectGeometry,
  oldSize: DocumentSize,
  newSize: DocumentSize,
): ObjectGeometry {
  if (oldSize.width <= 0 || oldSize.height <= 0) return object;

  const centerXFraction = (object.x + object.width / 2) / oldSize.width;
  const centerYFraction = (object.y + object.height / 2) / oldSize.height;
  const widthFraction = object.width / oldSize.width;
  const heightFraction = object.height / oldSize.height;

  const width = widthFraction * newSize.width;
  const height = heightFraction * newSize.height;

  const rawX = centerXFraction * newSize.width - width / 2;
  const rawY = centerYFraction * newSize.height - height / 2;

  const x = clamp(rawX, -width / 2, newSize.width - width / 2);
  const y = clamp(rawY, -height / 2, newSize.height - height / 2);

  return { x, y, width, height };
}

// `min` can exceed `max` when the object is wider/taller than the new document (e.g. after a
// replacement with a much smaller photo) — sorting the bounds first keeps the result inside
// whichever order they end up in, instead of collapsing to `max` unconditionally.
function clamp(value: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(hi, Math.max(lo, value));
}
