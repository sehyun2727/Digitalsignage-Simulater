import { describe, expect, it } from 'vitest';
import {
  applyHomography,
  bilinearInterpolateQuad,
  buildQuadMesh,
  clampPoint01,
  clampQuad01,
  computeQuadHomography,
  documentQuadToNormalized,
  documentToNormalized,
  documentToPreviewPoint,
  edgeLength,
  invertHomography,
  isFiniteQuad,
  isPointInQuad,
  isQuadAreaValid,
  isQuadConvex,
  isQuadEdgeLengthValid,
  isQuadSelfIntersecting,
  isQuadValid,
  mapSourcePointToQuad,
  MIN_QUAD_AREA_FRACTION,
  MIN_QUAD_EDGE_LENGTH,
  normalizedQuadToDocument,
  normalizedToDocument,
  pointsEqual,
  previewToDocumentPoint,
  quadArea,
  quadBoundingBox,
  quadEdgeLengths,
  quadPoints,
  quadsEqual,
  quadWinding,
  rectTransformToQuad,
  rectToQuadPoints,
  segmentsIntersect,
  signedArea,
  validateQuad,
} from '../../src/lib/quadGeometry';
import type { NormalizedQuad } from '../../src/lib/quadGeometry';

const RECT_QUAD: NormalizedQuad = {
  topLeft: { x: 0.1, y: 0.1 },
  topRight: { x: 0.9, y: 0.1 },
  bottomRight: { x: 0.9, y: 0.9 },
  bottomLeft: { x: 0.1, y: 0.9 },
};

const TRAPEZOID_QUAD: NormalizedQuad = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomRight: { x: 0.8, y: 1 },
  bottomLeft: { x: 0.2, y: 1 },
};

