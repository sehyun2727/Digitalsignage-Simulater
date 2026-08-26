import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectInitialLocale } from '../../src/i18n/detectLocale';

function setBrowserLanguages(languages: string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(languages[0] ?? 'ja');
}

describe('detectInitialLocale', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to Japanese when nothing is stored, regardless of browser locale', () => {
    setBrowserLanguages(['ko-KR', 'en-US']);

    expect(detectInitialLocale()).toBe('ja');
  });

  it('uses a previously stored supported locale', () => {
    setBrowserLanguages(['en-US']);
    window.localStorage.setItem('signage-canvas.locale', 'ko');

    expect(detectInitialLocale()).toBe('ko');
  });

  it('falls back to Japanese when the stored value is unsupported', () => {
    setBrowserLanguages(['en-US']);
    window.localStorage.setItem('signage-canvas.locale', 'fr');

    expect(detectInitialLocale()).toBe('ja');
  });
});
