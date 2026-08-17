import { describe, expect, it } from 'vitest';
import {
  clampOcclusionSetting,
  clampPoint01,
  createOcclusionMask,
  DEFAULT_EPSILON,
  documentToNormalized,
  hasDuplicateAdjacentPoints,
  isFinitePoint,
  isOcclusionPolygonValid,
  isPolygonSelfIntersecting,
  MIN_OCCLUSION_AREA_FRACTION,
  normalizedToDocument,
  polygonArea,
  resolveOcclusionFeatherRadius,
  segmentsIntersect,
  signedArea,
  validateOcclusionPolygon,
} from '../../src/lib/occlusion';
import type { NormalizedPoint } from '../../src/types/editor';
import {
  DEFAULT_OCCLUSION_FEATHER,
  DEFAULT_OCCLUSION_OPACITY,
  MAX_OCCLUSION_POINTS,
} from '../../src/types/editor';

const TRIANGLE: NormalizedPoint[] = [
  { x: 0.1, y: 0.1 },
  { x: 0.4, y: 0.1 },
  { x: 0.25, y: 0.4 },
];

// A concave (non-convex) L-shape, deliberately used to prove validation does not require convexity.
const L_SHAPE: NormalizedPoint[] = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.1 },
  { x: 0.5, y: 0.3 },
  { x: 0.3, y: 0.3 },
  { x: 0.3, y: 0.5 },
  { x: 0.1, y: 0.5 },
];

const BOWTIE: NormalizedPoint[] = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.5 },
  { x: 0.5, y: 0.1 },
  { x: 0.1, y: 0.5 },
];