describe('clampPoint01 / clampQuad01', () => {
  it('leaves in-range points unchanged', () => {
    expect(clampPoint01({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('clamps out-of-range coordinates to 0-1', () => {
    expect(clampPoint01({ x: -0.2, y: 1.4 })).toEqual({ x: 0, y: 1 });
  });

  it('clamps every corner of a quad independently', () => {
    const quad = clampQuad01({
      topLeft: { x: -1, y: -1 },
      topRight: { x: 2, y: -1 },
      bottomRight: { x: 2, y: 2 },
      bottomLeft: { x: -1, y: 2 },
    });
    expect(quad).toEqual(RECT_QUAD_LIKE_UNIT());
  });
});

function RECT_QUAD_LIKE_UNIT(): NormalizedQuad {
  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomRight: { x: 1, y: 1 },
    bottomLeft: { x: 0, y: 1 },
  };
}

describe('pointsEqual / quadsEqual', () => {
  it('treats points within epsilon as equal', () => {
    expect(pointsEqual({ x: 0.1, y: 0.2 }, { x: 0.1000001, y: 0.2000001 })).toBe(true);
  });

  it('treats points outside epsilon as different', () => {
    expect(pointsEqual({ x: 0.1, y: 0.2 }, { x: 0.11, y: 0.2 })).toBe(false);
  });

  it('compares all four corners for quad equality', () => {
    expect(quadsEqual(RECT_QUAD, { ...RECT_QUAD })).toBe(true);
    expect(quadsEqual(RECT_QUAD, TRAPEZOID_QUAD)).toBe(false);
  });
});

describe('isFiniteQuad', () => {
  it('is true for a normal quad', () => {
    expect(isFiniteQuad(RECT_QUAD)).toBe(true);
  });

  it('is false when any coordinate is NaN or infinite', () => {
    expect(
      isFiniteQuad({ ...RECT_QUAD, topLeft: { x: NaN, y: 0.1 } }),
    ).toBe(false);
    expect(
      isFiniteQuad({ ...RECT_QUAD, bottomRight: { x: Infinity, y: 0.9 } }),
    ).toBe(false);
  });
});

describe('signedArea / quadArea / quadWinding', () => {
  it('computes the area of an axis-aligned quad', () => {
    expect(quadArea(RECT_QUAD)).toBeCloseTo(0.64, 6);
  });

  it('reports cw winding for a quad walked in its intended TL/TR/BR/BL orientation', () => {
    expect(quadWinding(RECT_QUAD)).toBe('cw');
  });

  it('reports ccw winding when the quad is mirrored', () => {
    const mirrored: NormalizedQuad = {
      topLeft: RECT_QUAD.topRight,
      topRight: RECT_QUAD.topLeft,
      bottomRight: RECT_QUAD.bottomLeft,
      bottomLeft: RECT_QUAD.bottomRight,
    };
    expect(quadWinding(mirrored)).toBe('ccw');
  });

  it('reports degenerate winding for a zero-area quad', () => {
    const collapsed: NormalizedQuad = {
      topLeft: { x: 0.5, y: 0.5 },
      topRight: { x: 0.5, y: 0.5 },
      bottomRight: { x: 0.5, y: 0.5 },
      bottomLeft: { x: 0.5, y: 0.5 },
    };
    expect(quadWinding(collapsed)).toBe('degenerate');
  });

  it('matches a manual shoelace computation for a known trapezoid', () => {
    // Trapezoid area = average of the two parallel (top/bottom) sides * height = (1 + 0.6)/2 * 1.
    const points = quadPoints(TRAPEZOID_QUAD);
    expect(signedArea(points)).toBeCloseTo(0.8, 6);
  });
});

describe('edgeLength / quadEdgeLengths', () => {
  it('computes euclidean distance between two points', () => {
    expect(edgeLength({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 6);
  });

  it('computes all four edges of a quad', () => {
    expect(quadEdgeLengths(RECT_QUAD)).toEqual({
      top: 0.8,
      right: 0.8,
      bottom: 0.8,
      left: 0.8,
    });
  });
});

describe('isQuadEdgeLengthValid / isQuadAreaValid', () => {
  it('accepts a quad at exactly the minimum edge length', () => {
    const quad: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: MIN_QUAD_EDGE_LENGTH, y: 0 },
      bottomRight: { x: MIN_QUAD_EDGE_LENGTH, y: MIN_QUAD_EDGE_LENGTH },
      bottomLeft: { x: 0, y: MIN_QUAD_EDGE_LENGTH },
    };
    expect(isQuadEdgeLengthValid(quad)).toBe(true);
  });

  it('rejects a quad with one edge under the minimum', () => {
    const quad: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: MIN_QUAD_EDGE_LENGTH / 2, y: 0 },
      bottomRight: { x: MIN_QUAD_EDGE_LENGTH / 2, y: 0.5 },
      bottomLeft: { x: 0, y: 0.5 },
    };
    expect(isQuadEdgeLengthValid(quad)).toBe(false);
  });

  it('accepts a quad at exactly the minimum area fraction', () => {
    const side = Math.sqrt(MIN_QUAD_AREA_FRACTION);
    const quad: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: side, y: 0 },
      bottomRight: { x: side, y: side },
      bottomLeft: { x: 0, y: side },
    };
    expect(isQuadAreaValid(quad)).toBe(true);
  });

  it('rejects a quad under the minimum area', () => {
    const side = Math.sqrt(MIN_QUAD_AREA_FRACTION) / 2;
    const quad: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: side, y: 0 },
      bottomRight: { x: side, y: side },
      bottomLeft: { x: 0, y: side },
    };
    expect(isQuadAreaValid(quad)).toBe(false);
  });
});

describe('segmentsIntersect', () => {
  it('detects a crossing pair of segments', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }),
    ).toBe(true);
  });

  it('does not report non-crossing parallel segments as intersecting', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }),
    ).toBe(false);
  });
});

describe('isQuadSelfIntersecting', () => {
  it('is false for a normal rectangle', () => {
    expect(isQuadSelfIntersecting(RECT_QUAD)).toBe(false);
  });

  it('is false for a valid trapezoid', () => {
    expect(isQuadSelfIntersecting(TRAPEZOID_QUAD)).toBe(false);
  });

  it('is true for a bowtie quad (crossed left/right edges)', () => {
    const bowtie: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 1 },
      bottomRight: { x: 1, y: 0 },
      bottomLeft: { x: 0, y: 1 },
    };
    expect(isQuadSelfIntersecting(bowtie)).toBe(true);
  });
});

describe('isQuadConvex', () => {
  it('accepts a rectangle', () => {
    expect(isQuadConvex(RECT_QUAD)).toBe(true);
  });

  it('accepts a trapezoid', () => {
    expect(isQuadConvex(TRAPEZOID_QUAD)).toBe(true);
  });

  it('rejects a concave (arrow-shaped) quad', () => {
    const concave: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 0.5, y: 0.3 },
      bottomLeft: { x: 0, y: 1 },
    };
    expect(isQuadConvex(concave)).toBe(false);
  });

  it('rejects a self-intersecting bowtie quad', () => {
    const bowtie: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 1 },
      bottomRight: { x: 1, y: 0 },
      bottomLeft: { x: 0, y: 1 },
    };
    expect(isQuadConvex(bowtie)).toBe(false);
  });
});

