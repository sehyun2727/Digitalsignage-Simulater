import { createId } from './id';
import {
  DEFAULT_OCCLUSION_FEATHER,
  DEFAULT_OCCLUSION_OPACITY,
  MAX_OCCLUSION_POINTS,
  MAX_OCCLUSION_SETTING,
  MIN_OCCLUSION_POINTS,
  MIN_OCCLUSION_SETTING,
} from '../types/editor';
import type { NormalizedPoint, OcclusionMask } from '../types/editor';

/**
 * Foreground occlusion mask geometry/validation (sprint spec section 7) — pure, framework-
 * independent helpers generalizing the fixed-4-point checks in quadGeometry.ts to an arbitrary
 * (3-24 point) polygon. "Normalized" coordinates are 0-1 fractions of the current photo-first
 * document, exactly like NormalizedQuad, so a mask survives space-photo replacement unchanged.
 */

export interface Point {
  x: number;
  y: number;
}

export const DEFAULT_EPSILON = 1e-6;

/** Minimum mask area, as a fraction of the full document (unit square) area. */
export const MIN_OCCLUSION_AREA_FRACTION = 0.0005;

export function clampPoint01(point: Point): Point {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
}

export function clampOcclusionSetting(value: number): number {
  return Math.min(MAX_OCCLUSION_SETTING, Math.max(MIN_OCCLUSION_SETTING, value));
}

export function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

/** Signed polygon area via the shoelace formula; positive/negative encodes winding direction. */
export function signedArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonArea(points: readonly Point[]): number {
  return Math.abs(signedArea(points));
}

/** Proper segment intersection test (shared endpoints/touching do not count as crossing). */
export function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d1 = cross(sub(b2, b1), sub(a1, b1));
  const d2 = cross(sub(b2, b1), sub(a2, b1));
  const d3 = cross(sub(a2, a1), sub(b1, a1));
  const d4 = cross(sub(a2, a1), sub(b2, a1));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * True when any pair of non-adjacent edges crosses (a "bowtie" polygon) — unlike the fixed-4-
 * point quad case, an N-gon needs every non-adjacent pair checked, not just the two opposite
 * edges. Adjacent edges (sharing a vertex) are skipped since they always touch at that vertex.
 */
export function isPolygonSelfIntersecting(points: readonly Point[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i += 1) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % n]!;
    for (let j = i + 1; j < n; j += 1) {
      const isAdjacent = j === i || j === (i + 1) % n || (j + 1) % n === i;
      if (isAdjacent) continue;
      const b1 = points[j]!;
      const b2 = points[(j + 1) % n]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/** Rejects a point that sits within epsilon of the immediately preceding point (a degenerate,
 * effectively-duplicate vertex), which would otherwise produce zero-length edges. */
export function hasDuplicateAdjacentPoints(
  points: readonly Point[],
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    if (Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon) return true;
  }
  return false;
}

export type OcclusionInvalidReason =
  | 'too-few-points'
  | 'too-many-points'
  | 'invalid-values'
  | 'out-of-bounds'
  | 'duplicate-points'
  | 'self-intersecting'
  | 'min-area';

export interface OcclusionValidationOptions {
  minAreaFraction?: number;
}

export interface OcclusionValidationResult {
  valid: boolean;
  reason?: OcclusionInvalidReason;
}

/**
 * Single validation entry point shared by the store (reject on Apply) and the editing overlay
 * (live accessible error message). Checks run in a fixed order so a given invalid polygon always
 * reports the same reason. Deliberately does not require convexity — real foreground obstructions
 * (an L-shaped pillar, a person's silhouette) are routinely concave.
 */
export function validateOcclusionPolygon(
  points: readonly NormalizedPoint[],
  options: OcclusionValidationOptions = {},
): OcclusionValidationResult {
  const minAreaFraction = options.minAreaFraction ?? MIN_OCCLUSION_AREA_FRACTION;

  if (points.length < MIN_OCCLUSION_POINTS) return { valid: false, reason: 'too-few-points' };
  if (points.length > MAX_OCCLUSION_POINTS) return { valid: false, reason: 'too-many-points' };
  if (!points.every(isFinitePoint)) return { valid: false, reason: 'invalid-values' };
  const inBounds = points.every(
    (point) =>
      point.x >= -DEFAULT_EPSILON &&
      point.x <= 1 + DEFAULT_EPSILON &&
      point.y >= -DEFAULT_EPSILON &&
      point.y <= 1 + DEFAULT_EPSILON,
  );
  if (!inBounds) return { valid: false, reason: 'out-of-bounds' };
  if (hasDuplicateAdjacentPoints(points)) return { valid: false, reason: 'duplicate-points' };
  if (isPolygonSelfIntersecting(points)) return { valid: false, reason: 'self-intersecting' };
  if (polygonArea(points) < minAreaFraction) return { valid: false, reason: 'min-area' };
  return { valid: true };
}

export function isOcclusionPolygonValid(
  points: readonly NormalizedPoint[],
  options?: OcclusionValidationOptions,
): boolean {
  return validateOcclusionPolygon(points, options).valid;
}

export interface DocumentSize {
  width: number;
  height: number;
}

export function documentToNormalized(point: Point, documentSize: DocumentSize): NormalizedPoint {
  if (documentSize.width <= 0 || documentSize.height <= 0) return { x: 0, y: 0 };
  return { x: point.x / documentSize.width, y: point.y / documentSize.height };
}

export function normalizedToDocument(point: NormalizedPoint, documentSize: DocumentSize): Point {
  return { x: point.x * documentSize.width, y: point.y * documentSize.height };
}

/** Konva blur filter radius for a mask's `feather` (0-100) setting, scaled to its own bounding box
 * — mirrors contactShadowBlurRadius in environmentIntegration.ts. Blurring the mask's clip edge is
 * safe from halos because both sides of that edge reveal the same underlying space-photo pixels. */
export function resolveOcclusionFeatherRadius(
  feather: number,
  boundingWidth: number,
  boundingHeight: number,
): number {
  return (clampOcclusionSetting(feather) / 100) * Math.max(boundingWidth, boundingHeight) * 0.12;
}

export function createOcclusionMask(points: NormalizedPoint[]): OcclusionMask {
  return {
    id: createId(),
    kind: 'polygon',
    points,
    feather: DEFAULT_OCCLUSION_FEATHER,
    opacity: DEFAULT_OCCLUSION_OPACITY,
    enabled: true,
  };
}
