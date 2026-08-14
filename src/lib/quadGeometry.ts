import { fromLocalPoint } from './rotationTransform';
import type { NormalizedPoint, NormalizedQuad } from '../types/editor';

/**
 * Four-point perspective quad geometry (ADR 0008) — pure, framework-independent helpers used to
 * fit signage against a photographed installation plane. "Normalized" coordinates are 0-1
 * fractions of the current photo-first document (see EditorDocument/SpaceBackground in
 * types/editor.ts), independent of preview/export pixel size.
 */

export interface Point {
  x: number;
  y: number;
}

export type { NormalizedPoint, NormalizedQuad };

export type QuadCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

export const QUAD_CORNER_ORDER: readonly QuadCorner[] = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft',
];

export const DEFAULT_EPSILON = 1e-6;

/** Minimum quad area, as a fraction of the full document (unit square) area. */
export const MIN_QUAD_AREA_FRACTION = 0.01;

/** Minimum single-edge length, in normalized (0-1) units, so handles stay touch-operable. */
export const MIN_QUAD_EDGE_LENGTH = 0.02;

export function quadPoints(quad: NormalizedQuad): [Point, Point, Point, Point] {
  return [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
}

export function clampPoint01(point: Point): Point {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
}

export function clampQuad01(quad: NormalizedQuad): NormalizedQuad {
  return {
    topLeft: clampPoint01(quad.topLeft),
    topRight: clampPoint01(quad.topRight),
    bottomRight: clampPoint01(quad.bottomRight),
    bottomLeft: clampPoint01(quad.bottomLeft),
  };
}

export function pointsEqual(a: Point, b: Point, epsilon: number = DEFAULT_EPSILON): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

export function quadsEqual(
  a: NormalizedQuad,
  b: NormalizedQuad,
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  return QUAD_CORNER_ORDER.every((corner) => pointsEqual(a[corner], b[corner], epsilon));
}

export function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function isFiniteQuad(quad: NormalizedQuad): boolean {
  return QUAD_CORNER_ORDER.every((corner) => isFinitePoint(quad[corner]));
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

export function quadArea(quad: NormalizedQuad): number {
  return Math.abs(signedArea(quadPoints(quad)));
}

/**
 * Screen coordinates increase downward, so a quad walked top-left -> top-right -> bottom-right
 * -> bottom-left in its intended visual orientation has positive shoelace area ('cw' here);
 * 'ccw' means the quad has been flipped/mirrored relative to that intended orientation.
 */
export function quadWinding(quad: NormalizedQuad): 'cw' | 'ccw' | 'degenerate' {
  const area = signedArea(quadPoints(quad));
  if (Math.abs(area) <= DEFAULT_EPSILON) return 'degenerate';
  return area > 0 ? 'cw' : 'ccw';
}

export function edgeLength(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export interface QuadEdgeLengths {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function quadEdgeLengths(quad: NormalizedQuad): QuadEdgeLengths {
  return {
    top: edgeLength(quad.topLeft, quad.topRight),
    right: edgeLength(quad.topRight, quad.bottomRight),
    bottom: edgeLength(quad.bottomRight, quad.bottomLeft),
    left: edgeLength(quad.bottomLeft, quad.topLeft),
  };
}

export function isQuadEdgeLengthValid(
  quad: NormalizedQuad,
  minLength: number = MIN_QUAD_EDGE_LENGTH,
): boolean {
  const lengths = quadEdgeLengths(quad);
  return (
    lengths.top >= minLength &&
    lengths.right >= minLength &&
    lengths.bottom >= minLength &&
    lengths.left >= minLength
  );
}

export function isQuadAreaValid(
  quad: NormalizedQuad,
  minAreaFraction: number = MIN_QUAD_AREA_FRACTION,
): boolean {
  return quadArea(quad) >= minAreaFraction;
}

/**
 * Proper segment intersection test (shared endpoints/touching do not count as crossing) — used
 * to detect a self-intersecting ("bowtie") quad by checking the two pairs of opposite edges.
 */
export function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d1 = cross(sub(b2, b1), sub(a1, b1));
  const d2 = cross(sub(b2, b1), sub(a2, b1));
  const d3 = cross(sub(a2, a1), sub(b1, a1));
  const d4 = cross(sub(a2, a1), sub(b2, a1));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Only the two pairs of opposite (non-adjacent) edges can cross in a 4-point polygon. */
export function isQuadSelfIntersecting(quad: NormalizedQuad): boolean {
  return (
    segmentsIntersect(quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft) ||
    segmentsIntersect(quad.topRight, quad.bottomRight, quad.bottomLeft, quad.topLeft)
  );
}

/** True when all four interior turns share the same rotational sign (a simple convex polygon). */
export function isQuadConvex(quad: NormalizedQuad): boolean {
  const points = quadPoints(quad);
  let sign = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const c = points[(i + 2) % points.length]!;
    const turn = cross(sub(b, a), sub(c, b));
    if (Math.abs(turn) <= DEFAULT_EPSILON) continue;
    const currentSign = turn > 0 ? 1 : -1;
    if (sign === 0) sign = currentSign;
    else if (currentSign !== sign) return false;
  }
  return sign !== 0;
}

export type QuadInvalidReason =
  'invalid-values' | 'out-of-bounds' | 'self-intersecting' | 'concave' | 'min-area' | 'min-edge';

export interface QuadValidationOptions {
  minAreaFraction?: number;
  minEdgeLength?: number;
}

export interface QuadValidationResult {
  valid: boolean;
  reason?: QuadInvalidReason;
}

/**
 * Single validation entry point shared by the store (reject on Apply) and the perspective
 * overlay (live accessible error message). Checks run in a fixed order so a given invalid quad
 * always reports the same reason.
 */
export function validateQuad(
  quad: NormalizedQuad,
  options: QuadValidationOptions = {},
): QuadValidationResult {
  const minAreaFraction = options.minAreaFraction ?? MIN_QUAD_AREA_FRACTION;
  const minEdgeLength = options.minEdgeLength ?? MIN_QUAD_EDGE_LENGTH;

  if (!isFiniteQuad(quad)) return { valid: false, reason: 'invalid-values' };
  const inBounds = quadPoints(quad).every(
    (point) =>
      point.x >= -DEFAULT_EPSILON &&
      point.x <= 1 + DEFAULT_EPSILON &&
      point.y >= -DEFAULT_EPSILON &&
      point.y <= 1 + DEFAULT_EPSILON,
  );
  if (!inBounds) return { valid: false, reason: 'out-of-bounds' };
  if (isQuadSelfIntersecting(quad)) return { valid: false, reason: 'self-intersecting' };
  if (!isQuadConvex(quad)) return { valid: false, reason: 'concave' };
  if (!isQuadEdgeLengthValid(quad, minEdgeLength)) return { valid: false, reason: 'min-edge' };
  if (!isQuadAreaValid(quad, minAreaFraction)) return { valid: false, reason: 'min-area' };
  return { valid: true };
}

export function isQuadValid(quad: NormalizedQuad, options?: QuadValidationOptions): boolean {
  return validateQuad(quad, options).valid;
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

export function documentQuadToNormalized(
  quad: NormalizedQuad,
  documentSize: DocumentSize,
): NormalizedQuad {
  const map = (p: Point) => documentToNormalized(p, documentSize);
  return {
    topLeft: map(quad.topLeft),
    topRight: map(quad.topRight),
    bottomRight: map(quad.bottomRight),
    bottomLeft: map(quad.bottomLeft),
  };
}

export function normalizedQuadToDocument(
  quad: NormalizedQuad,
  documentSize: DocumentSize,
): NormalizedQuad {
  const map = (p: Point) => normalizedToDocument(p, documentSize);
  return {
    topLeft: map(quad.topLeft),
    topRight: map(quad.topRight),
    bottomRight: map(quad.bottomRight),
    bottomLeft: map(quad.bottomLeft),
  };
}

/**
 * Uniform document-px -> preview-CSS-px conversion. The photo-first canvas always fills its
 * preview box at a single uniform scale with no letterboxing (the Konva Stage's own width/height
 * matches the document's aspect ratio exactly — see EditorCanvas.tsx), so one scalar ratio
 * (previewSize.width / documentSize.width) is sufficient in both axes.
 */
export function documentToPreviewPoint(point: Point, scale: number): Point {
  return { x: point.x * scale, y: point.y * scale };
}

export function previewToDocumentPoint(point: Point, scale: number): Point {
  if (scale <= 0) return { x: 0, y: 0 };
  return { x: point.x / scale, y: point.y / scale };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectToQuadPoints(rect: Rect): [Point, Point, Point, Point] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

/**
 * Builds the initial perspective quad for a rectangular object entering "Fit to space" mode:
 * rotates the object's local screen rect corners into document space the same way Konva itself
 * renders a rotated Group (see fromLocalPoint in screenHitTest.ts) and normalizes to the 0-1
 * document fraction, so the quad starts exactly on top of the rectangle's current visible
 * position with no jump (sprint requirement: entering perspective mode must not visibly move
 * the object until the user drags a corner).
 */
export function rectTransformToQuad(
  localScreenRect: Rect,
  object: { x: number; y: number; rotation: number },
  documentSize: DocumentSize,
): NormalizedQuad {
  const [tl, tr, br, bl] = rectToQuadPoints(localScreenRect);
  const toDocument = (local: Point) => fromLocalPoint(local, object);
  return documentQuadToNormalized(
    {
      topLeft: toDocument(tl),
      topRight: toDocument(tr),
      bottomRight: toDocument(br),
      bottomLeft: toDocument(bl),
    },
    documentSize,
  );
}

export function quadBoundingBox(quad: NormalizedQuad): Rect {
  const points = quadPoints(quad);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Ray-casting point-in-polygon test; correct for the convex quads this module accepts. */
export function isPointInQuad(point: Point, quad: NormalizedQuad): boolean {
  const points = quadPoints(quad);
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Bilinear-patch interpolation across the quad corners for (u, v) in [0,1]x[0,1]. This is a
 * cheap, non-perspective-correct approximation (straight lines through the interior are not
 * preserved) kept only as a simple reference/fallback — `computeQuadHomography` below is the
 * mapping actually used for rendering and content-source mapping.
 */
export function bilinearInterpolateQuad(quad: NormalizedQuad, u: number, v: number): Point {
  const top = lerp(quad.topLeft, quad.topRight, u);
  const bottom = lerp(quad.bottomLeft, quad.bottomRight, u);
  return lerp(top, bottom, v);
}

/** Row-major projective transform [a b c; d e f; g h 1] stored as 8 params (bottom-right is always 1). */
export type Matrix3x3 = readonly [number, number, number, number, number, number, number, number];

/**
 * Solves the projective (homography) transform mapping the unit square corners (0,0) (1,0)
 * (1,1) (0,1) onto `quad`'s four corners in the same top-left/top-right/bottom-right/bottom-left
 * order, using the closed-form unit-square-to-quadrilateral solution (Heckbert, "Fundamentals of
 * Texture Mapping and Image Warping", 1989, section 5). This is the mapping used to warp the
 * composed screen texture (always authored in unit-square/local space) into the destination quad
 * (ADR 0008) — a plain affine/skew transform cannot reproduce arbitrary four-point perspective,
 * only a full projective transform can. Returns null for a degenerate quad (collinear points)
 * rather than an unstable/garbage matrix; callers should validate with `isQuadValid` first, which
 * already excludes the degenerate cases this can return null for.
 */
export function computeQuadHomography(quad: NormalizedQuad): Matrix3x3 | null {
  const [p0, p1, p2, p3] = quadPoints(quad);

  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  const c = p0.x;
  const f = p0.y;
  let a: number;
  let b: number;
  let d: number;
  let e: number;
  let g: number;
  let h: number;

  if (Math.abs(dx3) <= DEFAULT_EPSILON && Math.abs(dy3) <= DEFAULT_EPSILON) {
    a = p1.x - p0.x;
    b = p2.x - p1.x;
    d = p1.y - p0.y;
    e = p2.y - p1.y;
    g = 0;
    h = 0;
  } else {
    const denominator = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denominator) <= DEFAULT_EPSILON) return null;
    g = (dx3 * dy2 - dy3 * dx2) / denominator;
    h = (dx1 * dy3 - dy1 * dx3) / denominator;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
  }

  return [a, b, c, d, e, f, g, h];
}

/** Applies a homography to a point, dividing through by the homogeneous weight `w`. */
export function applyHomography(matrix: Matrix3x3, point: Point): Point {
  const [a, b, c, d, e, f, g, h] = matrix;
  const w = g * point.x + h * point.y + 1;
  if (Math.abs(w) <= DEFAULT_EPSILON) return { x: NaN, y: NaN };
  return {
    x: (a * point.x + b * point.y + c) / w,
    y: (d * point.x + e * point.y + f) / w,
  };
}

/**
 * Inverts a unit-square-to-quad homography, producing the quad-to-unit-square mapping (used to
 * find which normalized source (u, v) a document-space point corresponds to). The general 3x3
 * inverse's bottom-right entry is not automatically 1, so the result is renormalized by it before
 * being returned in the same reduced 8-param form. Returns null when the input (or its inverse)
 * is degenerate.
 */
export function invertHomography(matrix: Matrix3x3): Matrix3x3 | null {
  const [a, b, c, d, e, f, g, h] = matrix;
  const det = a * (e - f * h) - b * (d - f * g) + c * (d * h - e * g);
  if (Math.abs(det) <= DEFAULT_EPSILON) return null;

  const inv0 = (e - f * h) / det;
  const inv1 = -(b - c * h) / det;
  const inv2 = (b * f - c * e) / det;
  const inv3 = -(d - f * g) / det;
  const inv4 = (a - c * g) / det;
  const inv5 = -(a * f - c * d) / det;
  const inv6 = (d * h - e * g) / det;
  const inv7 = -(a * h - b * g) / det;
  const inv8 = (a * e - b * d) / det;
  if (Math.abs(inv8) <= DEFAULT_EPSILON) return null;

  return [
    inv0 / inv8,
    inv1 / inv8,
    inv2 / inv8,
    inv3 / inv8,
    inv4 / inv8,
    inv5 / inv8,
    inv6 / inv8,
    inv7 / inv8,
  ];
}

/**
 * Maps a pixel coordinate within a source image/video (of `sourceSize`) into quad space through
 * an already-computed unit-square-to-quad homography — the "source coordinates -> quad
 * destination" mapping used when warping uploaded content onto the signage screen.
 */
export function mapSourcePointToQuad(
  sourcePoint: Point,
  sourceSize: { width: number; height: number },
  homography: Matrix3x3,
): Point {
  const u = sourceSize.width > 0 ? sourcePoint.x / sourceSize.width : 0;
  const v = sourceSize.height > 0 ? sourcePoint.y / sourceSize.height : 0;
  return applyHomography(homography, { x: u, y: v });
}

export interface QuadMeshCell {
  /** Unit-square-space corners of this cell, order top-left/top-right/bottom-right/bottom-left. */
  src: [Point, Point, Point, Point];
  /** Same corners mapped into the quad's own coordinate space. */
  dst: [Point, Point, Point, Point];
}

/** Hard cap on mesh subdivision so a malformed FPS-driven redraw can never allocate unbounded cells. */
export const MAX_MESH_SUBDIVISIONS = 24;

/**
 * Subdivides the unit square into `subdivisions` x `subdivisions` cells and maps each cell's
 * corners through the quad's homography. Canvas 2D has no native projective transform, so a
 * renderer draws each small cell with a plain affine transform instead (see ScreenComposition);
 * as the number of cells grows, the piecewise-affine result converges to the true perspective
 * warp. Returns null when the quad's homography is degenerate.
 */
export function buildQuadMesh(quad: NormalizedQuad, subdivisions: number): QuadMeshCell[] | null {
  const homography = computeQuadHomography(quad);
  if (!homography) return null;
  const n = Math.max(1, Math.min(MAX_MESH_SUBDIVISIONS, Math.round(subdivisions)));
  const cells: QuadMeshCell[] = [];
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const v0 = j / n;
      const v1 = (j + 1) / n;
      const srcTopLeft = { x: u0, y: v0 };
      const srcTopRight = { x: u1, y: v0 };
      const srcBottomRight = { x: u1, y: v1 };
      const srcBottomLeft = { x: u0, y: v1 };
      cells.push({
        src: [srcTopLeft, srcTopRight, srcBottomRight, srcBottomLeft],
        dst: [
          applyHomography(homography, srcTopLeft),
          applyHomography(homography, srcTopRight),
          applyHomography(homography, srcBottomRight),
          applyHomography(homography, srcBottomLeft),
        ],
      });
    }
  }
  return cells;
}

/**
 * A 2D affine transform in `CanvasRenderingContext2D.setTransform(a, b, c, d, e, f)` parameter
 * order: maps (x, y) to (a*x + c*y + e, b*x + d*y + f).
 */
export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * Solves for the unique affine transform mapping `src`'s three points onto `dst`'s corresponding
 * three points (an affine transform has 6 degrees of freedom, exactly matched by 3 point
 * correspondences). Used to draw one `QuadMeshCell` at a time: Canvas 2D has no native projective
 * transform, so a renderer splits each mesh cell into two triangles and draws each with its own
 * affine transform (see PerspectiveScreenView.tsx) — as the mesh gets finer, the piecewise-affine
 * result converges to the true perspective warp `buildQuadMesh`'s homography describes. Returns
 * null when `src`'s three points are collinear (degenerate, no unique affine transform exists).
 */
export function solveAffine(
  src: readonly [Point, Point, Point],
  dst: readonly [Point, Point, Point],
): AffineMatrix | null {
  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;
  const ux = s1.x - s0.x;
  const uy = s1.y - s0.y;
  const vx = s2.x - s0.x;
  const vy = s2.y - s0.y;
  const denominator = ux * vy - vx * uy;
  if (Math.abs(denominator) <= DEFAULT_EPSILON) return null;

  const upx = d1.x - d0.x;
  const upy = d1.y - d0.y;
  const vpx = d2.x - d0.x;
  const vpy = d2.y - d0.y;

  const a = (upx * vy - vpx * uy) / denominator;
  const b = (upy * vy - vpy * uy) / denominator;
  const c = (vpx * ux - upx * vx) / denominator;
  const d = (vpy * ux - upy * vx) / denominator;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - d * s0.y;
  return { a, b, c, d, e, f };
}

export function applyAffine(matrix: AffineMatrix, point: Point): Point {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}
