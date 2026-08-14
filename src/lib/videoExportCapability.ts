// Chrome/Firefox/Edge ship VP9 and VP8 encoders for MediaRecorder; Safari (as of this sprint)
// exposes neither `HTMLCanvasElement.captureStream` nor a usable `MediaRecorder`, so it falls
// through to `null`/`false` here rather than throwing — callers must show the video-gate's
// required "unsupported browser" fallback instead of assuming export always works.
const VIDEO_EXPORT_MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

export function isCanvasCaptureStreamSupported(): boolean {
  return (
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

export function getSupportedVideoExportMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  return VIDEO_EXPORT_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function isVideoExportSupported(): boolean {
  return isCanvasCaptureStreamSupported() && getSupportedVideoExportMimeType() !== null;
}
