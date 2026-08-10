import { describe, expect, it } from 'vitest';
import {
  getBrightnessOverlay,
  getLedPatternCanvas,
  materialPatternOpacity,
} from '../../src/lib/materialTexture';

describe('materialPatternOpacity', () => {
  it('is zero at zero intensity for both materials', () => {
    expect(materialPatternOpacity('outdoor-led', 0)).toBe(0);
    expect(materialPatternOpacity('lcd', 0)).toBe(0);
  });

  it('increases monotonically with intensity', () => {
    expect(materialPatternOpacity('outdoor-led', 100)).toBeGreaterThan(materialPatternOpacity('outdoor-led', 50));
    expect(materialPatternOpacity('lcd', 100)).toBeGreaterThan(materialPatternOpacity('lcd', 50));
  });

  it('caps out-of-range intensity at the same opacity as 100', () => {
    expect(materialPatternOpacity('outdoor-led', 150)).toBe(materialPatternOpacity('outdoor-led', 100));
    expect(materialPatternOpacity('lcd', -20)).toBe(materialPatternOpacity('lcd', 0));
  });
});

describe('getBrightnessOverlay', () => {
  it('applies no overlay at the neutral midpoint', () => {
    expect(getBrightnessOverlay(50)).toBeNull();
  });

  it('washes white above the midpoint and black below it', () => {
    expect(getBrightnessOverlay(100)).toMatchObject({ fill: 'white' });
    expect(getBrightnessOverlay(0)).toMatchObject({ fill: 'black' });
  });

  it('increases opacity the farther the value is from the midpoint', () => {
    const overlay75 = getBrightnessOverlay(75);
    const overlay100 = getBrightnessOverlay(100);

    expect(overlay75).not.toBeNull();
    expect(overlay100).not.toBeNull();
    expect(overlay100!.opacity).toBeGreaterThan(overlay75!.opacity);
  });
});

describe('getLedPatternCanvas', () => {
  it('returns a small square canvas suitable for tiling', () => {
    const canvas = getLedPatternCanvas();

    expect(canvas.width).toBe(6);
    expect(canvas.height).toBe(6);
  });

  it('caches and reuses the same canvas instance across calls', () => {
    expect(getLedPatternCanvas()).toBe(getLedPatternCanvas());
  });
});
