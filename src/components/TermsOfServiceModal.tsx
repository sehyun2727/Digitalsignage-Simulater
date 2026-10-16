import { useLocale } from '../i18n/localeContext';
import { useModalDialog } from '../features/editor/useModalDialog';
import { HULL_CONTACT_PAGE_URL } from '../lib/hullContact';
import { TOS_EFFECTIVE_DATE, TOS_REVISED_DATE, formatTosDate } from '../lib/termsOfServiceDate';

interface TermsOfServiceModalProps {
  onClose: () => void;
}

export function TermsOfServiceModal({ onClose }: TermsOfServiceModalProps) {
  const { messages } = useLocale();
  const { dialogRef, titleId } = useModalDialog(onClose);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog terms-of-service-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <h2 id={titleId}>{messages.termsOfServiceTitle}</h2>

        <div className="terms-of-service-body">
          {/* v2-P3 A7: effective + revised dates substitute from a single config
             (src/lib/termsOfServiceDate.ts). Empty date → entire <span> is
             omitted (prevents the "2026年月日" broken-template appearance). The
             whole <p> is hidden only if BOTH strings resolve empty. */}
          {(() => {
            const effective = formatTosDate(
              messages.termsOfServiceEffectiveDate,
              TOS_EFFECTIVE_DATE,
            );
            const revised = formatTosDate(messages.termsOfServiceRevisedDate, TOS_REVISED_DATE);
            if (!effective && !revised) return null;
            return (
              <p className="terms-of-service-meta">
                {effective && <span>{effective}</span>}
                {revised && <span>{revised}</span>}
              </p>
            );
          })()}

          <p className="terms-of-service-intro">{messages.termsOfServiceIntro}</p>

          {messages.termsOfServiceSections.map((section) => (
            <section key={section.heading} className="terms-of-service-section">
              <h3>{section.heading}</h3>
              {section.paragraphs?.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
              {section.items && section.items.length > 0 && (
                <ul>
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <p className="terms-of-service-contact-link">
            <a href={HULL_CONTACT_PAGE_URL} target="_blank" rel="noopener noreferrer">
              {HULL_CONTACT_PAGE_URL}
            </a>
          </p>
        </div>

        <div className="user-guide-actions">
          <button type="button" onClick={onClose}>
            {messages.termsOfServiceCloseButton}
          </button>
        </div>
      </div>
    </div>
  );
}
