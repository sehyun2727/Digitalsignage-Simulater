import { useLocale } from '../i18n/localeContext';
import { isSupportedLocale, SUPPORTED_LOCALES } from '../types/i18n';

export function LanguageSelector() {
  const { locale, messages, setLocale } = useLocale();

  return (
    <div className="language-selector">
      <label htmlFor="language-select">{messages.languageSelectorLabel}</label>
      <select
        id="language-select"
        value={locale}
        onChange={(event) => {
          const { value } = event.target;
          if (isSupportedLocale(value)) {
            setLocale(value);
          }
        }}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {messages.localeName[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
