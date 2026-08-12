import { useLocale } from '../i18n/localeContext';
import { HULL_CONTACT_URL } from '../lib/hullContact';

export function HullCta() {
  const { messages } = useLocale();

  return (
    <div className="hull-cta">
      <a
        className="hull-cta-button"
        href={HULL_CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        {messages.hullCtaLabel}
      </a>
      <span className="hull-cta-notice">{messages.hullCtaExternalNotice}</span>
    </div>
  );
}
