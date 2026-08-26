import { DEFAULT_LOCALE, type Locale } from '../types/i18n';
import { readStoredLocale } from './storage';

export function detectInitialLocale(): Locale {
  return readStoredLocale() ?? DEFAULT_LOCALE;
}
