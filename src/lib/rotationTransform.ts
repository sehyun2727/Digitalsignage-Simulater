export interface Point {
  x: number;
  y: number;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Maps `point` from document/canvas space into `object`'s own unrotated local space (origin at
 * the object's x/y, extending to width/height) by inverse-rotating around that origin. This
 * mirrors Konva's rotation, which pivots around a node's x/y with no offset set (see
 * CanvasObjectView.tsx's commonProps) — so the same formula works without needing a live Konva
 * node, keeping this module pure and unit-testable in jsdom (which has no real canvas).
 *
 * Shared by screenHitTest.ts (hit testing) and quadGeometry.ts (deriving a perspective quad from
 * an object's current rect) — kept in its own module so neither has to import the other.
 */
export function toLocalPoint(point: Point, object: { x: number; y: number; rotation: number }): Point {
  const dx = point.x - object.x;
  const dy = point.y - object.y;
  const rad = object.rotation * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}

/**
 * Inverse of `toLocalPoint`: maps a point from `object`'s own unrotated local space back into
 * document/canvas space.
 */
export function fromLocalPoint(
  point: Point,
  object: { x: number; y: number; rotation: number },
): Point {
  const rad = object.rotation * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: object.x + point.x * cos - point.y * sin,
    y: object.y + point.x * sin + point.y * cos,
  };
}
