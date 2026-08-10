import { describe, expect, it } from 'vitest';
import {
  clampNormalizedRect,
  computeDefaultPortableSize,
  defaultScreenRegion,
  isNormalizedRectLargeEnough,
  moveNormalizedRect,
  MIN_SCREEN_REGION_FRACTION,
  normalizedRectFromPoints,
  previewPointToNormalized,
  resizeNormalizedRect,
} from '../../src/lib/portableRegion';

describe('clampNormalizedRect', () => {
  it('leaves an already-valid rect unchanged', () => {
    expect(clampNormalizedRect({ x: 0.2, y: 0.3, width: 0.4, height: 0.5 })).toEqual({
      x: 0.2,
      y: 0.3,
      width: 0.4,
      height: 0.5,
    });
  });

  it('clamps width and height to the 0-1 range', () => {
    expect(clampNormalizedRect({ x: 0, y: 0, width: 1.5, height: -0.5 })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 0,
    });
  });

  it('pulls x/y back so the rect stays inside the unit square, preserving size', () => {
    expect(clampNormalizedRect({ x: 0.9, y: 0.9, width: 0.4, height: 0.3 })).toEqual({
      x: 0.6,
      y: 0.7,
      width: 0.4,
      height: 0.3,
    });
  });

  it('clamps negative x/y back to 0', () => {
    expect(clampNormalizedRect({ x: -0.5, y: -0.2, width: 0.3, height: 0.3 })).toEqual({
      x: 0,
      y: 0,
      width: 0.3,
      height: 0.3,
    });
  });
});

describe('isNormalizedRectLargeEnough', () => {
  it('accepts a rect at exactly the minimum fraction on both axes', () => {
    expect(
      isNormalizedRectLargeEnough({
        x: 0,
        y: 0,
        width: MIN_SCREEN_REGION_FRACTION,
        height: MIN_SCREEN_REGION_FRACTION,
      }),
    ).toBe(true);
  });

  it('rejects a rect narrower than the minimum on either axis', () => {
    expect(isNormalizedRectLargeEnough({ x: 0, y: 0, width: 0.01, height: 0.5 })).toBe(false);
    expect(isNormalizedRectLargeEnough({ x: 0, y: 0, width: 0.5, height: 0.01 })).toBe(false);
  });
});

describe('defaultScreenRegion', () => {
  it('returns a centered, large-enough starting region', () => {
    const region = defaultScreenRegion();

    expect(isNormalizedRectLargeEnough(region)).toBe(true);
    expect(region.x + region.width).toBeLessThanOrEqual(1);
    expect(region.y + region.height).toBeLessThanOrEqual(1);
  });
});

