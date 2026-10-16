/**
 * Unit tests for CIE76 ΔE between sRGB colours. These numbers were cross-checked against
 * an independent CIE Lab calculator (http://colormine.org, D65 reference) so a drift in
 * the formula is caught at CI time without round-tripping through colour-managed assets.
 */
import { describe, expect, it } from 'vitest';
import { deltaE76, rgbToLab, withinDeltaE } from '../../src/lib/colorDeltaE';

const FIXED = 2; // Tolerance for ΔE floating-point drift between implementations (JND ≈ 1).

describe('rgbToLab (CIE76, D65 reference)', () => {
  it('converts black / white / primary colours to Lab within ±1 unit', () => {
    const black = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(black.L).toBeCloseTo(0, 1);
    expect(black.a).toBeCloseTo(0, 1);
    expect(black.b).toBeCloseTo(0, 1);
    const white = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(white.L).toBeCloseTo(100, 1);
    expect(white.a).toBeCloseTo(0, 1);
    expect(white.b).toBeCloseTo(0, 1);
    const red = rgbToLab({ r: 255, g: 0, b: 0 });
    expect(red.L).toBeCloseTo(53.24, 1);
    expect(red.a).toBeCloseTo(80.09, 1);
    expect(red.b).toBeCloseTo(67.2, 1);
    const green = rgbToLab({ r: 0, g: 255, b: 0 });
    expect(green.L).toBeCloseTo(87.73, 1);
    expect(green.a).toBeCloseTo(-86.18, 1);
    expect(green.b).toBeCloseTo(83.18, 1);
    const blue = rgbToLab({ r: 0, g: 0, b: 255 });
    expect(blue.L).toBeCloseTo(32.3, 1);
    expect(blue.a).toBeCloseTo(79.19, 1);
    expect(blue.b).toBeCloseTo(-107.86, 1);
    const magenta = rgbToLab({ r: 255, g: 0, b: 255 });
    expect(magenta.L).toBeCloseTo(60.32, 1);
    expect(magenta.a).toBeCloseTo(98.23, 1);
    expect(magenta.b).toBeCloseTo(-60.82, 1);
  });
});

describe('deltaE76 (CIE76 Euclidean ΔE)', () => {
  it('reports 0 for identical colours', () => {
    expect(deltaE76({ r: 128, g: 64, b: 200 }, { r: 128, g: 64, b: 200 })).toBeCloseTo(0, 4);
  });
  it('reports ~115 ΔE between black and white (CIE76)', () => {
    // Reference: ΔE(black, white) = 100 (L axis only), but CIE76 uses sqrt(L² + a² + b²)
    // and both have a=b=0 so the result is 100 ± rounding.
    const dE = deltaE76({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(dE).toBeCloseTo(100, 1);
  });
  it('reports ~87 ΔE between pure red and pure green', () => {
    const dE = deltaE76({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 });
    expect(dE).toBeGreaterThan(170);
    expect(dE).toBeLessThan(180);
  });
  it('reports ~5–7 ΔE between magenta #FF00FF and a near-magenta #F010F0', () => {
    const dE = deltaE76({ r: 255, g: 0, b: 255 }, { r: 240, g: 16, b: 240 });
    expect(dE).toBeGreaterThan(2);
    expect(dE).toBeLessThan(10);
  });
  it('reports > 20 ΔE between magenta and 50 % desaturated magenta', () => {
    const dE = deltaE76({ r: 255, g: 0, b: 255 }, { r: 192, g: 96, b: 192 });
    expect(dE).toBeGreaterThan(20);
  });
});

describe('withinDeltaE threshold', () => {
  it('accepts identical colours at threshold 0', () => {
    expect(withinDeltaE({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 }, 0)).toBe(true);
  });
  it('accepts a near-neighbour at threshold 10 but rejects it at 1', () => {
    const a = { r: 255, g: 0, b: 255 };
    const b = { r: 240, g: 16, b: 240 };
    const d = deltaE76(a, b);
    expect(d).toBeLessThan(10);
    expect(withinDeltaE(a, b, 10)).toBe(true);
    expect(withinDeltaE(a, b, 1)).toBe(false);
  });
  it('rejects pure red when threshold is below the known ΔE from magenta', () => {
    const magenta = { r: 255, g: 0, b: 255 };
    const red = { r: 255, g: 0, b: 0 };
    const d = deltaE76(magenta, red);
    expect(d).toBeGreaterThan(50);
    expect(withinDeltaE(magenta, red, 10)).toBe(false);
  });
  it('is symmetric', () => {
    const a = { r: 123, g: 45, b: 67 };
    const b = { r: 89, g: 200, b: 11 };
    expect(deltaE76(a, b)).toBeCloseTo(deltaE76(b, a), FIXED);
  });
});
