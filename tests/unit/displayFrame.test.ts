import { describe, expect, it } from 'vitest';
import { getFrameDecorations, getScreenRect } from '../../src/lib/displayFrame';
import { resolveScreenRegionRect } from '../../src/lib/contentLayout';
import { DISPLAY_FRAME_TEMPLATES } from '../../src/types/editor';

describe('getFrameDecorations', () => {
  it('draws the wall-led frame as a single full-bleed bezel behind the screen', () => {
    const decorations = getFrameDecorations('wall-led', 480, 270);

    expect(decorations).toEqual([{ x: 0, y: 0, width: 480, height: 270, fill: expect.any(String) }]);
  });

  it('draws the stand-display frame as a bezel plus a neck and a foot below it', () => {
    const decorations = getFrameDecorations('stand-display', 220, 420);

    expect(decorations).toHaveLength(3);
    for (const rect of decorations) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(220 + 0.001);
      expect(rect.y + rect.height).toBeLessThanOrEqual(420 + 0.001);
    }
  });
});

describe('getScreenRect', () => {
  it('matches resolveScreenRegionRect for the same frame template and size', () => {
    for (const frameId of ['wall-led', 'stand-display'] as const) {
      const width = 300;
      const height = 400;
      const expected = resolveScreenRegionRect({ width, height }, DISPLAY_FRAME_TEMPLATES[frameId].screenRegion);

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
