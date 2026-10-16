import { describe, expect, it } from 'vitest';
import { interpolate, resolveErrorMessages } from '../../src/lib/errorBannerMessages';
import { en } from '../../src/i18n/locales/en';
import { ja } from '../../src/i18n/locales/ja';
import { ko } from '../../src/i18n/locales/ko';
import {
  buildContentUploadError,
  getImageLimits,
  getVideoLimits,
} from '../../src/lib/uploadLimits';
import type { Messages } from '../../src/types/i18n';
import type { UploadErrorCode } from '../../src/store/uiStore';

describe('v2-S2 errorBannerMessages', () => {
  describe('interpolate', () => {
    it('replaces every {name} placeholder with its stringified value', () => {
      expect(interpolate('max {n}MB', { n: 10 })).toBe('max 10MB');
    });

    it('leaves unknown placeholders in place so missing params are visible during review', () => {
      expect(interpolate('max {n}MB / {unknown}', { n: 10 })).toBe('max 10MB / {unknown}');
    });
  });

  describe('resolveErrorMessages', () => {
    it('interpolates image-too-large with the current MB limit from the uploadLimits lib', () => {
      const limits = getImageLimits();
      const error = buildContentUploadError('image', 'too-large');
      const { cause, remedy } = resolveErrorMessages(error, ja);
      expect(cause).toContain(String(limits.maxMegabytes));
      expect(remedy).toContain(String(limits.maxMegabytes));
    });

    it('interpolates video-duration-too-long with the duration limit', () => {
      const limits = getVideoLimits();
      const error = buildContentUploadError('video', 'duration-too-long');
      const { cause, remedy } = resolveErrorMessages(error, ja);
      expect(cause).toContain(String(limits.maxDurationSeconds));
      expect(remedy).toContain(String(limits.maxDurationSeconds));
    });

    it('every error code has non-empty cause and remedy strings across all three locales', () => {
      // Every UploadErrorCode value must have both a Cause and a Remedy entry in every locale,
      // otherwise the banner would render as empty text (requirement 2-5 "모든 오류 code에 대해
      // 원인·해결 방법 문구를 ja/ko/en으로 작성하세요"). This loop would catch a locale that
      // forgot one when a new error code is added later.
      const allCodes: UploadErrorCode[] = [
        'image-unsupported-type',
        'image-too-large',
        'image-dimensions-too-large',
        'image-decode-error',
        'video-unsupported-type',
        'video-too-large',
        'video-unsupported-codec',
        'video-dimensions-too-large',
        'video-duration-too-long',
        'video-decode-error',
        'export-png-failed',
        'export-video-failed',
      ];
      for (const locale of [ja, ko, en] as Messages[]) {
        for (const code of allCodes) {
          const { cause, remedy } = resolveErrorMessages(
            { source: 'content', code, params: {} },
            locale,
          );
          expect(cause.trim(), `cause for ${code}`).not.toBe('');
          expect(remedy.trim(), `remedy for ${code}`).not.toBe('');
        }
      }
    });
  });
});
