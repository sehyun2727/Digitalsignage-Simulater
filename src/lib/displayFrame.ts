import { DISPLAY_FRAME_TEMPLATES } from '../types/editor';
import type { DisplayFrameId, DisplayMaterial } from '../types/editor';
import { resolveScreenRegionRect } from './contentLayout';
import type { Rect } from './contentLayout';
import { normalizeMaterial } from './materialTexture';

export interface FrameDecoration extends Rect {
  fill: string;
}

const BEZEL_FILL = '#15181f';
const LCD_BEZEL_FILL = '#20242c';
const STAND_FILL = '#1f232b';

/** LCD panels commonly ship with a lighter charcoal/plastic bezel than an LED cabinet's
 *  near-black metal frame — this keeps the two materials visually distinct even when their
 *  screen content and pattern overlay otherwise read as similar. */
export function bezelFillForMaterial(material: DisplayMaterial): string {
  return normalizeMaterial(material) === 'lcd' ? LCD_BEZEL_FILL : BEZEL_FILL;
}

/**
 * Non-screen frame parts (bezel, stand, base) drawn behind the clipped screen content, in
 * pixel coordinates local to the display object. Deliberately simple flat rectangles — this
 * is a visual foundation, not a product-accurate render (see ADR 0003).
 */
export function getFrameDecorations(
  frameId: DisplayFrameId,
  width: number,
  height: number,
  material: DisplayMaterial,
): FrameDecoration[] {
  const bezelFill = bezelFillForMaterial(material);
  if (frameId === 'wall-led') {
    return [{ x: 0, y: 0, width, height, fill: bezelFill }];
  }

  // stand-display: a bezel around the screen, a neck, and a wide foot below it.
  return [
    { x: width * 0.04, y: 0, width: width * 0.92, height: height * 0.8, fill: bezelFill },
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
