import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_VIDEO_EXPORT_DURATION_MS,
  MAX_VIDEO_EXPORT_DURATION_MS,
  recordCanvasToVideo,
  resolveVideoExportDurationMs,
} from '../../src/lib/videoExport';

describe('resolveVideoExportDurationMs', () => {
  it('falls back to the default duration when there is no video content', () => {
    expect(resolveVideoExportDurationMs([])).toBe(DEFAULT_VIDEO_EXPORT_DURATION_MS);
  });

  it('ignores non-finite or non-positive durations (e.g. a video whose metadata has not loaded)', () => {
    expect(resolveVideoExportDurationMs([NaN, 0, -5, Infinity])).toBe(DEFAULT_VIDEO_EXPORT_DURATION_MS);
  });

  it('uses the longest video duration, converted to milliseconds', () => {
    expect(resolveVideoExportDurationMs([2, 5, 3])).toBe(5000);
  });

  it('caps the result at MAX_VIDEO_EXPORT_DURATION_MS', () => {
    expect(resolveVideoExportDurationMs([120])).toBe(MAX_VIDEO_EXPORT_DURATION_MS);
  });
});

class MockTrack {
  stopped = false;
  stop() {
    this.stopped = true;
  }
}

class MockStream {
  tracks = [new MockTrack(), new MockTrack()];
  getTracks() {
    return this.tracks;
  }
}

class MockMediaRecorder {
  static isTypeSupported(type: string) {
    return type === 'video/webm;codecs=vp8';
  }

  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(
    public stream: MockStream,
    public options?: { mimeType?: string },
  ) {}

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['chunk']) });
    this.onstop?.();
  }
}

class ThrowingMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  constructor() {
    throw new Error('unsupported mimeType');
  }
}

function stubCanvasCaptureStream(stream: MockStream = new MockStream()) {
  const canvas = document.createElement('canvas');
  (canvas as unknown as { captureStream: (fps?: number) => MockStream }).captureStream = () => stream;
  return canvas;
}

describe('recordCanvasToVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects when the canvas has no captureStream implementation', async () => {
    vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder);
    const canvas = document.createElement('canvas');
    await expect(recordCanvasToVideo(canvas, { durationMs: 5 })).rejects.toThrow(
      'Video export is not supported in this browser.',
    );
  });

  it('rejects when no mime type is supported', async () => {
    class NoTypeMediaRecorder {
      static isTypeSupported() {
        return false;
      }
    }
    vi.stubGlobal('MediaRecorder', NoTypeMediaRecorder as unknown as typeof MediaRecorder);
    const canvas = stubCanvasCaptureStream();
    await expect(recordCanvasToVideo(canvas, { durationMs: 5 })).rejects.toThrow(
      'Video export is not supported in this browser.',
    );
  });

  it('records for the requested duration and resolves a Blob of the recorded type', async () => {
    vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder);
    const stream = new MockStream();
    const canvas = stubCanvasCaptureStream(stream);

    const blob = await recordCanvasToVideo(canvas, { durationMs: 5 });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('video/webm;codecs=vp8');
  });

  it('stops every stream track once recording finishes', async () => {
    vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder);
    const stream = new MockStream();
    const canvas = stubCanvasCaptureStream(stream);

    await recordCanvasToVideo(canvas, { durationMs: 5 });

    expect(stream.tracks.every((track) => track.stopped)).toBe(true);
  });

  it('rejects and stops tracks when constructing the MediaRecorder throws', async () => {
    vi.stubGlobal('MediaRecorder', ThrowingMediaRecorder as unknown as typeof MediaRecorder);
    const stream = new MockStream();
    const canvas = stubCanvasCaptureStream(stream);

    await expect(recordCanvasToVideo(canvas, { durationMs: 5 })).rejects.toThrow('unsupported mimeType');
    expect(stream.tracks.every((track) => track.stopped)).toBe(true);
  });

  it('uses an explicitly passed mimeType over the auto-detected one', async () => {
    vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder);
    const canvas = stubCanvasCaptureStream();

    const blob = await recordCanvasToVideo(canvas, { durationMs: 5, mimeType: 'video/webm;codecs=vp8' });

    expect(blob.type).toBe('video/webm;codecs=vp8');
  });
});
