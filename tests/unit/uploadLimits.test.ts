import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LONG_EDGE,
  MAX_IMAGE_PIXELS,
} from '../../src/lib/fileValidation';
import {
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_LONG_EDGE,
  MAX_VIDEO_SHORT_EDGE,
} from '../../src/lib/videoValidation';
import {
  buildContentUploadError,
  buildImageUploadError,
  getImageAndVideoAcceptAttribute,
  getImageLimits,
  getVideoLimits,
} from '../../src/lib/uploadLimits';

describe('v2-S2 uploadLimits — single source of truth', () => {
  describe('image limits', () => {
    const limits = getImageLimits();

    it('exposes the same accept attribute as the fileValidation constants', () => {
      expect(limits.acceptAttribute).toBe(ACCEPTED_IMAGE_TYPES.join(','));
    });

    it('mirrors the fileValidation byte / resolution / pixel caps', () => {
      expect(limits.maxBytes).toBe(MAX_IMAGE_BYTES);
      expect(limits.maxLongEdge).toBe(MAX_IMAGE_LONG_EDGE);
      expect(limits.maxPixels).toBe(MAX_IMAGE_PIXELS);
    });

    it('rounds the byte cap to whole megabytes for the hint and the error template', () => {
      expect(limits.maxMegabytes).toBe(Math.round(MAX_IMAGE_BYTES / (1024 * 1024)));
    });
  });

  describe('video limits', () => {
    const limits = getVideoLimits();

    it('exposes the same accept attribute as the videoValidation constants', () => {
      expect(limits.acceptAttribute).toBe(ACCEPTED_VIDEO_TYPES.join(','));
    });

    it('mirrors the videoValidation byte / resolution / duration caps', () => {
      expect(limits.maxBytes).toBe(MAX_VIDEO_BYTES);
      expect(limits.maxLongEdge).toBe(MAX_VIDEO_LONG_EDGE);
      expect(limits.maxShortEdge).toBe(MAX_VIDEO_SHORT_EDGE);
      expect(limits.maxDurationSeconds).toBe(MAX_VIDEO_DURATION_SECONDS);
    });
  });

  it('combines image + video accept attributes for the content upload input', () => {
    const combined = getImageAndVideoAcceptAttribute();
    for (const t of ACCEPTED_IMAGE_TYPES) expect(combined).toContain(t);
    for (const t of ACCEPTED_VIDEO_TYPES) expect(combined).toContain(t);
  });

  describe('buildImageUploadError', () => {
    it('maps the four validation codes to the image-* banner codes with the current limits', () => {
      const types = buildImageUploadError('space-photo', 'unsupported-type');
      expect(types.source).toBe('space-photo');
      expect(types.code).toBe('image-unsupported-type');
      expect(types.params.formats).toContain('PNG');
      expect(types.params.maxMb).toBe(Math.round(MAX_IMAGE_BYTES / (1024 * 1024)));

      expect(buildImageUploadError('content', 'too-large').code).toBe('image-too-large');
      expect(buildImageUploadError('content', 'dimensions-too-large').code).toBe(
        'image-dimensions-too-large',
      );
      expect(buildImageUploadError('content', 'decode-error').code).toBe('image-decode-error');
    });
  });

  describe('buildContentUploadError', () => {
    it('routes an image kind through the image code family', () => {
      expect(buildContentUploadError('image', 'too-large').code).toBe('image-too-large');
    });

    it('routes a video kind through the video code family with video limit params', () => {
      const err = buildContentUploadError('video', 'duration-too-long');
      expect(err.code).toBe('video-duration-too-long');
      expect(err.params.maxSeconds).toBe(MAX_VIDEO_DURATION_SECONDS);
      expect(err.params.maxLongEdge).toBe(MAX_VIDEO_LONG_EDGE);
      expect(err.params.maxShortEdge).toBe(MAX_VIDEO_SHORT_EDGE);
    });
  });
});
