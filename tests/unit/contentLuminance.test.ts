import { afterEach, describe, expect, it, vi } from 'vitest';
import { glowLuminanceFactor, sampleMeanLuminance } from '../../src/lib/contentLuminance';

/** Stubs canvas readback with a fixed, fully-opaque solid color (jsdom has no real 2D context). */
function stubCanvasContext(rgb: [number, number, number], alpha = 255) {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    getImageData: (_x: number, _y: number, width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = alpha;
      }
      return { data, width, height, colorSpace: 'srgb' } as ImageData;
    },
  } as unknown as CanvasRenderingContext2D);
  return spy;
}

describe('sampleMeanLuminance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when canvas readback is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const image = document.createElement('canvas');
    expect(sampleMeanLuminance(image)).toBeNull();
  });

  it('reads close to 1 for solid white content', () => {
    stubCanvasContext([255, 255, 255]);
    const image = document.createElement('canvas');
    expect(sampleMeanLuminance(image)).toBeCloseTo(1, 2);
  });

  it('reads close to 0 for solid black content', () => {
    stubCanvasContext([0, 0, 0]);
    const image = document.createElement('canvas');
    expect(sampleMeanLuminance(image)).toBeCloseTo(0, 2);
  });

  it('weights fully transparent pixels out of the average instead of counting them as black', () => {
    stubCanvasContext([255, 255, 255], 0);
    const image = document.createElement('canvas');
    // All pixels are alpha 0 (weight 0), so the sum/weight ratio falls back to 0 rather than NaN.
    expect(sampleMeanLuminance(image)).toBe(0);
  });

  it('accepts an HTMLVideoElement the same way it accepts an image/canvas', () => {
    stubCanvasContext([255, 255, 255]);
    const video = document.createElement('video');
    expect(sampleMeanLuminance(video)).toBeCloseTo(1, 2);
  });
});

describe('glowLuminanceFactor', () => {
  it('leaves silhouette-only glow unscaled (factor 1) when no luminance sample is available yet', () => {
    expect(glowLuminanceFactor(null)).toBe(1);
  });

  it('scales toward the minimum factor for fully dark content, never to exactly zero', () => {
    const factor = glowLuminanceFactor(0);
    expect(factor).toBeGreaterThan(0);
    expect(factor).toBeLessThan(0.2);
  });

  it('scales to the full factor for fully bright content', () => {
    expect(glowLuminanceFactor(1)).toBeCloseTo(1);
  });

  it('increases monotonically with luminance', () => {
    expect(glowLuminanceFactor(0.8)).toBeGreaterThan(glowLuminanceFactor(0.2));
  });

  it('clamps out-of-range luminance to the nearest bound', () => {
    expect(glowLuminanceFactor(-1)).toBe(glowLuminanceFactor(0));
    expect(glowLuminanceFactor(2)).toBe(glowLuminanceFactor(1));
  });
});
