export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_LONG_EDGE = 6000;
export const MAX_IMAGE_PIXELS = 24_000_000;

export type ImageValidationError =
  'unsupported-type' | 'too-large' | 'decode-error' | 'dimensions-too-large';

export function validateImageFile(file: File): ImageValidationError | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'unsupported-type';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'too-large';
  }
  return null;
}

/**
 * Post-decode check (dimensions are only known once the file has already been decoded via
 * assetRegistry's registerAsset), separate from validateImageFile's pre-decode byte/type checks.
 * Guards against a small-byte-size file (e.g. a heavily compressed PNG) that still decodes into
 * an unreasonably large bitmap and would be slow/costly to render and export at full size.
 */
export function validateImageDimensions(
  width: number,
  height: number,
): ImageValidationError | null {
  if (width > MAX_IMAGE_LONG_EDGE || height > MAX_IMAGE_LONG_EDGE) {
    return 'dimensions-too-large';
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    return 'dimensions-too-large';
  }
  return null;
}
