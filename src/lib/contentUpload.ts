import {
  getRegisteredAsset,
  registerAsset,
  registerVideoAsset,
  releaseAsset,
} from './assetRegistry';
import type { ImageValidationError } from './fileValidation';
import { validateImageDimensions, validateImageFile } from './fileValidation';
import type { VideoValidationError } from './videoValidation';
import {
  validateVideoDimensions,
  validateVideoDuration,
  validateVideoFile,
} from './videoValidation';
import type { ContentKind } from '../types/editor';

export type ContentValidationError = ImageValidationError | VideoValidationError;

export interface ContentValidationFailure {
  kind: ContentKind;
  error: ContentValidationError;
}

/** Whether `file` should go through the image or video content pipeline, based on its declared
 *  MIME type's top-level category — the same signal a file `<input accept>` and the native OS
 *  drag payload both already rely on to offer only image/video files in the first place. */
export function contentKindForFile(file: File): ContentKind {
  return file.type.startsWith('video/') ? 'video' : 'image';
}

/**
 * Single validate-then-register entry point for assigning a user file as a display/portable
 * object's screen content, shared by the Toolbar's content upload field and the canvas's native
 * OS file-drop handler so both pick image vs. video handling the same way instead of
 * duplicating the branch. The resolved `kind` is returned alongside the error (not just the
 * error) because image and video validation errors share the same string values (e.g.
 * 'too-large') but mean different limits, so callers need `kind` to show an accurate message.
 */
export function validateContentFile(file: File): ContentValidationFailure | null {
  const kind = contentKindForFile(file);
  const error = kind === 'video' ? validateVideoFile(file) : validateImageFile(file);
  return error ? { kind, error } : null;
}

/** Thrown by registerContentAsset when a post-decode check (dimensions/duration) fails, so
 *  callers can show the specific reason instead of the generic 'decode-error' their existing
 *  try/catch already falls back to for every other failure mode. */
export class ContentDimensionError extends Error {
  constructor(
    public readonly kind: ContentKind,
    public readonly error: ContentValidationError,
  ) {
    super(`content dimension validation failed: ${kind}/${error}`);
  }
}

export async function registerContentAsset(
  file: File,
): Promise<{ sourceId: string; naturalWidth: number; naturalHeight: number; kind: ContentKind }> {
  const kind = contentKindForFile(file);
  const asset = kind === 'video' ? await registerVideoAsset(file) : await registerAsset(file);

  if (kind === 'image') {
    const dimensionError = validateImageDimensions(asset.naturalWidth, asset.naturalHeight);
    if (dimensionError) {
      releaseAsset(asset.sourceId);
      throw new ContentDimensionError(kind, dimensionError);
    }
  } else {
    const dimensionError = validateVideoDimensions(asset.naturalWidth, asset.naturalHeight);
    if (dimensionError) {
      releaseAsset(asset.sourceId);
      throw new ContentDimensionError(kind, dimensionError);
    }
    const registered = getRegisteredAsset(asset.sourceId);
    // Duck-typed on `duration` rather than `instanceof HTMLVideoElement` so this branch also
    // catches test-only mock video elements (see tests/unit/contentUpload.test.ts's
    // SucceedingMockVideo) without special-casing them in production code.
    const rawDuration = (registered?.image as { duration?: number } | undefined)?.duration;
    // A non-finite duration (missing, NaN, Infinity — e.g. a fragmented or live-captured
    // container whose duration header is absent) is treated as a validation failure: without a
    // real duration, the 30-second cap can't be enforced and a multi-hour stream would
    // otherwise register as content.
    const durationError =
      typeof rawDuration === 'number' && Number.isFinite(rawDuration)
        ? validateVideoDuration(rawDuration)
        : 'duration-too-long';
    if (durationError) {
      releaseAsset(asset.sourceId);
      throw new ContentDimensionError(kind, durationError);
    }
  }

  return { ...asset, kind };
}
