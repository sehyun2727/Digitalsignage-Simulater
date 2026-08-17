import { describe, expect, it } from 'vitest';
import {
  contrastFilterValue,
  getBrightnessOverlay,
  getGlowShadow,
  getLcdSecondaryHighlight,
  getLedPatternCanvas,
  lcdSecondaryHighlightOpacity,
  LCD_HIGHLIGHT_MAX_OPACITY,
  LCD_SECONDARY_HIGHLIGHT_MAX_OPACITY,
  LED_PATTERN_MAX_OPACITY,
  materialPatternOpacity,
  normalizeMaterial,
  transparentBackingOpacity,
  transparentContentOpacity,
  TRANSPARENT_LED_PATTERN_MAX_OPACITY,
} from '../../src/lib/materialTexture';

describe('normalizeMaterial', () => {
  it('migrates the legacy outdoor-led value to led', () => {
    expect(normalizeMaterial('outdoor-led')).toBe('led');
  });

  it('passes through every current material value unchanged', () => {
    expect(normalizeMaterial('led')).toBe('led');
    expect(normalizeMaterial('lcd')).toBe('lcd');
    expect(normalizeMaterial('transparent-led')).toBe('transparent-led');
  });

  it('falls back to led for unrecognized values instead of throwing', () => {
    expect(normalizeMaterial('bogus')).toBe('led');
    expect(normalizeMaterial(undefined)).toBe('led');
    expect(normalizeMaterial(null)).toBe('led');
  });
});

describe('materialPatternOpacity', () => {
  it('is zero at zero intensity for every material', () => {
    expect(materialPatternOpacity('outdoor-led', 0)).toBe(0);
    expect(materialPatternOpacity('lcd', 0)).toBe(0);
    expect(materialPatternOpacity('transparent-led', 0)).toBe(0);
  });

  it('increases monotonically with intensity', () => {
    expect(materialPatternOpacity('outdoor-led', 100)).toBeGreaterThan(
      materialPatternOpacity('outdoor-led', 50),
    );
    expect(materialPatternOpacity('lcd', 100)).toBeGreaterThan(materialPatternOpacity('lcd', 50));
    expect(materialPatternOpacity('transparent-led', 100)).toBeGreaterThan(
      materialPatternOpacity('transparent-led', 50),
    );
  });

  it('caps out-of-range intensity at the same opacity as 100', () => {
    expect(materialPatternOpacity('outdoor-led', 150)).toBe(
      materialPatternOpacity('outdoor-led', 100),
    );
    expect(materialPatternOpacity('lcd', -20)).toBe(materialPatternOpacity('lcd', 0));
  });

  it('uses the legacy outdoor-led ceiling for the migrated led material', () => {
    expect(materialPatternOpacity('outdoor-led', 100)).toBeCloseTo(LED_PATTERN_MAX_OPACITY);
    expect(materialPatternOpacity('led', 100)).toBeCloseTo(LED_PATTERN_MAX_OPACITY);
  });

  it('uses a distinct, higher ceiling for transparent-led than for led or lcd', () => {
    expect(materialPatternOpacity('transparent-led', 100)).toBeCloseTo(
      TRANSPARENT_LED_PATTERN_MAX_OPACITY,
    );
    expect(materialPatternOpacity('lcd', 100)).toBeCloseTo(LCD_HIGHLIGHT_MAX_OPACITY);
    expect(materialPatternOpacity('transparent-led', 100)).toBeGreaterThan(
      materialPatternOpacity('led', 100),
    );
  });

  it('fades the LED/transparent-led grid toward a lower opacity at small screen sizes', () => {
    const small = materialPatternOpacity('led', 100, 20);
    const large = materialPatternOpacity('led', 100, 200);
    expect(small).toBeLessThan(large);
    expect(small).toBeGreaterThan(0);
  });

  it('leaves LCD unaffected by screen size (it is a highlight band, not a pixel grid)', () => {
    expect(materialPatternOpacity('lcd', 100, 20)).toBeCloseTo(
      materialPatternOpacity('lcd', 100, 200),
    );
  });

  it('defaults to full-size opacity when no screen size is given', () => {
    expect(materialPatternOpacity('led', 100)).toBeCloseTo(materialPatternOpacity('led', 100, 200));
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

    expect(canvas.width).toBe(7);
    expect(canvas.height).toBe(7);
  });

  it('caches and reuses the same canvas instance across calls', () => {
    expect(getLedPatternCanvas()).toBe(getLedPatternCanvas());
  });
});

describe('transparentBackingOpacity', () => {
  it('is highest (most opaque) at zero transparency and lowest at full transparency', () => {
    expect(transparentBackingOpacity(0)).toBeGreaterThan(transparentBackingOpacity(100));
  });

  it('decreases monotonically as transparency increases', () => {
    expect(transparentBackingOpacity(25)).toBeGreaterThan(transparentBackingOpacity(75));
  });

  it('clamps out-of-range input to the same result as the nearest bound', () => {
    expect(transparentBackingOpacity(-20)).toBe(transparentBackingOpacity(0));
    expect(transparentBackingOpacity(150)).toBe(transparentBackingOpacity(100));
  });
});

