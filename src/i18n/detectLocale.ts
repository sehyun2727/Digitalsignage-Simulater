import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '../types/i18n';
import { readStoredLocale } from './storage';

function detectBrowserLocale(): Locale | null {
  const languages = window.navigator.languages ?? [window.navigator.language];
  for (const language of languages) {
    const primary = language.split('-')[0]?.toLowerCase();
    if (primary && isSupportedLocale(primary)) {
      return primary;
    }
  }
  return null;
}

export function detectInitialLocale(): Locale {
  return readStoredLocale() ?? detectBrowserLocale() ?? DEFAULT_LOCALE;
}
