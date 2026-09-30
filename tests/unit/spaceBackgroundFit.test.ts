import { describe, expect, it } from 'vitest';
import {
  clampSpaceBackgroundOffsetY,
  computeCoverFit,
} from '../../src/lib/spaceBackgroundFit';

describe('computeCoverFit', () => {
  it('cover-fits a landscape photo into a landscape canvas with no crop when aspect matches', () => {
    const fit = computeCoverFit(1920, 1080, 1920, 1080);
    expect(fit).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('cover-fits a portrait photo into a landscape canvas by scaling to canvas width and overflowing vertically', () => {
    const fit = computeCoverFit(1080, 1920, 1920, 1080);
    expect(fit.width).toBe(1920);
    expect(fit.height).toBeCloseTo(3413.33, 1);
    expect(fit.x).toBe(0);
    // Centered vertically, so y is negative by half the overflow.
    expect(fit.y).toBeCloseTo(-(fit.height - 1080) / 2, 1);
  });
});

describe('clampSpaceBackgroundOffsetY', () => {
  it('returns 0 when the photo fits the canvas height (no overflow to pan)', () => {
    expect(clampSpaceBackgroundOffsetY(1080, 1080, 500)).toBe(0);
    expect(clampSpaceBackgroundOffsetY(1080, 800, -500)).toBe(0);
  });

  it('allows panning up to half the overflow in either direction', () => {
    // Overflow = 3840 - 1080 = 2760; half = 1380.
    expect(clampSpaceBackgroundOffsetY(1080, 3840, 500)).toBe(500);
    expect(clampSpaceBackgroundOffsetY(1080, 3840, -500)).toBe(-500);
    expect(clampSpaceBackgroundOffsetY(1080, 3840, 1380)).toBe(1380);
    expect(clampSpaceBackgroundOffsetY(1080, 3840, -1380)).toBe(-1380);
  });

  it('clamps offsets beyond the half-overflow range', () => {
    // half = 1380 for the 1080/3840 case; anything past that pins to ±1380.
    expect(clampSpaceBackgroundOffsetY(1080, 3840, 5000)).toBe(1380);
    expect(clampSpaceBackgroundOffsetY(1080, 3840, -5000)).toBe(-1380);
  });

  it('treats a zero-height canvas as no valid pan range', () => {
    expect(clampSpaceBackgroundOffsetY(0, 100, 50)).toBe(50);
  });
});