describe('validateQuad / isQuadValid', () => {
  it('accepts a valid rectangle', () => {
    expect(validateQuad(RECT_QUAD)).toEqual({ valid: true });
  });

  it('accepts a valid trapezoid', () => {
    expect(validateQuad(TRAPEZOID_QUAD)).toEqual({ valid: true });
  });

  it('rejects non-finite coordinates', () => {
    const quad = { ...RECT_QUAD, topLeft: { x: NaN, y: 0.1 } };
    expect(validateQuad(quad)).toEqual({ valid: false, reason: 'invalid-values' });
  });

  it('rejects a quad outside document bounds', () => {
    const quad = { ...RECT_QUAD, topRight: { x: 1.5, y: 0.1 } };
    expect(validateQuad(quad)).toEqual({ valid: false, reason: 'out-of-bounds' });
  });

  it('rejects a self-intersecting quad', () => {
    const bowtie: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 1 },
      bottomRight: { x: 1, y: 0 },
      bottomLeft: { x: 0, y: 1 },
    };
    expect(validateQuad(bowtie)).toEqual({ valid: false, reason: 'self-intersecting' });
  });

  it('rejects a concave quad', () => {
    const concave: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 0.5, y: 0.3 },
      bottomLeft: { x: 0, y: 1 },
    };
    expect(validateQuad(concave)).toEqual({ valid: false, reason: 'concave' });
  });

  it('rejects a quad under the minimum area even though every edge clears the minimum length', () => {
    // 0.03 x 0.03 square: edges (0.03) clear MIN_QUAD_EDGE_LENGTH (0.02) but area (0.0009)
    // is well under MIN_QUAD_AREA_FRACTION (0.01), isolating the area check from the edge check.
    const tiny: NormalizedQuad = {
      topLeft: { x: 0.5, y: 0.5 },
      topRight: { x: 0.53, y: 0.5 },
      bottomRight: { x: 0.53, y: 0.53 },
      bottomLeft: { x: 0.5, y: 0.53 },
    };
    expect(validateQuad(tiny)).toEqual({ valid: false, reason: 'min-area' });
  });

  it('rejects a quad with an edge under the minimum length before checking area', () => {
    const quad: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: MIN_QUAD_EDGE_LENGTH / 2, y: 0 },
      bottomRight: { x: MIN_QUAD_EDGE_LENGTH / 2, y: 0.9 },
      bottomLeft: { x: 0, y: 0.9 },
    };
    expect(validateQuad(quad).reason).toBe('min-edge');
  });

  it('isQuadValid mirrors validateQuad.valid', () => {
    expect(isQuadValid(RECT_QUAD)).toBe(true);
    expect(isQuadValid({ ...RECT_QUAD, topLeft: { x: NaN, y: 0 } })).toBe(false);
  });
});