describe('normalizedRectFromPoints', () => {
  it('builds a rect from top-left to bottom-right corners', () => {
    const result = normalizedRectFromPoints({ x: 0.1, y: 0.2 }, { x: 0.6, y: 0.7 });
    expect(result.x).toBeCloseTo(0.1);
    expect(result.y).toBeCloseTo(0.2);
    expect(result.width).toBeCloseTo(0.5);
    expect(result.height).toBeCloseTo(0.5);
  });

  it('is order-independent (bottom-right to top-left gives the same rect)', () => {
    const result = normalizedRectFromPoints({ x: 0.6, y: 0.7 }, { x: 0.1, y: 0.2 });
    expect(result.x).toBeCloseTo(0.1);
    expect(result.y).toBeCloseTo(0.2);
    expect(result.width).toBeCloseTo(0.5);
    expect(result.height).toBeCloseTo(0.5);
  });

  it('clamps points outside the unit square', () => {
    expect(normalizedRectFromPoints({ x: -0.5, y: -0.5 }, { x: 1.5, y: 1.5 })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });
});

describe('previewPointToNormalized', () => {
  it('converts a pixel point within the preview to a 0-1 fraction', () => {
    expect(previewPointToNormalized({ x: 50, y: 25 }, { width: 200, height: 100 })).toEqual({
      x: 0.25,
      y: 0.25,
    });
  });

  it('clamps points outside the preview bounds', () => {
    expect(previewPointToNormalized({ x: -10, y: 300 }, { width: 200, height: 100 })).toEqual({
      x: 0,
      y: 1,
    });
  });

  it('returns the origin when the preview has no measured size', () => {
    expect(previewPointToNormalized({ x: 50, y: 50 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('moveNormalizedRect', () => {
  it('translates a rect by the given delta', () => {
    const result = moveNormalizedRect(
      { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
      { dx: 0.1, dy: -0.05 },
    );
    expect(result.x).toBeCloseTo(0.3);
    expect(result.y).toBeCloseTo(0.15);
    expect(result.width).toBe(0.3);
    expect(result.height).toBe(0.3);
  });

  it('clamps the move so the rect stays inside the unit square', () => {
    expect(
      moveNormalizedRect({ x: 0.8, y: 0.8, width: 0.3, height: 0.3 }, { dx: 0.5, dy: 0.5 }),
    ).toEqual({ x: 0.7, y: 0.7, width: 0.3, height: 0.3 });
  });
});

describe('resizeNormalizedRect', () => {
  const base = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };

  it('dragging the se handle keeps the nw corner fixed', () => {
    const result = resizeNormalizedRect(base, 'se', { x: 0.8, y: 0.9 });
    expect(result.x).toBeCloseTo(0.2);
    expect(result.y).toBeCloseTo(0.2);
    expect(result.width).toBeCloseTo(0.6);
    expect(result.height).toBeCloseTo(0.7);
  });

  it('dragging the nw handle keeps the se corner fixed', () => {
    const result = resizeNormalizedRect(base, 'nw', { x: 0.1, y: 0.1 });
    expect(result.x).toBeCloseTo(0.1);
    expect(result.y).toBeCloseTo(0.1);
    expect(result.width).toBeCloseTo(0.5);
    expect(result.height).toBeCloseTo(0.5);
  });

  it('dragging the ne handle keeps the sw corner fixed', () => {
    const result = resizeNormalizedRect(base, 'ne', { x: 0.7, y: 0.1 });
    expect(result.x).toBeCloseTo(0.2);
    expect(result.y).toBeCloseTo(0.1);
    expect(result.width).toBeCloseTo(0.5);
    expect(result.height).toBeCloseTo(0.5);
  });

  it('dragging the sw handle keeps the ne corner fixed', () => {
    const result = resizeNormalizedRect(base, 'sw', { x: 0.1, y: 0.7 });
    expect(result.x).toBeCloseTo(0.1);
    expect(result.y).toBeCloseTo(0.2);
    expect(result.width).toBeCloseTo(0.5);
    expect(result.height).toBeCloseTo(0.5);
  });

  it('clamps the drag point to the unit square', () => {
    expect(resizeNormalizedRect(base, 'se', { x: 1.5, y: 1.5 })).toEqual({
      x: 0.2,
      y: 0.2,
      width: 0.8,
      height: 0.8,
    });
  });
});

describe('computeDefaultPortableSize', () => {
  const template = { width: 1920, height: 1080 };

  it('scales a wide photo down to fit within half the template width', () => {
    const size = computeDefaultPortableSize({ width: 4000, height: 1000 }, template);

    expect(size.width).toBeLessThanOrEqual(template.width * 0.5);
    expect(size.height).toBeLessThanOrEqual(template.height * 0.5);
    expect(size.width / size.height).toBeCloseTo(4000 / 1000);
  });

  it('scales a tall photo down to fit within half the template height', () => {
    const size = computeDefaultPortableSize({ width: 1000, height: 4000 }, template);

    expect(size.width).toBeLessThanOrEqual(template.width * 0.5);
    expect(size.height).toBeLessThanOrEqual(template.height * 0.5);
    expect(size.width / size.height).toBeCloseTo(1000 / 4000);
  });

  it('preserves the intrinsic aspect ratio exactly', () => {
    const size = computeDefaultPortableSize({ width: 1200, height: 800 }, template);

    expect(size.width / size.height).toBeCloseTo(1200 / 800);
  });
});
