import { DISPLAY_FRAME_TEMPLATES } from '../types/editor';
import type { DisplayFrameId } from '../types/editor';
import { resolveScreenRegionRect } from './contentLayout';
import type { Rect } from './contentLayout';

export interface FrameDecoration extends Rect {
  fill: string;
}

const BEZEL_FILL = '#15181f';
const STAND_FILL = '#1f232b';

/**
 * Non-screen frame parts (bezel, stand, base) drawn behind the clipped screen content, in
 * pixel coordinates local to the display object. Deliberately simple flat rectangles — this
 * is a visual foundation, not a product-accurate render (see ADR 0003).
 */
export function getFrameDecorations(
  frameId: DisplayFrameId,
  width: number,
  height: number,
): FrameDecoration[] {
  if (frameId === 'wall-led') {
    return [{ x: 0, y: 0, width, height, fill: BEZEL_FILL }];
  }

  // stand-display: a bezel around the screen, a neck, and a wide foot below it.
  return [
    { x: width * 0.04, y: 0, width: width * 0.92, height: height * 0.8, fill: BEZEL_FILL },
    {
      x: width * 0.42,
      y: height * 0.8,
      width: width * 0.16,
      height: height * 0.14,
      fill: STAND_FILL,
    },
    {
      x: width * 0.2,
      y: height * 0.94,
      width: width * 0.6,
      height: height * 0.06,
      fill: STAND_FILL,
    },
  ];
}

export function getScreenRect(frameId: DisplayFrameId, width: number, height: number): Rect {
  return resolveScreenRegionRect({ width, height }, DISPLAY_FRAME_TEMPLATES[frameId].screenRegion);
}
