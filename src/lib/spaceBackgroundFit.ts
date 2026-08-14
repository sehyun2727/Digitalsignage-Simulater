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
