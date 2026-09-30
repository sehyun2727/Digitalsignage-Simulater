import { useState } from 'react';
import { useLocale } from '../i18n/localeContext';
import { HULL_CONTACT_URL } from '../lib/hullContact';
import { TermsOfServiceModal } from './TermsOfServiceModal';

export function HullCta() {
  const { messages } = useLocale();
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <>
      <div className="hull-cta">
        <a
          className="hull-cta-button"
          href={HULL_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {messages.hullCtaLabel}
        </a>
        <button
          type="button"
          className="hull-cta-terms-link"
          onClick={() => setTermsOpen(true)}
        >
          {messages.hullCtaTermsLinkLabel}
        </button>
      </div>
      {termsOpen && <TermsOfServiceModal onClose={() => setTermsOpen(false)} />}
    </>
  );
}
