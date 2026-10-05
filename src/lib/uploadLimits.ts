import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LONG_EDGE,
  MAX_IMAGE_PIXELS,
} from './fileValidation';
import {
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_LONG_EDGE,
  MAX_VIDEO_SHORT_EDGE,
} from './videoValidation';

/**
 * Single source of truth for upload-limit presentation (v2-S2, requirement 3-2). The pre-upload
 * hint shown next to the trigger button, the `<input accept>` attribute on the hidden file
 * input, and the parameters interpolated into every validation error message all come from
 * these helpers — if a limit constant in fileValidation.ts / videoValidation.ts changes, the
 * three UI surfaces update together with no manual edits (the drift-check unit test confirms
 * this invariant).
 *
 * Error-message formatting (cause + remedy) lives in the i18n layer so each locale can phrase
 * the sentence naturally; this module hands the i18n layer a plain `params` record carrying
 * the numeric limits so no locale file ever hard-codes a number.
 */

export const IMAGE_EXTENSION_LABELS = ['PNG', 'JPG', 'WebP'] as const;
export const VIDEO_EXTENSION_LABELS = ['MP4', 'WebM'] as const;

/** Converts a byte count into a whole-megabyte string ("10 MB"). The constants are set in
 *  whole-megabyte multiples (10 * 1024 * 1024, 300 * 1024 * 1024), so integer rounding here
 *  stays exact; a future non-whole value would still display without a decimal point. */
function toMegabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

export interface ImageLimits {
  acceptAttribute: string;
  extensionLabels: readonly string[];
  maxBytes: number;
  maxMegabytes: number;
  maxLongEdge: number;
  maxPixels: number;
}

export interface VideoLimits {
  acceptAttribute: string;
  extensionLabels: readonly string[];
  maxBytes: number;
  maxMegabytes: number;
  maxLongEdge: number;
  maxShortEdge: number;
  maxDurationSeconds: number;
}

export function getImageLimits(): ImageLimits {
  return {
    acceptAttribute: ACCEPTED_IMAGE_TYPES.join(','),
    extensionLabels: IMAGE_EXTENSION_LABELS,
    maxBytes: MAX_IMAGE_BYTES,
    maxMegabytes: toMegabytes(MAX_IMAGE_BYTES),
    maxLongEdge: MAX_IMAGE_LONG_EDGE,
    maxPixels: MAX_IMAGE_PIXELS,
  };
}

export function getVideoLimits(): VideoLimits {
  return {
    acceptAttribute: ACCEPTED_VIDEO_TYPES.join(','),
    extensionLabels: VIDEO_EXTENSION_LABELS,
    maxBytes: MAX_VIDEO_BYTES,
    maxMegabytes: toMegabytes(MAX_VIDEO_BYTES),
    maxLongEdge: MAX_VIDEO_LONG_EDGE,
    maxShortEdge: MAX_VIDEO_SHORT_EDGE,
    maxDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
  };
}

/** `<input accept>` for a file input that takes both image and video. Used by the content
 *  upload input in the Content section; the space-background upload input only takes images.*/
export function getImageAndVideoAcceptAttribute(): string {
  return [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',');
}

import type {
  UploadError,
  UploadErrorCode,
  UploadErrorParams,
  UploadErrorSource,
} from '../store/uiStore';
import type { ImageValidationError } from './fileValidation';
import type { VideoValidationError } from './videoValidation';
import type { ContentValidationError } from './contentUpload';
import type { ContentKind } from '../types/editor';

function imageParams(limits: ImageLimits): UploadErrorParams {
  return {
    formats: limits.extensionLabels.join(' / '),
    maxMb: limits.maxMegabytes,
    maxLongEdge: limits.maxLongEdge,
    maxPixels: limits.maxPixels.toLocaleString('en-US'),
  };
}

function videoParams(limits: VideoLimits): UploadErrorParams {
  return {
    formats: limits.extensionLabels.join(' / '),
    maxMb: limits.maxMegabytes,
    maxLongEdge: limits.maxLongEdge,
    maxShortEdge: limits.maxShortEdge,
    maxSeconds: limits.maxDurationSeconds,
  };
}

const IMAGE_CODE_MAP: Record<ImageValidationError, UploadErrorCode> = {
  'unsupported-type': 'image-unsupported-type',
  'too-large': 'image-too-large',
  'dimensions-too-large': 'image-dimensions-too-large',
  'decode-error': 'image-decode-error',
};

const VIDEO_CODE_MAP: Record<VideoValidationError, UploadErrorCode> = {
  'unsupported-type': 'video-unsupported-type',
  'too-large': 'video-too-large',
  'unsupported-codec': 'video-unsupported-codec',
  'dimensions-too-large': 'video-dimensions-too-large',
  'duration-too-long': 'video-duration-too-long',
  'decode-error': 'video-decode-error',
};

/** Builds the `{source, code, params}` payload for an image-upload failure (used by both the
 *  space-photo flow and the content image flow). */
export function buildImageUploadError(
  source: Extract<UploadErrorSource, 'space-photo' | 'content'>,
  error: ImageValidationError,
): UploadError {
  return {
    source,
    code: IMAGE_CODE_MAP[error],
    params: imageParams(getImageLimits()),
  };
}

/** Builds the `{source, code, params}` payload for a content upload failure, picking the
 *  image vs. video code family from the kind the validator ran against. */
export function buildContentUploadError(
  kind: ContentKind,
  error: ContentValidationError,
): UploadError {
  if (kind === 'image') {
    return buildImageUploadError('content', error as ImageValidationError);
  }
  return {
    source: 'content',
    code: VIDEO_CODE_MAP[error as VideoValidationError],
    params: videoParams(getVideoLimits()),
  };
}

export function buildExportError(kind: 'png' | 'video'): UploadError {
  return {
    source: 'export',
    code: kind === 'png' ? 'export-png-failed' : 'export-video-failed',
    params: {},
  };
}
