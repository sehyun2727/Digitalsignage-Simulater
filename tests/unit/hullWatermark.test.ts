import { describe, expect, it } from 'vitest';
import { getHullWatermarkLayout } from '../../src/lib/hullWatermark';

const ASPECT_RATIO = 80 / 26;

describe('getHullWatermarkLayout', () => {
  it('positions watermark in the bottom-right quadrant', () => {
    const layout = getHullWatermarkLayout(1920, 1080);
    expect(layout.x).toBeGreaterThan(1920 / 2);
    expect(layout.y).toBeGreaterThan(1080 / 2);
  });

  it('keeps watermark inside canvas bounds', () => {
    const layout = getHullWatermarkLayout(1920, 1080);
    expect(layout.x).toBeGreaterThan(0);
    expect(layout.y).toBeGreaterThan(0);
    expect(layout.x + layout.width).toBeLessThanOrEqual(1920);
    expect(layout.y + layout.height).toBeLessThanOrEqual(1080);
  });

  it('maintains SVG aspect ratio', () => {
    const layout = getHullWatermarkLayout(1920, 1080);
    expect(layout.width / layout.height).toBeCloseTo(ASPECT_RATIO, 5);
  });

  it('clamps width to max 120', () => {
    const layout = getHullWatermarkLayout(3840, 2160);
    expect(layout.width).toBe(120);
  });

  it('clamps width to min 56', () => {
    const layout = getHullWatermarkLayout(100, 100);
    expect(layout.width).toBe(56);
  });

  it('scales proportionally for portrait canvas', () => {
    const landscape = getHullWatermarkLayout(1920, 1080);
    const portrait = getHullWatermarkLayout(1080, 1920);
    // Portrait is narrower, so watermark should be smaller or equal
    expect(portrait.width).toBeLessThanOrEqual(landscape.width);
  });

  it('opacity is between 0 and 1 (exclusive)', () => {
    const layout = getHullWatermarkLayout(1920, 1080);
    expect(layout.opacity).toBeGreaterThan(0);
    expect(layout.opacity).toBeLessThan(1);
  });

  it('right margin is proportional to canvas width', () => {
    const layout = getHullWatermarkLayout(1920, 1080);
    const rightGap = 1920 - (layout.x + layout.width);
    expect(rightGap).toBeCloseTo(1920 * 0.025, 1);
  });

  it('bottom margin is proportional to canvas height', () => {
    const layout = getHullWatermarkLayout(1920, 1080);
    const bottomGap = 1080 - (layout.y + layout.height);
    expect(bottomGap).toBeCloseTo(1080 * 0.025, 1);
  });
});
