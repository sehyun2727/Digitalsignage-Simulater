import { describe, expect, it } from 'vitest';
import {
  bezelFillForMaterial,
  getFrameDecorations,
  getScreenRect,
} from '../../src/lib/displayFrame';
import { resolveScreenRegionRect } from '../../src/lib/contentLayout';
import { DISPLAY_FRAME_TEMPLATES } from '../../src/types/editor';

describe('getFrameDecorations', () => {
  it('draws the wall-led frame as a single full-bleed bezel behind the screen', () => {
    const decorations = getFrameDecorations('wall-led', 480, 270, 'led');

    expect(decorations).toEqual([
      { x: 0, y: 0, width: 480, height: 270, fill: expect.any(String) },
    ]);
  });

  it('draws the stand-display frame as a bezel plus a neck and a foot below it', () => {
    const decorations = getFrameDecorations('stand-display', 220, 420, 'led');

    expect(decorations).toHaveLength(3);
    for (const rect of decorations) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(220 + 0.001);
      expect(rect.y + rect.height).toBeLessThanOrEqual(420 + 0.001);
    }
  });

  it('uses a distinct, lighter bezel color for LCD than for LED/Transparent LED', () => {
    const ledFill = getFrameDecorations('wall-led', 480, 270, 'led')[0]!.fill;
    const lcdFill = getFrameDecorations('wall-led', 480, 270, 'lcd')[0]!.fill;
    const transparentLedFill = getFrameDecorations('wall-led', 480, 270, 'transparent-led')[0]!
      .fill;

    expect(lcdFill).not.toBe(ledFill);
    expect(transparentLedFill).toBe(ledFill);
  });
});

describe('bezelFillForMaterial', () => {
  it('is deterministic and consistent with getFrameDecorations', () => {
    expect(bezelFillForMaterial('lcd')).toBe(
      getFrameDecorations('wall-led', 100, 100, 'lcd')[0]!.fill,
    );
    expect(bezelFillForMaterial('led')).toBe(
      getFrameDecorations('wall-led', 100, 100, 'led')[0]!.fill,
    );
  });

  it('normalizes the legacy outdoor-led value the same as led', () => {
    expect(bezelFillForMaterial('outdoor-led')).toBe(bezelFillForMaterial('led'));
  });
});

describe('getScreenRect', () => {
  it('matches resolveScreenRegionRect for the same frame template and size', () => {
    for (const frameId of ['wall-led', 'stand-display'] as const) {
      const width = 300;
      const height = 400;
      const expected = resolveScreenRegionRect(
        { width, height },
        DISPLAY_FRAME_TEMPLATES[frameId].screenRegion,
      );

      expect(getScreenRect(frameId, width, height)).toEqual(expected);
    }
  });

  it('keeps the screen rect fully inside the object bounding box', () => {
    for (const frameId of ['wall-led', 'stand-display'] as const) {
      const width = 300;
      const height = 400;
      const screen = getScreenRect(frameId, width, height);

      expect(screen.x).toBeGreaterThanOrEqual(0);
      expect(screen.y).toBeGreaterThanOrEqual(0);
      expect(screen.x + screen.width).toBeLessThanOrEqual(width + 0.001);
      expect(screen.y + screen.height).toBeLessThanOrEqual(height + 0.001);
    }
  });
});
