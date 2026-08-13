import { describe, expect, it } from 'vitest';
import { computeSafeDimensions, MAX_DECODED_PIXELS } from '../../src/lib/imageSafety';

describe('computeSafeDimensions', () => {
  it('returns the input unchanged when it already fits under the pixel ceiling', () => {
    expect(computeSafeDimensions(1000, 800)).toEqual({
      width: 1000,
      height: 800,
      downscaled: false,
    });
  });

  it('returns the input unchanged when it fits exactly at the pixel ceiling', () => {
    // 8000 x 5000 = 40,000,000, exactly MAX_DECODED_PIXELS.
    expect(computeSafeDimensions(8000, 5000, MAX_DECODED_PIXELS)).toEqual({
      width: 8000,
      height: 5000,
      downscaled: false,
    });
  });

  it('downscales both axes by the same factor when the input exceeds the pixel ceiling', () => {
    // 10000 x 10000 = 100,000,000, well over a 40,000,000 ceiling; scale = sqrt(0.4) = 0.6324...
    const result = computeSafeDimensions(10000, 10000, 40_000_000);

    expect(result.downscaled).toBe(true);
    expect(result.width).toBe(result.height);
    // Per-axis rounding can push the result a negligible amount over the exact ceiling.
    expect(result.width * result.height).toBeLessThanOrEqual(40_000_000 * 1.001);
    // The aspect ratio (1:1 here) is preserved.
    expect(result.width / result.height).toBeCloseTo(1, 5);
  });

  it('preserves a non-square aspect ratio when downscaling', () => {
    const result = computeSafeDimensions(20000, 10000, 40_000_000);

    expect(result.downscaled).toBe(true);
    expect(result.width / result.height).toBeCloseTo(2, 2);
    expect(result.width * result.height).toBeLessThanOrEqual(40_000_000);
  });

  it('never returns a dimension smaller than 1px even for extreme aspect ratios', () => {
    const result = computeSafeDimensions(1_000_000, 1, 40_000_000);

    expect(result.height).toBeGreaterThanOrEqual(1);
    expect(result.width).toBeGreaterThanOrEqual(1);
  });

  it('treats zero or negative pixel counts as already-safe rather than dividing by zero', () => {
    expect(computeSafeDimensions(0, 500)).toEqual({ width: 0, height: 500, downscaled: false });
  });

  it('defaults to MAX_DECODED_PIXELS when no ceiling is passed', () => {
    const overLimit = computeSafeDimensions(9000, 9000);
    expect(overLimit.downscaled).toBe(true);
    expect(overLimit.width * overLimit.height).toBeLessThanOrEqual(MAX_DECODED_PIXELS * 1.001);
  });
});
