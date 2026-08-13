/**
 * Decoded-pixel safety ceiling for the space background photo, which now drives the document
 * and export resolution directly (see ADR 0007). 40 megapixels keeps the raw decoded bitmap
 * (4 bytes/pixel as an RGBA canvas buffer) under ~160MB, which stays well inside what mobile
 * Safari/Chrome tabs reliably tolerate, while comfortably fitting typical phone and DSLR
 * photos (12-48MP) without ever downscaling them. Only unusually large panoramas or scans
 * exceed it.
 */
export const MAX_DECODED_PIXELS = 40_000_000;

export interface SafeDimensions {
  width: number;
  height: number;
  downscaled: boolean;
}

/**
 * Deterministically fits `width`x`height` under `maxPixels`, preserving aspect ratio, by
 * scaling both axes by the same factor. Returns the input unchanged (downscaled: false) when
 * it already fits.
 */
export function computeSafeDimensions(
  width: number,
  height: number,
  maxPixels: number = MAX_DECODED_PIXELS,
): SafeDimensions {
  const pixels = width * height;
  if (pixels <= maxPixels || pixels <= 0) {
    return { width, height, downscaled: false };
  }
  const scale = Math.sqrt(maxPixels / pixels);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    downscaled: true,
  };
}
