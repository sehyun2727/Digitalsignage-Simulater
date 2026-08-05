import { isSupportedLocale, type Locale } from '../types/i18n';

const STORAGE_KEY = 'signage-canvas.locale';

export function readStoredLocale(): Locale | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value !== null && isSupportedLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage may be unavailable (e.g. private browsing); locale
    // selection still works for the current session.
  }
}
