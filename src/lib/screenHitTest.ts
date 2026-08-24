import type { Rect } from './contentLayout';
import { getScreenRect } from './displayFrame';
import { normalizeMaterial } from './materialTexture';
import { getPortableScreenRect } from './portableTemplate';
import { isPointInQuad, normalizedQuadToDocument } from './quadGeometry';
import type { DocumentSize } from './quadGeometry';
import { fromLocalPoint, toLocalPoint } from './rotationTransform';
import type { Point } from './rotationTransform';
import { supportsPerspective, type SignageObject } from '../types/editor';

export type { Point };
export { fromLocalPoint, toLocalPoint };

export function rectContainsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Resolves the local (unrotated, object-relative) screen rect for a display or portable object
 * — the narrower drop target used for drag-and-drop content assignment, distinct from the
 * whole-object-bounds hit area ADR 0005 added for click-to-select. Other object kinds have no
 * screen region to drop content onto.
 */
export function getObjectScreenRect(object: SignageObject): Rect | null {
  if (object.kind === 'display') {
    // See-through / transparent-LED panels have no opaque bezel — the whole object rect is the
    // screen (see SignageDisplayView), so drops anywhere inside its bounds should count as
    // hitting the screen (not just the frame template's inset region).
    if (normalizeMaterial(object.material) === 'transparent-led') {
      return { x: 0, y: 0, width: object.width, height: object.height };
    }
    return getScreenRect(object.frameId, object.width, object.height);
  }
  if (object.kind === 'portable') {
    // When the user has defined a custom screen quad on their product photo, derive the hit
    // rect from the quad's bounding box so content-drop targeting lands on the warped screen.
    // Without a quad (or with a user photo but no quad yet), fall back to the template rect.
    if (object.screenQuad) {
      const q = object.screenQuad;
      const xs = [q.topLeft.x, q.topRight.x, q.bottomRight.x, q.bottomLeft.x];
      const ys = [q.topLeft.y, q.topRight.y, q.bottomRight.y, q.bottomLeft.y];
      const minX = Math.min(...xs) * object.width;
      const minY = Math.min(...ys) * object.height;
      const maxX = Math.max(...xs) * object.width;
      const maxY = Math.max(...ys) * object.height;
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    return getPortableScreenRect(object.templateView, object.width, object.height);
  }
  return null;
}

/**
 * True when `point` (in document/canvas space) falls within `object`'s own screen region,
 * accounting for the object's rotation. Drops on the bezel/frame/decorations around the screen
 * are deliberately excluded.
 *
 * A `placementMode: 'perspective'` object's screen is its `perspectiveQuad` (ADR 0008) — already
 * expressed in absolute normalized document coordinates, with any visual rotation baked directly
 * into its four corners — rather than the rect+rotation hit test used for 'rect' mode, so it is
 * tested directly against `point` with no `toLocalPoint` conversion.
 */
export function isPointOnObjectScreen(
  object: SignageObject,
  point: Point,
  documentSize: DocumentSize,
): boolean {
  if (
    supportsPerspective(object) &&
    object.placementMode === 'perspective' &&
    object.perspectiveQuad
  ) {
    const quad = normalizedQuadToDocument(object.perspectiveQuad, documentSize);
    return isPointInQuad(point, quad);
  }
  // Portable with a custom screenQuad in rect mode: test against the actual quad polygon
  // (not just its bounding box, which getObjectScreenRect returns) for accurate hit detection.
  if (object.kind === 'portable' && object.screenQuad && object.placementMode !== 'perspective') {
    const localPoint = toLocalPoint(point, object);
    // Convert the normalized 0-1 quad to absolute object-local pixel coords for isPointInQuad.
    const localQuad = {
      topLeft: { x: object.screenQuad.topLeft.x * object.width, y: object.screenQuad.topLeft.y * object.height },
      topRight: { x: object.screenQuad.topRight.x * object.width, y: object.screenQuad.topRight.y * object.height },
      bottomRight: { x: object.screenQuad.bottomRight.x * object.width, y: object.screenQuad.bottomRight.y * object.height },
      bottomLeft: { x: object.screenQuad.bottomLeft.x * object.width, y: object.screenQuad.bottomLeft.y * object.height },
    };
    // isPointInQuad works with any coordinate system since it only computes cross products.
    return isPointInQuad(localPoint, localQuad);
  }
  const screenRect = getObjectScreenRect(object);
  if (!screenRect) return false;
  return rectContainsPoint(screenRect, toLocalPoint(point, object));
}

/**
 * Finds the topmost object among `objects` whose screen region contains `point` (in
 * document/canvas space). Later array entries paint over earlier ones (see the objects array's
 * render order in EditorCanvas.tsx), so scanning from the end mirrors that same z-order for
 * pointer hit-testing ties.
 */
export function findTopmostScreenHit(
  objects: SignageObject[],
  point: Point,
  documentSize: DocumentSize,
): string | null {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const object = objects[i];
    if (object && isPointOnObjectScreen(object, point, documentSize)) return object.id;
  }
  return null;
}
