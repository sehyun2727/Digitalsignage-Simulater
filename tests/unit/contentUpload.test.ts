import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  contentKindForFile,
  registerContentAsset,
  validateContentFile,
} from '../../src/lib/contentUpload';

class SucceedingMockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class SucceedingMockVideo {
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  videoWidth = 1280;
  videoHeight = 720;
  muted = false;
  playsInline = false;
  preload = '';
  set src(_value: string) {
    queueMicrotask(() => this.onloadedmetadata?.());
  }
}

function stubVideoElement() {
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: unknown) => {
    if (tagName === 'video') return new SucceedingMockVideo() as unknown as HTMLVideoElement;
    return originalCreateElement(tagName, options as ElementCreationOptions);
  });
}

function createImageFile(size = 1024): File {
  return new File([new Uint8Array(size)], 'photo.png', { type: 'image/png' });
}

function createVideoFile(size = 1024): File {
  return new File([new Uint8Array(size)], 'clip.mp4', { type: 'video/mp4' });
}

describe('contentKindForFile', () => {
  it('classifies video/* MIME types as video', () => {
    expect(contentKindForFile(createVideoFile())).toBe('video');
  });

  it('classifies everything else as image', () => {
    expect(contentKindForFile(createImageFile())).toBe('image');
  });
});

describe('validateContentFile', () => {
  beforeEach(() => {
    vi.spyOn(HTMLVideoElement.prototype, 'canPlayType').mockReturnValue('probably');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for a valid image file', () => {
    expect(validateContentFile(createImageFile())).toBeNull();
  });

  it('returns null for a valid video file', () => {
    expect(validateContentFile(createVideoFile())).toBeNull();
  });

  it('tags an image validation failure with kind "image"', () => {
    expect(validateContentFile(createImageFile(20 * 1024 * 1024))).toEqual({
      kind: 'image',
      error: 'too-large',
    });
  });

  it('tags a video validation failure with kind "video"', () => {
    expect(validateContentFile(createVideoFile(100 * 1024 * 1024))).toEqual({
      kind: 'video',
      error: 'too-large',
    });
  });

  it('surfaces a video-only unsupported-codec failure', () => {
    vi.spyOn(HTMLVideoElement.prototype, 'canPlayType').mockReturnValue('');
    expect(validateContentFile(createVideoFile())).toEqual({
      kind: 'video',
      error: 'unsupported-codec',
    });
  });
});

describe('registerContentAsset', () => {
  let objectUrlCounter = 0;

  beforeEach(() => {
    objectUrlCounter = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${++objectUrlCounter}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('Image', SucceedingMockImage as unknown as typeof Image);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('registers an image file through the image pipeline', async () => {
    const asset = await registerContentAsset(createImageFile());
    expect(asset).toMatchObject({ kind: 'image', naturalWidth: 800, naturalHeight: 600 });
  });

  it('registers a video file through the video pipeline', async () => {
    stubVideoElement();
    const asset = await registerContentAsset(createVideoFile());
    expect(asset).toMatchObject({ kind: 'video', naturalWidth: 1280, naturalHeight: 720 });
  });
});
