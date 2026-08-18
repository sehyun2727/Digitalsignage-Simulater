import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_HEIGHT,
  MAX_VIDEO_WIDTH,
  canPlayVideoType,
  validateVideoDimensions,
  validateVideoDuration,
  validateVideoFile,
} from '../../src/lib/videoValidation';

function createFile(type: string, size: number): File {
  return new File([new Uint8Array(size)], 'clip', { type });
}

describe('validateVideoFile', () => {
  beforeEach(() => {
    vi.spyOn(HTMLVideoElement.prototype, 'canPlayType').mockReturnValue('probably');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts an MP4 within the size limit when the codec is playable', () => {
    expect(validateVideoFile(createFile('video/mp4', 1024))).toBeNull();
  });

  it('accepts WebM', () => {
    expect(validateVideoFile(createFile('video/webm', 1024))).toBeNull();
  });

  it('rejects unsupported container types', () => {
    expect(validateVideoFile(createFile('video/quicktime', 1024))).toBe('unsupported-type');
    expect(validateVideoFile(createFile('application/pdf', 1024))).toBe('unsupported-type');
  });

  it('rejects a file with an empty or missing MIME type', () => {
    expect(validateVideoFile(createFile('', 1024))).toBe('unsupported-type');
  });

  it('rejects files larger than the size limit', () => {
    expect(validateVideoFile(createFile('video/mp4', MAX_VIDEO_BYTES + 1))).toBe('too-large');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateVideoFile(createFile('video/mp4', MAX_VIDEO_BYTES))).toBeNull();
  });

  it('rejects a supported container whose codec this browser cannot play', () => {
    vi.spyOn(HTMLVideoElement.prototype, 'canPlayType').mockReturnValue('');
    expect(validateVideoFile(createFile('video/mp4', 1024))).toBe('unsupported-codec');
  });

  it('size and type are checked before the codec probe', () => {
    const probe = vi.spyOn(HTMLVideoElement.prototype, 'canPlayType');
    validateVideoFile(createFile('application/pdf', 1024));
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('canPlayVideoType', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reflects HTMLVideoElement.canPlayType', () => {
    vi.spyOn(HTMLVideoElement.prototype, 'canPlayType').mockReturnValue('probably');
    expect(canPlayVideoType('video/mp4')).toBe(true);

    vi.spyOn(HTMLVideoElement.prototype, 'canPlayType').mockReturnValue('');
    expect(canPlayVideoType('video/mp4')).toBe(false);
  });
});

describe('validateVideoDimensions', () => {
  it('accepts dimensions within the limit', () => {
    expect(validateVideoDimensions(1280, 720)).toBeNull();
  });

  it('accepts dimensions exactly at the limit', () => {
    expect(validateVideoDimensions(MAX_VIDEO_WIDTH, MAX_VIDEO_HEIGHT)).toBeNull();
  });

  it('rejects a width beyond the limit', () => {
    expect(validateVideoDimensions(MAX_VIDEO_WIDTH + 1, 720)).toBe('dimensions-too-large');
  });

  it('rejects a height beyond the limit', () => {
    expect(validateVideoDimensions(1280, MAX_VIDEO_HEIGHT + 1)).toBe('dimensions-too-large');
  });
});

describe('validateVideoDuration', () => {
  it('accepts a duration within the limit', () => {
    expect(validateVideoDuration(10)).toBeNull();
  });

  it('accepts a duration exactly at the limit', () => {
    expect(validateVideoDuration(MAX_VIDEO_DURATION_SECONDS)).toBeNull();
  });

  it('rejects a duration beyond the limit', () => {
    expect(validateVideoDuration(MAX_VIDEO_DURATION_SECONDS + 1)).toBe('duration-too-long');
  });
});
