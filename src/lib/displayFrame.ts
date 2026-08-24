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
/** Thin metallic-looking edge frame for a see-through / transparent LED panel: the whole body
 *  behind the screen must stay clear so the space photo actually shows through, so the frame is
 *  drawn as a slim ring border rather than a filled backing rect. */
const TRANSPARENT_BEZEL_FILL = '#8a8f99';
const STAND_FILL = '#1f232b';

/** LCD panels commonly ship with a lighter charcoal/plastic bezel than an LED cabinet's
 *  near-black metal frame; a transparent-LED "see-through" panel has a metallic thin edge
 *  instead of a full solid bezel color — this keeps every material visually distinct. */
export function bezelFillForMaterial(material: DisplayMaterial): string {
  const normalized = normalizeMaterial(material);
  if (normalized === 'lcd') return LCD_BEZEL_FILL;
  if (normalized === 'transparent-led') return TRANSPARENT_BEZEL_FILL;
  return BEZEL_FILL;
}

/**
 * Non-screen frame parts (bezel, stand, base) drawn behind the clipped screen content, in
 * pixel coordinates local to the display object. Deliberately simple flat rectangles — this
 * is a visual foundation, not a product-accurate render (see ADR 0003).
 *
 * Transparent-LED panels return an empty array here: the whole "body" behind the screen has to
 * stay clear so the space photo can show through the semi-transparent backing (see
 * `transparentBackingOpacity` in materialTexture.ts). The thin edge silhouette for a
 * transparent-LED is drawn separately in SignageDisplayView as a stroked outline around the
 * screen rect, not as a filled backing here.
 */
export function getFrameDecorations(
  frameId: DisplayFrameId,
  width: number,
  height: number,
  material: DisplayMaterial,
): FrameDecoration[] {
  const normalized = normalizeMaterial(material);
  if (normalized === 'transparent-led') return [];
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
