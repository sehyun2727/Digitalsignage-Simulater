import { describe, expect, it } from 'vitest';
import {
  clampContactShadowOffset,
  clampContactShadowSetting,
  clampEnvironmentIntegration,
  computeContactShadowGeometry,
  contactShadowBlurRadius,
  environmentBlendOpacity,
} from '../../src/lib/environmentIntegration';

describe('clampContactShadowSetting', () => {
  it('clamps to 0-100', () => {
    expect(clampContactShadowSetting(-10)).toBe(0);
    expect(clampContactShadowSetting(150)).toBe(100);
    expect(clampContactShadowSetting(40)).toBe(40);
  });
});

describe('clampContactShadowOffset', () => {
  it('clamps to -1..1', () => {
    expect(clampContactShadowOffset(-5)).toBe(-1);
    expect(clampContactShadowOffset(5)).toBe(1);
    expect(clampContactShadowOffset(0.3)).toBe(0.3);
  });
});

describe('clampEnvironmentIntegration', () => {
  it('clamps to 0-100', () => {
    expect(clampEnvironmentIntegration(-10)).toBe(0);
    expect(clampEnvironmentIntegration(150)).toBe(100);
  });
});

describe('environmentBlendOpacity', () => {
  it('is 0 at strength 0', () => {
    expect(environmentBlendOpacity(0)).toBe(0);
  });

  it('increases monotonically with strength and stays bounded', () => {
    const low = environmentBlendOpacity(25);
    const high = environmentBlendOpacity(100);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(0.35);
  });

  it('clamps out-of-range strength', () => {
    expect(environmentBlendOpacity(150)).toBe(environmentBlendOpacity(100));
  });
});

describe('computeContactShadowGeometry', () => {
  const baseShadow = { enabled: true, strength: 50, blur: 50, offsetX: 0, offsetY: 0.2 };

  it('returns null when disabled', () => {
    expect(computeContactShadowGeometry(200, 100, { ...baseShadow, enabled: false })).toBeNull();
  });

  it('returns null when strength is 0', () => {
    expect(computeContactShadowGeometry(200, 100, { ...baseShadow, strength: 0 })).toBeNull();
  });

  it('returns null for a non-positive footprint', () => {
    expect(computeContactShadowGeometry(0, 100, baseShadow)).toBeNull();
  });

  it('places the ellipse center at the offset base and scales opacity with strength', () => {
    const geometry = computeContactShadowGeometry(200, 100, baseShadow);
    expect(geometry).not.toBeNull();
    expect(geometry?.centerX).toBeCloseTo(100);
    expect(geometry?.centerY).toBeCloseTo(100 + 0.2 * 100);
    expect(geometry?.radiusX).toBeCloseTo(200 / 2 * 0.85);
    expect(geometry?.opacity).toBeGreaterThan(0);
    expect(geometry?.opacity).toBeLessThanOrEqual(0.6);
  });

  it('clamps an out-of-range offset before applying it', () => {
    const geometry = computeContactShadowGeometry(200, 100, { ...baseShadow, offsetX: 5 });
    expect(geometry?.centerX).toBeCloseTo(100 + 1 * 200);
  });
});

describe('contactShadowBlurRadius', () => {
  it('is 0 at blur 0', () => {
    expect(contactShadowBlurRadius(200, 100, 0)).toBe(0);
  });

  it('scales with blur and the larger object dimension', () => {
    expect(contactShadowBlurRadius(200, 100, 100)).toBeCloseTo(200 * 0.15);
    expect(contactShadowBlurRadius(100, 200, 100)).toBeCloseTo(200 * 0.15);
  });
});