describe('documentToNormalized / normalizedToDocument', () => {
  it('round-trips a document point through normalized space', () => {
    const documentSize = { width: 1920, height: 1080 };
    const point = { x: 480, y: 270 };
    const normalized = documentToNormalized(point, documentSize);
    expect(normalized).toEqual({ x: 0.25, y: 0.25 });
    expect(normalizedToDocument(normalized, documentSize)).toEqual(point);
  });

  it('returns the origin for a degenerate document size', () => {
    expect(documentToNormalized({ x: 10, y: 10 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('round-trips a whole quad through document<->normalized conversion', () => {
    const documentSize = { width: 800, height: 400 };
    const documentQuad = normalizedQuadToDocument(TRAPEZOID_QUAD, documentSize);
    expect(documentQuadToNormalized(documentQuad, documentSize)).toEqual(TRAPEZOID_QUAD);
  });
});

describe('documentToPreviewPoint / previewToDocumentPoint', () => {
  it('scales a document point down to preview CSS pixels and back', () => {
    const point = { x: 400, y: 200 };
    const preview = documentToPreviewPoint(point, 0.5);
    expect(preview).toEqual({ x: 200, y: 100 });
    expect(previewToDocumentPoint(preview, 0.5)).toEqual(point);
  });

  it('returns the origin for a non-positive scale', () => {
    expect(previewToDocumentPoint({ x: 10, y: 10 }, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('rectToQuadPoints / rectTransformToQuad', () => {
  it('produces corners in top-left/top-right/bottom-right/bottom-left order', () => {
    expect(rectToQuadPoints({ x: 10, y: 20, width: 100, height: 50 })).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 },
    ]);
  });

  it('derives an axis-aligned quad for an unrotated object matching its screen rect', () => {
    const documentSize = { width: 1000, height: 1000 };
    const object = { x: 100, y: 100, rotation: 0 };
    const localScreenRect = { x: 0, y: 0, width: 200, height: 100 };
    const quad = rectTransformToQuad(localScreenRect, object, documentSize);
    expect(quad).toEqual({
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.3, y: 0.1 },
      bottomRight: { x: 0.3, y: 0.2 },
      bottomLeft: { x: 0.1, y: 0.2 },
    });
  });

  it('rotates the quad around the object origin for a rotated object', () => {
    const documentSize = { width: 400, height: 400 };
    const object = { x: 200, y: 200, rotation: 90 };
    const localScreenRect = { x: 0, y: 0, width: 100, height: 50 };
    const quad = rectTransformToQuad(localScreenRect, object, documentSize);
    // A 90deg rotation sends local (100,0) to document (200,300) => normalized (0.5, 0.75)
    expect(quad.topRight.x).toBeCloseTo(0.5, 6);
    expect(quad.topRight.y).toBeCloseTo(0.75, 6);
  });
});

describe('quadBoundingBox', () => {
  it('computes the bounding box of an axis-aligned quad', () => {
    expect(quadBoundingBox(RECT_QUAD)).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  });

  it('computes the bounding box of a trapezoid', () => {
    expect(quadBoundingBox(TRAPEZOID_QUAD)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe('isPointInQuad', () => {
  it('accepts the center of a rectangle', () => {
    expect(isPointInQuad({ x: 0.5, y: 0.5 }, RECT_QUAD)).toBe(true);
  });

  it('rejects a point outside the rectangle', () => {
    expect(isPointInQuad({ x: 0.05, y: 0.05 }, RECT_QUAD)).toBe(false);
  });

  it('correctly narrows the target as the trapezoid narrows toward the bottom', () => {
    expect(isPointInQuad({ x: 0.1, y: 0.95 }, TRAPEZOID_QUAD)).toBe(false);
    expect(isPointInQuad({ x: 0.5, y: 0.95 }, TRAPEZOID_QUAD)).toBe(true);
  });
});

describe('bilinearInterpolateQuad', () => {
  it('returns each corner at its own (u, v)', () => {
    expect(bilinearInterpolateQuad(TRAPEZOID_QUAD, 0, 0)).toEqual(TRAPEZOID_QUAD.topLeft);
    expect(bilinearInterpolateQuad(TRAPEZOID_QUAD, 1, 0)).toEqual(TRAPEZOID_QUAD.topRight);
    expect(bilinearInterpolateQuad(TRAPEZOID_QUAD, 1, 1)).toEqual(TRAPEZOID_QUAD.bottomRight);
    expect(bilinearInterpolateQuad(TRAPEZOID_QUAD, 0, 1)).toEqual(TRAPEZOID_QUAD.bottomLeft);
  });

  it('returns the exact center for an axis-aligned rectangle', () => {
    expect(bilinearInterpolateQuad(RECT_QUAD, 0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('computeQuadHomography', () => {
  it('maps the unit square onto itself as the identity', () => {
    const homography = computeQuadHomography(RECT_QUAD_LIKE_UNIT());
    expect(homography).not.toBeNull();
    expect(applyHomography(homography!, { x: 0.3, y: 0.7 })).toEqual({ x: 0.3, y: 0.7 });
  });

  it('reproduces every corner of a known rectangle', () => {
    const homography = computeQuadHomography(RECT_QUAD);
    expect(homography).not.toBeNull();
    expect(applyHomography(homography!, { x: 0, y: 0 })).toEqual(RECT_QUAD.topLeft);
    expect(applyHomography(homography!, { x: 1, y: 0 })).toEqual(RECT_QUAD.topRight);
    expect(applyHomography(homography!, { x: 1, y: 1 })).toEqual(RECT_QUAD.bottomRight);
    expect(applyHomography(homography!, { x: 0, y: 1 })).toEqual(RECT_QUAD.bottomLeft);
  });

  it('reproduces every corner of a known trapezoid and maps the midline correctly', () => {
    const homography = computeQuadHomography(TRAPEZOID_QUAD);
    expect(homography).not.toBeNull();
    const tl = applyHomography(homography!, { x: 0, y: 0 });
    const tr = applyHomography(homography!, { x: 1, y: 0 });
    const br = applyHomography(homography!, { x: 1, y: 1 });
    const bl = applyHomography(homography!, { x: 0, y: 1 });
    expect(tl.x).toBeCloseTo(TRAPEZOID_QUAD.topLeft.x, 6);
    expect(tl.y).toBeCloseTo(TRAPEZOID_QUAD.topLeft.y, 6);
    expect(tr.x).toBeCloseTo(TRAPEZOID_QUAD.topRight.x, 6);
    expect(br.x).toBeCloseTo(TRAPEZOID_QUAD.bottomRight.x, 6);
    expect(br.y).toBeCloseTo(TRAPEZOID_QUAD.bottomRight.y, 6);
    expect(bl.x).toBeCloseTo(TRAPEZOID_QUAD.bottomLeft.x, 6);

    // The bottom-edge midpoint (u=0.5, v=1) must land exactly on the midpoint between
    // bottomLeft and bottomRight — a known-fixture check that the projective (not merely
    // affine/bilinear) solve is being used.
    const bottomMid = applyHomography(homography!, { x: 0.5, y: 1 });
    expect(bottomMid.x).toBeCloseTo(0.5, 6);
    expect(bottomMid.y).toBeCloseTo(1, 6);
  });

  it('returns null for a degenerate quad whose projective solve denominator is zero', () => {
    // (topRight - bottomRight) and (bottomLeft - bottomRight) are parallel (both vertical),
    // which drives the closed-form solve's denominator to exactly zero.
    const degenerate: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 1, y: 0.5 },
    };
    expect(computeQuadHomography(degenerate)).toBeNull();
  });
});

describe('invertHomography', () => {
  it('inverts the identity mapping to itself', () => {
    const homography = computeQuadHomography(RECT_QUAD_LIKE_UNIT())!;
    const inverse = invertHomography(homography);
    expect(inverse).not.toBeNull();
    expect(applyHomography(inverse!, { x: 0.4, y: 0.6 })).toEqual({ x: 0.4, y: 0.6 });
  });

  it('composing forward and inverse mappings recovers the original point for a trapezoid', () => {
    const homography = computeQuadHomography(TRAPEZOID_QUAD)!;
    const inverse = invertHomography(homography)!;
    const source = { x: 0.35, y: 0.65 };
    const forward = applyHomography(homography, source);
    const back = applyHomography(inverse, forward);
    expect(back.x).toBeCloseTo(source.x, 6);
    expect(back.y).toBeCloseTo(source.y, 6);
  });

  it('returns null for a degenerate matrix', () => {
    // g/h chosen so the homogeneous weight is identically zero along a line through the origin,
    // which also collapses the determinant used by invertHomography.
    expect(invertHomography([0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });
});

describe('mapSourcePointToQuad', () => {
  it('maps the source image center into the quad center for a rectangle', () => {
    const homography = computeQuadHomography(RECT_QUAD)!;
    const mapped = mapSourcePointToQuad({ x: 50, y: 50 }, { width: 100, height: 100 }, homography);
    expect(mapped.x).toBeCloseTo(0.5, 6);
    expect(mapped.y).toBeCloseTo(0.5, 6);
  });
});

describe('buildQuadMesh', () => {
  it('returns n*n cells whose dst corners are continuous between neighboring cells', () => {
    const cells = buildQuadMesh(TRAPEZOID_QUAD, 4);
    expect(cells).not.toBeNull();
    expect(cells!.length).toBe(16);
    // First cell's top-right dst corner must match the second cell's top-left dst corner
    // (both cells map to the same unit-square (0.25, 0) point through the same homography).
    const first = cells![0]!;
    const second = cells![1]!;
    expect(first.dst[1].x).toBeCloseTo(second.dst[0].x, 6);
    expect(first.dst[1].y).toBeCloseTo(second.dst[0].y, 6);
  });

  it('clamps subdivisions into a sane bounded range', () => {
    expect(buildQuadMesh(RECT_QUAD, 0)!.length).toBe(1);
    expect(buildQuadMesh(RECT_QUAD, 1000)!.length).toBeLessThanOrEqual(24 * 24);
  });

  it('returns null for a degenerate quad', () => {
    const degenerate: NormalizedQuad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 1, y: 0.5 },
    };
    expect(buildQuadMesh(degenerate, 4)).toBeNull();
  });
});
