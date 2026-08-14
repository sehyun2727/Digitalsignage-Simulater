import { resolveScreenRegionRect } from './contentLayout';
import type { Rect } from './contentLayout';
import { getScreenRect } from './displayFrame';
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
    return getScreenRect(object.frameId, object.width, object.height);
  }
  if (object.kind === 'portable') {
    return resolveScreenRegionRect(
      { width: object.width, height: object.height },
      { shape: 'rect', ...object.screenRegion },
    );
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
  if (supportsPerspective(object) && object.placementMode === 'perspective' && object.perspectiveQuad) {
    const quad = normalizedQuadToDocument(object.perspectiveQuad, documentSize);
    return isPointInQuad(point, quad);
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
