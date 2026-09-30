export interface CoverFitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** "Cover" fit (fills the target box, centered, cropping overflow) shared by every renderer that
 * draws the space background photo at its own natural aspect ratio — the live canvas
 * (SpaceBackgroundView) and, since Sprint 4.5, occlusion masks that restore the same photo
 * pixels (OcclusionMaskLayer) — so both always agree on exactly which photo pixels sit under a
 * given document coordinate. */
export function computeCoverFit(
  naturalWidth: number,
  naturalHeight: number,
  width: number,
  height: number,
): CoverFitRect {
  const scale = Math.max(width / naturalWidth, height / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  return {
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

/**
 * Clamps a raw offsetY to the valid pan range for the cover-fitted photo, so the photo's edges
 * never leave the canvas box. The valid range is [-overflow/2, +overflow/2] centered at 0
 * (which matches the default centered cover-fit); a photo whose cover-fit already fits the
 * canvas height has no overflow and returns 0 unconditionally.
 */
export function clampSpaceBackgroundOffsetY(
  canvasHeight: number,
  drawnHeight: number,
  offsetY: number,
): number {
  const overflow = drawnHeight - canvasHeight;
  if (overflow <= 0) return 0;
  const half = overflow / 2;
  return Math.min(half, Math.max(-half, offsetY));
}
