import { registerAsset, registerVideoAsset } from './assetRegistry';
import type { ImageValidationError } from './fileValidation';
import { validateImageFile } from './fileValidation';
import type { VideoValidationError } from './videoValidation';
import { validateVideoFile } from './videoValidation';
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

export async function registerContentAsset(
  file: File,
): Promise<{ sourceId: string; naturalWidth: number; naturalHeight: number; kind: ContentKind }> {
  const kind = contentKindForFile(file);
  const asset = kind === 'video' ? await registerVideoAsset(file) : await registerAsset(file);
  return { ...asset, kind };
}
