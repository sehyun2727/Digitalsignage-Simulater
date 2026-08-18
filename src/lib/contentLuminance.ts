/**
 * Mean perceptual luminance (0-1) of a decoded image/canvas/video frame, sampled from a small
 * downscaled copy the same way `detectHasAlpha` (assetRegistry.ts) samples for transparency — a
 * coarse average is all glow/emission strength needs, so a 24x24 readback is used instead of the
 * full-resolution source. `ctx.drawImage` accepts an `HTMLVideoElement` directly (drawing its
 * current frame), so the same downscale-and-average approach works for video without any
 * video-specific branch here; callers decide how often to call this for a playing video (see
 * `useVideoLuminance.ts`, which throttles it rather than sampling every decoded frame).
 * Returns null if canvas readback is unavailable (matches detectHasAlpha's "unknown" contract).
 */
export function sampleMeanLuminance(
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
): number | null {
  try {
    const sampleSize = 24;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      // Alpha-weight the sample so transparent content pixels (e.g. a Transparent LED source
      // with no image drawn there yet) don't drag the average toward black.
      const weight = a / 255;
      total += (0.2126 * r + 0.7152 * g + 0.0722 * b) * weight;
      count += weight;
    }
    if (count <= 0) return 0;
    return total / count / 255;
  } catch {
    return null;
  }
}

const MIN_GLOW_LUMINANCE_FACTOR = 0.15;

/**
 * Scales a material's `glow` setting by how bright the current content actually is, so a fully
 * dark/black image (or a dark moment in a video) contributes little or no glow while bright
 * content glows at full strength (sprint spec section 14 / baseline defect 1). `meanLuminance` is
 * `null` when no sample is available yet (failed readback, or a video's first sample not having
 * landed), in which case the caller's existing silhouette-based glow is left unscaled (factor 1)
 * rather than guessing.
 */
export function glowLuminanceFactor(meanLuminance: number | null): number {
  if (meanLuminance === null) return 1;
  const clamped = Math.min(1, Math.max(0, meanLuminance));
  return MIN_GLOW_LUMINANCE_FACTOR + clamped * (1 - MIN_GLOW_LUMINANCE_FACTOR);
}
