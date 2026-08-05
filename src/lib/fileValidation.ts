export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageValidationError = 'unsupported-type' | 'too-large';

export function validateImageFile(file: File): ImageValidationError | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'unsupported-type';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'too-large';
  }
  return null;
}
