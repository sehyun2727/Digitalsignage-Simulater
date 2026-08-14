import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSupportedVideoExportMimeType,
  isCanvasCaptureStreamSupported,
  isVideoExportSupported,
} from '../../src/lib/videoExportCapability';

function stubMediaRecorder(supportedTypes: readonly string[]) {
  class MockMediaRecorder {
    static isTypeSupported(type: string) {
      return supportedTypes.includes(type);
    }
  }
  vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder);
}

describe('isCanvasCaptureStreamSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error test-only cleanup of a prototype member added by earlier tests
    delete HTMLCanvasElement.prototype.captureStream;
  });

  it('is false when captureStream is not implemented', () => {
    expect(isCanvasCaptureStreamSupported()).toBe(false);
  });

  it('is true when captureStream is implemented', () => {
    HTMLCanvasElement.prototype.captureStream = () => ({}) as MediaStream;
    expect(isCanvasCaptureStreamSupported()).toBe(true);
  });
});

describe('getSupportedVideoExportMimeType', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is null when MediaRecorder does not exist', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(getSupportedVideoExportMimeType()).toBeNull();
  });

  it('is null when no candidate type is supported', () => {
    stubMediaRecorder([]);
    expect(getSupportedVideoExportMimeType()).toBeNull();
  });

  it('prefers vp9, falling back to vp8, then plain webm', () => {
    stubMediaRecorder(['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']);
    expect(getSupportedVideoExportMimeType()).toBe('video/webm;codecs=vp9');

    stubMediaRecorder(['video/webm;codecs=vp8', 'video/webm']);
    expect(getSupportedVideoExportMimeType()).toBe('video/webm;codecs=vp8');

    stubMediaRecorder(['video/webm']);
    expect(getSupportedVideoExportMimeType()).toBe('video/webm');
  });
});

describe('isVideoExportSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error test-only cleanup of a prototype member added by earlier tests
    delete HTMLCanvasElement.prototype.captureStream;
  });

  it('requires both captureStream and a supported MediaRecorder mime type', () => {
    stubMediaRecorder(['video/webm']);
    expect(isVideoExportSupported()).toBe(false);

    HTMLCanvasElement.prototype.captureStream = () => ({}) as MediaStream;
    expect(isVideoExportSupported()).toBe(true);
  });

  it('is false when captureStream exists but no mime type is supported', () => {
    HTMLCanvasElement.prototype.captureStream = () => ({}) as MediaStream;
    stubMediaRecorder([]);
    expect(isVideoExportSupported()).toBe(false);
  });
});
