import { getSupportedVideoExportMimeType } from './videoExportCapability';

export interface VideoExportOptions {
  /** How long to record, in milliseconds. */
  durationMs: number;
  /** Capture frame rate; matches captureStream's own frames-per-second parameter. */
  fps?: number;
  mimeType?: string;
}

const DEFAULT_EXPORT_FPS = 30;

/**
 * Records `canvas`'s own live pixels (not a separate render pass) for `durationMs` and resolves
 * a Blob of the encoded video — entirely in-browser via `captureStream` + `MediaRecorder`, per
 * the local-first/no-upload constraint. The caller is responsible for keeping the canvas
 * animating for the recording's duration (see useVideoPlaybackRedraw.ts, which already drives a
 * Konva.Animation loop for as long as a screen shows video content); this function only owns the
 * capture/encode pipeline, not what gets drawn.
 */
export function recordCanvasToVideo(
  canvas: HTMLCanvasElement,
  { durationMs, fps = DEFAULT_EXPORT_FPS, mimeType }: VideoExportOptions,
): Promise<Blob> {
  const resolvedMimeType = mimeType ?? getSupportedVideoExportMimeType();
  if (!resolvedMimeType || typeof canvas.captureStream !== 'function') {
    return Promise.reject(new Error('Video export is not supported in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(fps);
    const stopTracks = () => stream.getTracks().forEach((track) => track.stop());

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: resolvedMimeType });
    } catch (error) {
      stopTracks();
      reject(error instanceof Error ? error : new Error('Failed to start MediaRecorder.'));
      return;
    }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      stopTracks();
      reject(new Error('MediaRecorder failed while recording.'));
    };
    recorder.onstop = () => {
      stopTracks();
      resolve(new Blob(chunks, { type: resolvedMimeType }));
    };

    recorder.start();
    setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, durationMs);
  });
}
