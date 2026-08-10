import { describe, expect, it } from 'vitest';
import {
  clampContentOffset,
  clampContentScale,
  clampMaterialSetting,
  computeContentLayout,
  resolveScreenRegionRect,
} from '../../src/lib/contentLayout';
import type { ScreenRegion, SignageContent } from '../../src/types/editor';

function baseContent(overrides: Partial<Pick<SignageContent, 'fit' | 'offsetX' | 'offsetY' | 'scale'>> = {}) {
  return { fit: 'contain' as const, offsetX: 0, offsetY: 0, scale: 1, ...overrides };
}

describe('resolveScreenRegionRect', () => {
  it('resolves a rect region as a fraction of the object bounding box', () => {
    const region: ScreenRegion = { shape: 'rect', x: 0.1, y: 0.2, width: 0.8, height: 0.6 };

    expect(resolveScreenRegionRect({ width: 200, height: 100 }, region)).toEqual({
      x: 20,
      y: 20,
      width: 160,
      height: 60,
    });
  });

  it('falls back to the full bounding box for a polygon region', () => {
    const region: ScreenRegion = { shape: 'polygon', points: [0, 0, 1, 0, 1, 1, 0, 1] };

    expect(resolveScreenRegionRect({ width: 200, height: 100 }, region)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
  });
});

describe('clamp helpers', () => {
  it('clamps content scale to [MIN_CONTENT_SCALE, MAX_CONTENT_SCALE]', () => {
    expect(clampContentScale(0)).toBe(1);
    expect(clampContentScale(1.5)).toBe(1.5);
    expect(clampContentScale(10)).toBe(3);
  });

  it('clamps content offset to [-1, 1]', () => {
    expect(clampContentOffset(-5)).toBe(-1);
    expect(clampContentOffset(0.3)).toBe(0.3);
    expect(clampContentOffset(5)).toBe(1);
  });

  it('clamps material settings to [0, 100]', () => {
    expect(clampMaterialSetting(-10)).toBe(0);
    expect(clampMaterialSetting(42)).toBe(42);
    expect(clampMaterialSetting(150)).toBe(100);
  });
});

describe('computeContentLayout', () => {
  const screen = { x: 10, y: 20, width: 200, height: 100 };

  it('sizes contain content to the min-scale-factor, matching CSS background-size: contain', () => {
    const naturalWidth = 400;
    const naturalHeight = 100;
    const scale = Math.min(screen.width / naturalWidth, screen.height / naturalHeight);

    const layout = computeContentLayout(screen, naturalWidth, naturalHeight, baseContent());

    expect(layout.width).toBeCloseTo(naturalWidth * scale);
    expect(layout.height).toBeCloseTo(naturalHeight * scale);
  });

  it('sizes cover content to the max-scale-factor, matching CSS background-size: cover', () => {
    const naturalWidth = 400;
    const naturalHeight = 100;
    const scale = Math.max(screen.width / naturalWidth, screen.height / naturalHeight);

    const layout = computeContentLayout(screen, naturalWidth, naturalHeight, baseContent({ fit: 'cover' }));

    expect(layout.width).toBeCloseTo(naturalWidth * scale);
    expect(layout.height).toBeCloseTo(naturalHeight * scale);
  });

  it('contains a portrait image inside a landscape screen without exceeding either dimension', () => {
    const layout = computeContentLayout(screen, 100, 300, baseContent());

    expect(layout.width).toBeLessThanOrEqual(screen.width + 0.001);
    expect(layout.height).toBeLessThanOrEqual(screen.height + 0.001);
  });

  it('centers the content within the screen when offset is zero and scale is 1', () => {
    const layout = computeContentLayout(screen, 200, 100, baseContent());

    expect(layout.x + layout.width / 2).toBeCloseTo(screen.x + screen.width / 2);
    expect(layout.y + layout.height / 2).toBeCloseTo(screen.y + screen.height / 2);
  });

  it('shifts the content center by offsetX/offsetY as a fraction of the screen size', () => {
    const layout = computeContentLayout(screen, 200, 100, baseContent({ offsetX: 0.5, offsetY: -0.5 }));

    expect(layout.x + layout.width / 2).toBeCloseTo(screen.x + screen.width / 2 + 0.5 * screen.width);
    expect(layout.y + layout.height / 2).toBeCloseTo(screen.y + screen.height / 2 - 0.5 * screen.height);
  });

  it('scales the base fit size by the scale multiplier', () => {
    const base = computeContentLayout(screen, 200, 100, baseContent());
    const scaled = computeContentLayout(screen, 200, 100, baseContent({ scale: 2 }));

    expect(scaled.width).toBeCloseTo(base.width * 2);
    expect(scaled.height).toBeCloseTo(base.height * 2);
  });
});
