import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '../types/i18n';
import { detectInitialLocale } from './detectLocale';
import { LocaleContext, type LocaleContextValue } from './localeContext';
import { MESSAGES } from './locales';
import { writeStoredLocale } from './storage';

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStoredLocale(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, messages: MESSAGES[locale], setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
