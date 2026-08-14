import { computeSafeDimensions } from './imageSafety';
import { createId } from './id';

export interface RegisteredAsset {
  /** Empty string for a downscaled space background, whose original Blob URL is revoked
   *  immediately after the one-time downscale draw (see registerSpaceBackgroundAsset). */
  objectUrl: string;
  /** An HTMLVideoElement here is a decoded, ready-to-draw video source (Konva.Image accepts
   *  it directly as a CanvasImageSource) rather than a still frame; see registerVideoAsset. */
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Decoded content/space-background images, keyed by sourceId. Kept outside of the
 * (serializable, undo/redo-able) Zustand document state on purpose: Blob URLs and
 * HTMLImageElements are not meaningful to snapshot/restore by value, and copying them into
 * every history entry would multiply decode/memory cost for no benefit. The editor store
 * only ever stores a `sourceId` string; components look the decoded asset up here.
 */
const registry = new Map<string, RegisteredAsset>();

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    // A declared image/* MIME type does not guarantee decodable bytes (corrupted file,
    // spoofed type, etc.); surface that as a rejected promise instead of a stuck asset.
    image.onerror = () => reject(new Error('decode-error'));
    image.src = objectUrl;
  });
}

export async function registerAsset(
  file: File,
): Promise<{ sourceId: string; naturalWidth: number; naturalHeight: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const sourceId = createId();
    registry.set(sourceId, {
      objectUrl,
      image,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    });
    return { sourceId, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function getRegisteredAsset(sourceId: string): RegisteredAsset | undefined {
  return registry.get(sourceId);
}

function loadVideo(objectUrl: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    // Muted + inline playback is required for the editor preview to autoplay at all in modern
    // browsers (autoplay-with-sound is blocked); it also matches how a real signage screen
    // plays looping video, so it is the correct default rather than a test-only workaround.
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error('decode-error'));
    video.src = objectUrl;
  });
}

/**
 * Registers a decoded, ready-to-play video element the same way registerAsset registers a
 * decoded image: caller has already run validateVideoFile (src/lib/videoValidation.ts), this
 * only performs the actual browser-local decode and lifecycle bookkeeping. The returned
 * `naturalWidth`/`naturalHeight` mirror the image asset shape (videoWidth/videoHeight under the
 * hood) so downstream layout code (contentLayout.ts) needs no video-specific branch.
 */
export async function registerVideoAsset(
  file: File,
): Promise<{ sourceId: string; naturalWidth: number; naturalHeight: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = await loadVideo(objectUrl);
    const sourceId = createId();
    registry.set(sourceId, {
      objectUrl,
      image: video,
      naturalWidth: video.videoWidth,
      naturalHeight: video.videoHeight,
    });
    return { sourceId, naturalWidth: video.videoWidth, naturalHeight: video.videoHeight };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/**
 * Registers a space background photo, applying the decoded-pixel safety limit (see
 * src/lib/imageSafety.ts and ADR 0007): the document/export resolution now comes directly from
 * this photo, so an extreme panorama or scan must not be allowed to crash the tab. When the
 * decoded image already fits, this behaves exactly like `registerAsset`. When it doesn't, the
 * image is drawn once onto an offscreen canvas at the deterministic safe size and that canvas
 * becomes the stored, rendered asset — the full-resolution decode and its Blob URL are dropped
 * immediately afterward, so memory stays bounded by the effective (safe) pixel count rather
 * than the original file's.
 */
export async function registerSpaceBackgroundAsset(file: File): Promise<{
  sourceId: string;
  naturalWidth: number;
  naturalHeight: number;
  width: number;
  height: number;
  downscaled: boolean;
}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    const safe = computeSafeDimensions(naturalWidth, naturalHeight);
    const sourceId = createId();

    if (!safe.downscaled) {
      registry.set(sourceId, { objectUrl, image, naturalWidth, naturalHeight });
      return {
        sourceId,
        naturalWidth,
        naturalHeight,
        width: naturalWidth,
        height: naturalHeight,
        downscaled: false,
      };
    }

    const canvas = document.createElement('canvas');
    canvas.width = safe.width;
    canvas.height = safe.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('decode-error');
    ctx.drawImage(image, 0, 0, safe.width, safe.height);
    URL.revokeObjectURL(objectUrl);
    registry.set(sourceId, {
      objectUrl: '',
      image: canvas,
      naturalWidth: safe.width,
      naturalHeight: safe.height,
    });
    return {
      sourceId,
      naturalWidth,
      naturalHeight,
      width: safe.width,
      height: safe.height,
      downscaled: true,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/**
 * Immediately revokes and drops one registered asset, regardless of reachability. Intended for
 * assets that were registered as part of an in-progress, not-yet-committed flow (e.g. a photo
 * uploaded inside the portable builder dialog that the user then cancels) — such an asset is
 * never referenced by any document/history snapshot, so the reachability-based
 * `sweepUnusedAssets` would never revoke it on its own.
 */
export function releaseAsset(sourceId: string): void {
  const asset = registry.get(sourceId);
  if (!asset) return;
  if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
  registry.delete(sourceId);
}

/**
 * Best-effort check for transparency in a decoded image, used only to decide whether to
 * surface the portable-builder background hint more prominently. Samples a small downscaled
 * copy (not the full-resolution image) since only a coarse yes/no is needed. Returns null
 * (rather than throwing) if canvas readback is unavailable, so callers can treat "unknown"
 * the same as "no transparency detected" without crashing the upload flow.
 */
export function detectHasAlpha(image: HTMLImageElement | HTMLCanvasElement): boolean | null {
  try {
    const sampleSize = 32;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 255) return true;
    }
    return false;
  } catch {
    return null;
  }
}

/**
 * Revokes and drops any registered asset whose sourceId is not in `usedSourceIds`. Intended
 * to be called after every store mutation with the set of sourceIds still reachable from the
 * current document plus the full undo/redo history, so an asset survives exactly as long as
 * some reachable document snapshot could still reference it (see editorStore.ts).
 */
export function sweepUnusedAssets(usedSourceIds: ReadonlySet<string>): void {
  for (const [sourceId, asset] of registry) {
    if (!usedSourceIds.has(sourceId)) {
      if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
      registry.delete(sourceId);
    }
  }
}