describe('clampPoint01', () => {
  it('leaves in-range points unchanged', () => {
    expect(clampPoint01({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('clamps out-of-range coordinates to 0-1', () => {
    expect(clampPoint01({ x: -0.2, y: 1.4 })).toEqual({ x: 0, y: 1 });
  });
});

describe('clampOcclusionSetting', () => {
  it('clamps below 0 and above 100', () => {
    expect(clampOcclusionSetting(-10)).toBe(0);
    expect(clampOcclusionSetting(150)).toBe(100);
  });

  it('leaves in-range values unchanged', () => {
    expect(clampOcclusionSetting(42)).toBe(42);
  });
});

describe('isFinitePoint', () => {
  it('is true for a normal point', () => {
    expect(isFinitePoint({ x: 0.5, y: 0.5 })).toBe(true);
  });

  it('is false when a coordinate is NaN or infinite', () => {
    expect(isFinitePoint({ x: NaN, y: 0.5 })).toBe(false);
    expect(isFinitePoint({ x: Infinity, y: 0.5 })).toBe(false);
  });
});

describe('signedArea / polygonArea', () => {
  it('matches a manual shoelace computation for a known triangle', () => {
    // Base 0.3 (0.1..0.4), height 0.3 (0.1..0.4) => area 0.045.
    expect(polygonArea(TRIANGLE)).toBeCloseTo(0.045, 6);
  });

  it('signedArea flips sign when winding is reversed', () => {
    const reversed = [...TRIANGLE].reverse();
    expect(signedArea(TRIANGLE)).toBeCloseTo(-signedArea(reversed), 6);
  });
});

describe('segmentsIntersect', () => {
  it('detects a crossing pair of segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 })).toBe(
      true,
    );
  });

  it('does not report non-crossing parallel segments as intersecting', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(
      false,
    );
  });
});

describe('isPolygonSelfIntersecting', () => {
  it('is false for a triangle (fewer than 4 points can never self-intersect)', () => {
    expect(isPolygonSelfIntersecting(TRIANGLE)).toBe(false);
  });

  it('is false for a concave but valid L-shape', () => {
    expect(isPolygonSelfIntersecting(L_SHAPE)).toBe(false);
  });

  it('is true for a bowtie polygon', () => {
    expect(isPolygonSelfIntersecting(BOWTIE)).toBe(true);
  });
});

describe('hasDuplicateAdjacentPoints', () => {
  it('is false when all adjacent points differ', () => {
    expect(hasDuplicateAdjacentPoints(TRIANGLE)).toBe(false);
  });

  it('is true when two adjacent points coincide within epsilon', () => {
    const points = [...TRIANGLE, { x: 0.25 + DEFAULT_EPSILON / 2, y: 0.4 }];
    expect(hasDuplicateAdjacentPoints(points)).toBe(true);
  });
});

describe('validateOcclusionPolygon / isOcclusionPolygonValid', () => {
  it('accepts a valid triangle', () => {
    expect(validateOcclusionPolygon(TRIANGLE)).toEqual({ valid: true });
    expect(isOcclusionPolygonValid(TRIANGLE)).toBe(true);
  });

  it('accepts a concave L-shape (convexity is not required)', () => {
    expect(validateOcclusionPolygon(L_SHAPE)).toEqual({ valid: true });
  });

  it('rejects fewer than the minimum number of points', () => {
    expect(
      validateOcclusionPolygon([
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2 },
      ]),
    ).toEqual({
      valid: false,
      reason: 'too-few-points',
    });
  });

  it('rejects more than the maximum number of points', () => {
    const tooMany: NormalizedPoint[] = Array.from({ length: MAX_OCCLUSION_POINTS + 1 }, (_, i) => ({
      x: 0.5 + 0.01 * Math.cos((i / (MAX_OCCLUSION_POINTS + 1)) * Math.PI * 2),
      y: 0.5 + 0.01 * Math.sin((i / (MAX_OCCLUSION_POINTS + 1)) * Math.PI * 2),
    }));
    expect(validateOcclusionPolygon(tooMany)).toEqual({ valid: false, reason: 'too-many-points' });
  });

  it('rejects non-finite coordinates', () => {
    const points = [...TRIANGLE.slice(0, 2), { x: NaN, y: 0.4 }];
    expect(validateOcclusionPolygon(points)).toEqual({ valid: false, reason: 'invalid-values' });
  });

  it('rejects a polygon with a point outside document bounds', () => {
    const points = [...TRIANGLE.slice(0, 2), { x: 1.5, y: 0.4 }];
    expect(validateOcclusionPolygon(points)).toEqual({ valid: false, reason: 'out-of-bounds' });
  });

  it('rejects a polygon with duplicate adjacent points', () => {
    const points = [...TRIANGLE, { x: TRIANGLE[0]!.x, y: TRIANGLE[0]!.y }];
    // Last point duplicates the first, which is adjacent via wraparound.
    expect(validateOcclusionPolygon(points).reason).toBe('duplicate-points');
  });

  it('rejects a self-intersecting (bowtie) polygon', () => {
    expect(validateOcclusionPolygon(BOWTIE)).toEqual({ valid: false, reason: 'self-intersecting' });
  });

  it('rejects a polygon under the minimum area fraction', () => {
    const side = Math.sqrt(MIN_OCCLUSION_AREA_FRACTION) / 2;
    const tiny: NormalizedPoint[] = [
      { x: 0.5, y: 0.5 },
      { x: 0.5 + side, y: 0.5 },
      { x: 0.5, y: 0.5 + side },
    ];
    expect(validateOcclusionPolygon(tiny)).toEqual({ valid: false, reason: 'min-area' });
  });

  it('isOcclusionPolygonValid mirrors validateOcclusionPolygon.valid', () => {
    expect(isOcclusionPolygonValid(BOWTIE)).toBe(false);
  });
});

describe('documentToNormalized / normalizedToDocument', () => {
  it('round-trips a document point through normalized space', () => {
    const documentSize = { width: 1000, height: 500 };
    const point = { x: 250, y: 100 };
    const normalized = documentToNormalized(point, documentSize);
    expect(normalized).toEqual({ x: 0.25, y: 0.2 });
    expect(normalizedToDocument(normalized, documentSize)).toEqual(point);
  });

  it('returns the origin for a degenerate document size', () => {
    expect(documentToNormalized({ x: 10, y: 10 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('resolveOcclusionFeatherRadius', () => {
  it('is zero for zero feather', () => {
    expect(resolveOcclusionFeatherRadius(0, 200, 100)).toBe(0);
  });

  it('scales with the larger bounding dimension', () => {
    expect(resolveOcclusionFeatherRadius(100, 200, 100)).toBeCloseTo(24, 6);
    expect(resolveOcclusionFeatherRadius(50, 200, 100)).toBeCloseTo(12, 6);
  });

  it('clamps out-of-range feather values before scaling', () => {
    expect(resolveOcclusionFeatherRadius(150, 200, 100)).toBeCloseTo(24, 6);
  });
});

describe('createOcclusionMask', () => {
  it('seeds default feather/opacity/enabled and stores the given points', () => {
    const mask = createOcclusionMask(TRIANGLE);
    expect(mask.kind).toBe('polygon');
    expect(mask.points).toEqual(TRIANGLE);
    expect(mask.feather).toBe(DEFAULT_OCCLUSION_FEATHER);
    expect(mask.opacity).toBe(DEFAULT_OCCLUSION_OPACITY);
    expect(mask.enabled).toBe(true);
  });

  it('generates a non-empty id, unique per call', () => {
    const a = createOcclusionMask(TRIANGLE);
    const b = createOcclusionMask(TRIANGLE);
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });
});
