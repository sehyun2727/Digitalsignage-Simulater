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
import { interpolate } from '../../src/lib/errorBannerMessages';
import { ja } from '../../src/i18n/locales/ja';
import { ko } from '../../src/i18n/locales/ko';
import { en } from '../../src/i18n/locales/en';

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

  // v2-S2 보완 (0-4): the pre-upload hint strings must now interpolate the resolution caps
  // too, not only format + megabytes. These assertions pin the drift-check so a future
  // template rewrite that drops e.g. `{maxLongEdge}` fails here with a clear reason.
  describe('pre-upload hint templates include resolution limits (3-2 보완)', () => {
    const imageLimits = getImageLimits();
    const videoLimits = getVideoLimits();
    const spaceParams = {
      formats: imageLimits.extensionLabels.join(' / '),
      maxMb: imageLimits.maxMegabytes,
      maxLongEdge: imageLimits.maxLongEdge,
    };
    const imageParams = {
      imageFormats: imageLimits.extensionLabels.join(' / '),
      imageMaxMb: imageLimits.maxMegabytes,
      imageMaxLongEdge: imageLimits.maxLongEdge,
    };
    const videoParams = {
      videoFormats: videoLimits.extensionLabels.join(' / '),
      videoMaxMb: videoLimits.maxMegabytes,
      videoMaxLongEdge: videoLimits.maxLongEdge,
      videoMaxShortEdge: videoLimits.maxShortEdge,
      videoMaxSeconds: videoLimits.maxDurationSeconds,
    };

    for (const [name, locale] of [
      ['ja', ja],
      ['ko', ko],
      ['en', en],
    ] as const) {
      it(`${name}: uploadHintSpacePhoto resolves with maxMb + maxLongEdge`, () => {
        const out = interpolate(locale.uploadHintSpacePhoto, spaceParams);
        expect(out).toContain(String(imageLimits.maxMegabytes));
        expect(out).toContain(String(imageLimits.maxLongEdge));
        expect(out).not.toMatch(/\{[a-zA-Z]+\}/);
      });
      it(`${name}: uploadHintContentImage resolves with imageMaxMb + imageMaxLongEdge`, () => {
        const out = interpolate(locale.uploadHintContentImage, imageParams);
        expect(out).toContain(String(imageLimits.maxMegabytes));
        expect(out).toContain(String(imageLimits.maxLongEdge));
        expect(out).not.toMatch(/\{[a-zA-Z]+\}/);
      });
      it(`${name}: uploadHintContentVideo resolves with every video cap`, () => {
        const out = interpolate(locale.uploadHintContentVideo, videoParams);
        expect(out).toContain(String(videoLimits.maxMegabytes));
        expect(out).toContain(String(videoLimits.maxLongEdge));
        expect(out).toContain(String(videoLimits.maxShortEdge));
        expect(out).toContain(String(videoLimits.maxDurationSeconds));
        expect(out).not.toMatch(/\{[a-zA-Z]+\}/);
      });
    }
  });
});
