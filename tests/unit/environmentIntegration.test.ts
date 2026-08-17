import { describe, expect, it } from 'vitest';
import {
  clampContactShadowOffset,
  clampContactShadowSetting,
  clampContactShadowSpread,
  clampContactShadowTint,
  clampEnvironmentIntegration,
  computeContactShadowGeometry,
  computePerspectiveContactShadowGeometry,
  contactShadowBlurRadius,
  contactShadowFillColor,
  environmentBlendOpacity,
  resolveShadowMode,
  SHADOW_MODE_BASE,
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

describe('clampContactShadowSpread', () => {
  it('clamps to 0-200', () => {
    expect(clampContactShadowSpread(-10)).toBe(0);
    expect(clampContactShadowSpread(250)).toBe(200);
    expect(clampContactShadowSpread(120)).toBe(120);
  });
});

describe('clampContactShadowTint', () => {
  it('clamps to -100..100', () => {
    expect(clampContactShadowTint(-150)).toBe(-100);
    expect(clampContactShadowTint(150)).toBe(100);
    expect(clampContactShadowTint(8)).toBe(8);
  });
});

describe('contactShadowFillColor', () => {
  it('is neutral black at tint 0', () => {
    expect(contactShadowFillColor(0)).toBe('#000000');
  });

  it('shifts warm/amber for positive tint', () => {
    expect(contactShadowFillColor(100)).toBe('#1a0e00');
  });

  it('shifts cool/blue for negative tint', () => {
    expect(contactShadowFillColor(-100)).toBe('#000e1c');
  });

  it('clamps out-of-range tint before resolving a color', () => {
    expect(contactShadowFillColor(500)).toBe(contactShadowFillColor(100));
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
  const baseShadow = {
    enabled: true,
    strength: 50,
    blur: 50,
    offsetX: 0,
    offsetY: 0.2,
    spread: 100,
    depth: 100,
    tint: 0,
  };

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
    expect(geometry?.radiusX).toBeCloseTo((200 / 2) * 0.85);
    expect(geometry?.opacity).toBeGreaterThan(0);
    expect(geometry?.opacity).toBeLessThanOrEqual(0.6);
  });

  it('clamps an out-of-range offset before applying it', () => {
    const geometry = computeContactShadowGeometry(200, 100, { ...baseShadow, offsetX: 5 });
    expect(geometry?.centerX).toBeCloseTo(100 + 1 * 200);
  });

  it('scales radiusX with spread and radiusY with depth', () => {
    const wide = computeContactShadowGeometry(200, 100, { ...baseShadow, spread: 200 });
    const narrow = computeContactShadowGeometry(200, 100, { ...baseShadow, spread: 50 });
    expect(wide?.radiusX).toBeGreaterThan(narrow?.radiusX ?? 0);

    const deep = computeContactShadowGeometry(200, 100, { ...baseShadow, depth: 200 });
    const shallow = computeContactShadowGeometry(200, 100, { ...baseShadow, depth: 10 });
    expect(deep?.radiusY).toBeGreaterThan(shallow?.radiusY ?? 0);
  });

  it('resolves fill color from tint', () => {
    const warm = computeContactShadowGeometry(200, 100, { ...baseShadow, tint: 100 });
    expect(warm?.fill).toBe(contactShadowFillColor(100));
  });
});

describe('computePerspectiveContactShadowGeometry', () => {
  const quad = {
    topLeft: { x: 0.2, y: 0.2 },
    topRight: { x: 0.8, y: 0.2 },
    bottomRight: { x: 0.8, y: 0.6 },
    bottomLeft: { x: 0.2, y: 0.6 },
  };
  const baseShadow = {
    enabled: true,
    strength: 50,
    blur: 50,
    offsetX: 0,
    offsetY: 0.2,
    spread: 100,
    depth: 100,
    tint: 0,
  };

  it('returns null when disabled', () => {
    expect(
      computePerspectiveContactShadowGeometry(quad, 1000, 500, { ...baseShadow, enabled: false }),
    ).toBeNull();
  });

  it('returns null when strength is 0', () => {
    expect(
      computePerspectiveContactShadowGeometry(quad, 1000, 500, { ...baseShadow, strength: 0 }),
    ).toBeNull();
  });

  it('returns null for a non-positive document size', () => {
    expect(computePerspectiveContactShadowGeometry(quad, 0, 500, baseShadow)).toBeNull();
  });

  it('anchors the shadow to the quad bottom edge midpoint and rotation', () => {
    const geometry = computePerspectiveContactShadowGeometry(quad, 1000, 500, baseShadow);
    expect(geometry).not.toBeNull();
    // Bottom edge is horizontal (bottomLeft/bottomRight share y), so rotation is 0.
    expect(geometry?.rotationDeg).toBeCloseTo(0);
    expect(geometry?.centerX).toBeCloseTo(500);
    expect(geometry?.opacity).toBeGreaterThan(0);
    expect(geometry?.opacity).toBeLessThanOrEqual(0.6);
  });

  it('clamps an out-of-range offset before applying it', () => {
    const geometry = computePerspectiveContactShadowGeometry(quad, 1000, 500, {
      ...baseShadow,
      offsetX: 5,
    });
    const edgeLength = 0.6 * 1000;
    expect(geometry?.centerX).toBeCloseTo(500 + edgeLength);
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

describe('resolveShadowMode', () => {
  it('resolves portable objects to freestanding regardless of material', () => {
    expect(resolveShadowMode('portable', 'led')).toBe('freestanding');
    expect(resolveShadowMode('portable', 'transparent-led')).toBe('freestanding');
  });

  it('resolves a display with transparent-led material to window', () => {
    expect(resolveShadowMode('display', 'transparent-led')).toBe('window');
  });

  it('resolves every other display material to wall', () => {
    expect(resolveShadowMode('display', 'led')).toBe('wall');
    expect(resolveShadowMode('display', 'lcd')).toBe('wall');
    expect(resolveShadowMode('display', undefined)).toBe('wall');
  });
});

describe('SHADOW_MODE_BASE', () => {
  it('enables a shadow by default for every mode', () => {
    expect(SHADOW_MODE_BASE.wall.enabled).toBe(true);
    expect(SHADOW_MODE_BASE.window.enabled).toBe(true);
    expect(SHADOW_MODE_BASE.freestanding.enabled).toBe(true);
  });

  it('gives the window mode the faintest shadow and freestanding the strongest', () => {
    expect(SHADOW_MODE_BASE.window.strength).toBeLessThan(SHADOW_MODE_BASE.wall.strength);
    expect(SHADOW_MODE_BASE.freestanding.strength).toBeGreaterThan(SHADOW_MODE_BASE.wall.strength);
  });
});