describe('transparentContentOpacity', () => {
  it('increases monotonically with brightness', () => {
    expect(transparentContentOpacity(100)).toBeGreaterThan(transparentContentOpacity(0));
  });

  it('never drops to fully transparent, even at zero brightness', () => {
    expect(transparentContentOpacity(0)).toBeGreaterThan(0);
  });

  it('clamps out-of-range input to the same result as the nearest bound', () => {
    expect(transparentContentOpacity(-20)).toBe(transparentContentOpacity(0));
    expect(transparentContentOpacity(150)).toBe(transparentContentOpacity(100));
  });
});

describe('getGlowShadow', () => {
  it('is null when glow is zero', () => {
    expect(getGlowShadow(0)).toBeNull();
  });

  it('returns a larger blur and opacity as glow increases', () => {
    const low = getGlowShadow(25)!;
    const high = getGlowShadow(100)!;

    expect(high.blur).toBeGreaterThan(low.blur);
    expect(high.opacity).toBeGreaterThan(low.opacity);
  });

  it('uses the provided color, defaulting to the LED glow blue', () => {
    expect(getGlowShadow(50)!.color).toBe('#8fd6ff');
    expect(getGlowShadow(50, '#ff0000')!.color).toBe('#ff0000');
  });

  it('clamps out-of-range glow to the same result as the nearest bound', () => {
    expect(getGlowShadow(-20)).toBeNull();
    expect(getGlowShadow(150)).toEqual(getGlowShadow(100));
  });
});

describe('getLcdSecondaryHighlight', () => {
  it('is deterministic for the same object id', () => {
    const a = getLcdSecondaryHighlight('obj-1', 200, 100);
    const b = getLcdSecondaryHighlight('obj-1', 200, 100);
    expect(a).toEqual(b);
  });

  it('varies its diagonal/peak across different object ids', () => {
    const ids = ['obj-1', 'obj-2', 'obj-3', 'obj-4', 'obj-5', 'obj-6'];
    const variants = ids.map((id) => getLcdSecondaryHighlight(id, 200, 100));
    const serialized = variants.map((v) =>
      JSON.stringify([v.startPoint, v.endPoint, v.colorStops]),
    );
    expect(new Set(serialized).size).toBeGreaterThan(1);
  });

  it('always uses one of the two screen-corner-to-corner diagonals', () => {
    const width = 200;
    const height = 100;
    for (const id of ['obj-1', 'obj-2', 'obj-3', 'obj-4']) {
      const { startPoint, endPoint } = getLcdSecondaryHighlight(id, width, height);
      const isMainDiagonal =
        startPoint.x === 0 && startPoint.y === 0 && endPoint.x === width && endPoint.y === height;
      const isAntiDiagonal =
        startPoint.x === width && startPoint.y === 0 && endPoint.x === 0 && endPoint.y === height;
      expect(isMainDiagonal || isAntiDiagonal).toBe(true);
    }
  });

  it('keeps its peak color stop, and every stop position, within the opposite half of the primary band (0.55-0.76) and the valid 0-1 range', () => {
    for (const id of ['obj-1', 'obj-2', 'obj-3', 'obj-4', 'obj-5']) {
      const { colorStops } = getLcdSecondaryHighlight(id, 200, 100);
      const positions = colorStops.filter((_, index) => index % 2 === 0) as number[];
      for (const position of positions) {
        expect(position).toBeGreaterThanOrEqual(0);
        expect(position).toBeLessThanOrEqual(1);
      }
      // The peak is the stop with full white opacity (colorStops[4]).
      const peak = positions[2];
      expect(peak).toBeGreaterThanOrEqual(0.55);
      expect(peak).toBeLessThanOrEqual(0.76);
      // Positions must be non-decreasing for a valid Konva gradient.
      for (let i = 1; i < positions.length; i += 1) {
        expect(positions[i]!).toBeGreaterThanOrEqual(positions[i - 1]!);
      }
    }
  });
});

describe('lcdSecondaryHighlightOpacity', () => {
  it('is zero at zero intensity and caps at LCD_SECONDARY_HIGHLIGHT_MAX_OPACITY at 100', () => {
    expect(lcdSecondaryHighlightOpacity(0)).toBe(0);
    expect(lcdSecondaryHighlightOpacity(100)).toBeCloseTo(LCD_SECONDARY_HIGHLIGHT_MAX_OPACITY);
  });

  it('stays lower than the primary band ceiling at full intensity', () => {
    expect(lcdSecondaryHighlightOpacity(100)).toBeLessThan(LCD_HIGHLIGHT_MAX_OPACITY);
  });

  it('clamps out-of-range input to the same result as the nearest bound', () => {
    expect(lcdSecondaryHighlightOpacity(-20)).toBe(lcdSecondaryHighlightOpacity(0));
    expect(lcdSecondaryHighlightOpacity(150)).toBe(lcdSecondaryHighlightOpacity(100));
  });
});

describe('contrastFilterValue', () => {
  it('maps the neutral midpoint (50) to zero contrast adjustment', () => {
    expect(contrastFilterValue(50)).toBe(0);
  });

  it('maps 0 and 100 to the negative and positive ends of the Konva filter range', () => {
    expect(contrastFilterValue(0)).toBeCloseTo(-60);
    expect(contrastFilterValue(100)).toBeCloseTo(60);
  });

  it('clamps out-of-range input to the same result as the nearest bound', () => {
    expect(contrastFilterValue(-20)).toBe(contrastFilterValue(0));
    expect(contrastFilterValue(150)).toBe(contrastFilterValue(100));
  });
});
