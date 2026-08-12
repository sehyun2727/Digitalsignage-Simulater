import { resolveScreenRegionRect } from './contentLayout';
import type { Rect } from './contentLayout';
import { getScreenRect } from './displayFrame';
import type { SignageObject } from '../types/editor';

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
 */
export function toLocalPoint(
  point: Point,
  object: { x: number; y: number; rotation: number },
): Point {
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
 */
export function isPointOnObjectScreen(object: SignageObject, point: Point): boolean {
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
export function findTopmostScreenHit(objects: SignageObject[], point: Point): string | null {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const object = objects[i];
    if (object && isPointOnObjectScreen(object, point)) return object.id;
  }
  return null;
}
