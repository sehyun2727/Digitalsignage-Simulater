export const HULL_WATERMARK_SRC = '/assets/brand/hull-watermark.svg';

/** SVG viewBox aspect ratio (80 / 26 ≈ 3.077). */
const WATERMARK_ASPECT_RATIO = 80 / 26;

const WATERMARK_WIDTH_RATIO = 0.085;
const WATERMARK_MIN_WIDTH = 56;
const WATERMARK_MAX_WIDTH = 120;
const WATERMARK_RIGHT_MARGIN_RATIO = 0.025;
const WATERMARK_BOTTOM_MARGIN_RATIO = 0.025;
const WATERMARK_OPACITY = 0.35;

export interface WatermarkLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

/**
 * Computes the bottom-right watermark position and size in document-space coordinates.
 * All values are proportional to the canvas dimensions so the layout stays consistent
 * across portrait, landscape, and varying export resolutions.
 */
export function getHullWatermarkLayout(canvasWidth: number, canvasHeight: number): WatermarkLayout {
  const width = Math.min(
    WATERMARK_MAX_WIDTH,
    Math.max(WATERMARK_MIN_WIDTH, canvasWidth * WATERMARK_WIDTH_RATIO),
  );
  const height = width / WATERMARK_ASPECT_RATIO;
  const rightMargin = canvasWidth * WATERMARK_RIGHT_MARGIN_RATIO;
  const bottomMargin = canvasHeight * WATERMARK_BOTTOM_MARGIN_RATIO;
  return {
    x: canvasWidth - rightMargin - width,
    y: canvasHeight - bottomMargin - height,
    width,
    height,
    opacity: WATERMARK_OPACITY,
  };
}
