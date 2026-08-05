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

  it('falls back to Japanese when nothing is stored and the browser locale is unsupported', () => {
    setBrowserLanguages(['fr-FR', 'de-DE']);

    expect(detectInitialLocale()).toBe('ja');
  });

  it('uses a supported browser locale when nothing is stored', () => {
    setBrowserLanguages(['ko-KR']);

    expect(detectInitialLocale()).toBe('ko');
  });

  it('prefers a previously stored locale over the browser locale', () => {
    setBrowserLanguages(['en-US']);
    window.localStorage.setItem('signage-canvas.locale', 'ko');

    expect(detectInitialLocale()).toBe('ko');
  });

  it('ignores an unsupported stored value and falls through to the browser locale', () => {
    setBrowserLanguages(['en-US']);
    window.localStorage.setItem('signage-canvas.locale', 'fr');

    expect(detectInitialLocale()).toBe('en');
  });

  it('falls back to Japanese when both the stored value and the browser locale are unsupported', () => {
    setBrowserLanguages(['fr-FR']);
    window.localStorage.setItem('signage-canvas.locale', 'fr');

    expect(detectInitialLocale()).toBe('ja');
  });
});
