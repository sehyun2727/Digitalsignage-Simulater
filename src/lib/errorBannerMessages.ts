import type { UploadError, UploadErrorCode } from '../store/uiStore';
import type { Messages } from '../types/i18n';

/**
 * Resolves a stored {source, code, params} error into (cause, remedy) strings for the active
 * locale (v2-S2, requirement 2-5). Keeps every number/format label in the i18n layer so that
 * flipping the active language inside `LocaleProvider` immediately re-renders the banner with
 * the new strings — the stored error itself never carries any user-visible text.
 */

type MessageKey = keyof Messages;

const CAUSE_KEY: Record<UploadErrorCode, MessageKey> = {
  'image-unsupported-type': 'errorImageUnsupportedTypeCause',
  'image-too-large': 'errorImageTooLargeCause',
  'image-dimensions-too-large': 'errorImageDimensionsTooLargeCause',
  'image-decode-error': 'errorImageDecodeErrorCause',
  'video-unsupported-type': 'errorVideoUnsupportedTypeCause',
  'video-too-large': 'errorVideoTooLargeCause',
  'video-unsupported-codec': 'errorVideoUnsupportedCodecCause',
  'video-dimensions-too-large': 'errorVideoDimensionsTooLargeCause',
  'video-duration-too-long': 'errorVideoDurationTooLongCause',
  'video-decode-error': 'errorVideoDecodeErrorCause',
  'export-png-failed': 'errorExportPngFailedCause',
  'export-video-failed': 'errorExportVideoFailedCause',
};

const REMEDY_KEY: Record<UploadErrorCode, MessageKey> = {
  'image-unsupported-type': 'errorImageUnsupportedTypeRemedy',
  'image-too-large': 'errorImageTooLargeRemedy',
  'image-dimensions-too-large': 'errorImageDimensionsTooLargeRemedy',
  'image-decode-error': 'errorImageDecodeErrorRemedy',
  'video-unsupported-type': 'errorVideoUnsupportedTypeRemedy',
  'video-too-large': 'errorVideoTooLargeRemedy',
  'video-unsupported-codec': 'errorVideoUnsupportedCodecRemedy',
  'video-dimensions-too-large': 'errorVideoDimensionsTooLargeRemedy',
  'video-duration-too-long': 'errorVideoDurationTooLongRemedy',
  'video-decode-error': 'errorVideoDecodeErrorRemedy',
  'export-png-failed': 'errorExportPngFailedRemedy',
  'export-video-failed': 'errorExportVideoFailedRemedy',
};

/** Replaces every `{name}` placeholder with the stringified value from `params`. Unknown
 *  placeholders are left in place so a missing param is visible during review (would otherwise
 *  silently vanish from the message). */
export function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = params[key];
    if (value === undefined || value === null) return whole;
    return String(value);
  });
}

export function resolveErrorMessages(
  error: UploadError,
  messages: Messages,
): { cause: string; remedy: string } {
  // All CAUSE_KEY / REMEDY_KEY values point at string-valued Messages keys (never the Record
  // or array-valued ones such as localeName or termsOfServiceSections). This narrow explicit
  // cast documents the invariant to the type system without weakening the map's own types.
  const causeTemplate = messages[CAUSE_KEY[error.code]] as unknown as string;
  const remedyTemplate = messages[REMEDY_KEY[error.code]] as unknown as string;
  return {
    cause: interpolate(causeTemplate, error.params),
    remedy: interpolate(remedyTemplate, error.params),
  };
}
