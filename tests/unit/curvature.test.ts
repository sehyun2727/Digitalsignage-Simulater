import { describe, expect, it } from 'vitest';
import {
  clampCurvatureAmount,
  computeCurvatureOutlinePoints,
  computeCurvatureStrips,
  isCurvatureSupported,
} from '../../src/lib/curvature';

const screen = { x: 0, y: 0, width: 200, height: 100 };

describe('isCurvatureSupported', () => {
  it('is supported for LED and Transparent LED', () => {
    expect(isCurvatureSupported('led')).toBe(true);
    expect(isCurvatureSupported('transparent-led')).toBe(true);
  });

  it('is not supported for LCD (or the legacy outdoor-led value)', () => {
    expect(isCurvatureSupported('lcd')).toBe(false);
    expect(isCurvatureSupported('outdoor-led')).toBe(false);
  });
});

describe('clampCurvatureAmount', () => {
  it('clamps to the 0-100 range', () => {
    expect(clampCurvatureAmount(-10)).toBe(0);
    expect(clampCurvatureAmount(150)).toBe(100);
    expect(clampCurvatureAmount(50)).toBe(50);
  });
});

describe('computeCurvatureStrips', () => {
  it('returns no strips for flat curvature', () => {
    expect(computeCurvatureStrips(screen, { mode: 'flat', amount: 100 })).toEqual([]);
  });

  it('returns no strips when amount is zero, regardless of mode', () => {
    expect(computeCurvatureStrips(screen, { mode: 'convex', amount: 0 })).toEqual([]);
  });

  it('returns no strips for a degenerate (zero-size) screen', () => {
    expect(
      computeCurvatureStrips({ x: 0, y: 0, width: 0, height: 100 }, { mode: 'convex', amount: 50 }),
    ).toEqual([]);
  });

  it('returns the requested number of equal-width strips spanning the screen', () => {
    const strips = computeCurvatureStrips(screen, { mode: 'convex', amount: 50 }, 10);

    expect(strips).toHaveLength(10);
    expect(strips[0]!.x).toBeCloseTo(0);
    expect(strips[0]!.width).toBeCloseTo(20);
    expect(strips[9]!.x + strips[9]!.width).toBeCloseTo(200);
  });

  it('bulges the center outward (negative groupY, scaleY > 1) for convex', () => {
    const strips = computeCurvatureStrips(screen, { mode: 'convex', amount: 100 }, 11);
    const center = strips[5]!; // middle strip of an odd count sits exactly at the screen center.

    expect(center.groupY).toBeLessThan(0);
    expect(center.groupScaleY).toBeGreaterThan(1);
  });

  it('recedes the center inward (positive groupY, scaleY < 1) for concave', () => {
    const strips = computeCurvatureStrips(screen, { mode: 'concave', amount: 100 }, 11);
    const center = strips[5]!;

    expect(center.groupY).toBeGreaterThan(0);
    expect(center.groupScaleY).toBeLessThan(1);
  });

  it('anchors the left/right edge strips close to the flat (undisplaced) position', () => {
    const strips = computeCurvatureStrips(screen, { mode: 'convex', amount: 100 }, 100);
    const first = strips[0]!;
    const last = strips[strips.length - 1]!;

    // The parabola is zero at t = -1/1 (screen edges); with 100 strips the outermost strip's
    // center is very close to the edge, so displacement should be small relative to the center.
    const center = strips[50]!;
    expect(Math.abs(first.groupY)).toBeLessThan(Math.abs(center.groupY));
    expect(Math.abs(last.groupY)).toBeLessThan(Math.abs(center.groupY));
  });

  it('scales displacement with the amount parameter', () => {
    const low = computeCurvatureStrips(screen, { mode: 'convex', amount: 25 }, 11)[5]!;
    const high = computeCurvatureStrips(screen, { mode: 'convex', amount: 100 }, 11)[5]!;

    expect(Math.abs(high.groupY)).toBeGreaterThan(Math.abs(low.groupY));
  });

  it('widens each interior clip edge so neighboring strips overlap and hide seams', () => {
    const strips = computeCurvatureStrips(screen, { mode: 'convex', amount: 50 }, 10);
    const [first, second] = strips;

    // Interior edge between strip 0 and strip 1: each extends its clip halfway into the other.
    expect(first!.clipX).toBeCloseTo(first!.x);
    expect(first!.clipX + first!.clipWidth).toBeGreaterThan(second!.x);
    expect(second!.clipX).toBeLessThan(first!.x + first!.width);
  });

  it('does not extend the clip rect past the screen edges on the outermost strips', () => {
    const strips = computeCurvatureStrips(screen, { mode: 'convex', amount: 50 }, 10);
    const outerFirst = strips[0]!;
    const outerLast = strips[strips.length - 1]!;

    expect(outerFirst.clipX).toBeCloseTo(screen.x);
    expect(outerLast.clipX + outerLast.clipWidth).toBeCloseTo(screen.x + screen.width);
  });
});

describe('computeCurvatureOutlinePoints', () => {
  it('returns null for flat curvature', () => {
    expect(computeCurvatureOutlinePoints(screen, { mode: 'flat', amount: 100 })).toBeNull();
  });

  it('returns a closed polyline (top edge then reversed bottom edge) for a curved screen', () => {
    const points = computeCurvatureOutlinePoints(screen, { mode: 'convex', amount: 50 }, 4);

    expect(points).not.toBeNull();
    // 4 strips * 2 points/edge * 2 edges (top + bottom) * 2 coordinates (x,y) = 32 numbers.
    expect(points).toHaveLength(32);
  });

  it('starts the outline at the screen origin for the leftmost strip', () => {
    const points = computeCurvatureOutlinePoints(screen, { mode: 'convex', amount: 50 }, 4)!;
    expect(points[0]).toBeCloseTo(screen.x);
  });
});
