export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

export type VideoValidationError = 'unsupported-type' | 'too-large' | 'unsupported-codec' | 'decode-error';

/**
 * Synchronous, no-network codec probe via the standard `HTMLVideoElement.canPlayType` API.
 * Container support (MIME type) does not guarantee the specific codec inside the file is
 * decodable by this browser (e.g. an mp4 muxed with a codec Firefox doesn't ship) — this is
 * the cheapest available signal before attempting a real decode, per the video-gate's
 * "browser support and codec constraints" requirement (CLAUDE.md §3).
 */
export function canPlayVideoType(mimeType: string): boolean {
  const probe = document.createElement('video');
  return probe.canPlayType(mimeType) !== '';
}

export function validateVideoFile(file: File): VideoValidationError | null {
  if (!(ACCEPTED_VIDEO_TYPES as readonly string[]).includes(file.type)) {
    return 'unsupported-type';
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return 'too-large';
  }
  if (!canPlayVideoType(file.type)) {
    return 'unsupported-codec';
  }
  return null;
}
