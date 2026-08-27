import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ContentDimensionError,
  contentKindForFile,
  registerContentAsset,
  validateContentFile,
} from '../../src/lib/contentUpload';
import { MAX_IMAGE_LONG_EDGE } from '../../src/lib/fileValidation';
import { MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_WIDTH } from '../../src/lib/videoValidation';

class SucceedingMockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class OversizedMockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = MAX_IMAGE_LONG_EDGE + 1;
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
  duration = 10;
  muted = false;
  playsInline = false;
  preload = '';
  set src(_value: string) {
    queueMicrotask(() => this.onloadedmetadata?.());
  }
}

class OversizedMockVideo {
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  videoWidth = MAX_VIDEO_WIDTH + 1;
  videoHeight = 720;
  duration = 10;
  muted = false;
  playsInline = false;
  preload = '';
  set src(_value: string) {
    queueMicrotask(() => this.onloadedmetadata?.());
  }
}

function stubVideoElementWith(VideoClass: new () => unknown) {
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: unknown) => {
    if (tagName === 'video') return new VideoClass() as unknown as HTMLVideoElement;
    return originalCreateElement(tagName, options as ElementCreationOptions);
  });
}

function stubVideoElement() {
  stubVideoElementWith(SucceedingMockVideo);
}

/**
 * registerContentAsset's duration check reads `registered.image.duration` only when
 * `registered.image instanceof HTMLVideoElement` — a plain mock object (as used by the other
 * video stand-ins above) never satisfies that, so exercising the duration branch needs a real
 * <video> element with its readonly dimension/duration getters shadowed on the instance.
 */
function stubOverlongVideoElement() {
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: unknown) => {
    if (tagName !== 'video')
      return originalCreateElement(tagName, options as ElementCreationOptions);
    const video = originalCreateElement('video') as HTMLVideoElement;
    Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
    Object.defineProperty(video, 'duration', {
      value: MAX_VIDEO_DURATION_SECONDS + 1,
      configurable: true,
    });
    Object.defineProperty(video, 'src', {
      set() {
        queueMicrotask(() => video.onloadedmetadata?.(new Event('loadedmetadata')));
      },
      configurable: true,
    });
    return video;
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
    // Cap raised to 300MB in src/lib/videoValidation.ts, so use 400MB to guarantee too-large.
    expect(validateContentFile(createVideoFile(400 * 1024 * 1024))).toEqual({
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

  it('rejects and releases an image whose decoded dimensions exceed the limit', async () => {
    vi.stubGlobal('Image', OversizedMockImage as unknown as typeof Image);
    let caught: unknown;
    try {
      await registerContentAsset(createImageFile());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentDimensionError);
    expect(caught).toMatchObject({ kind: 'image', error: 'dimensions-too-large' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(`blob:mock-${objectUrlCounter}`);
  });

  it('rejects and releases a video whose decoded dimensions exceed the limit', async () => {
    stubVideoElementWith(OversizedMockVideo);
    let caught: unknown;
    try {
      await registerContentAsset(createVideoFile());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentDimensionError);
    expect(caught).toMatchObject({ kind: 'video', error: 'dimensions-too-large' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(`blob:mock-${objectUrlCounter}`);
  });

  it('rejects and releases a video whose decoded duration exceeds the limit', async () => {
    stubOverlongVideoElement();
    let caught: unknown;
    try {
      await registerContentAsset(createVideoFile());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContentDimensionError);
    expect(caught).toMatchObject({ kind: 'video', error: 'duration-too-long' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(`blob:mock-${objectUrlCounter}`);
  });
});
