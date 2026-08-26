import type { ReactNode } from 'react';
import { useLocale } from '../i18n/localeContext';
import { useModalDialog } from '../features/editor/useModalDialog';

interface UserGuideModalProps {
  onClose: () => void;
}

function BulletSection({ heading, items }: { heading: string; items: readonly string[] }) {
  return (
    <section className="user-guide-section">
      <h3>{heading}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ParagraphSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="user-guide-section">
      <h3>{heading}</h3>
      <p>{children}</p>
    </section>
  );
}

/**
 * One-shot introduction/help dialog opened from the small footer link. Walks a first-time visitor
 * through the tool's purpose, basic workflow, signage/content options, realism controls, and
 * browser-local privacy behavior — all reachable from a single link so no persistent chrome eats
 * canvas height.
 */
export function UserGuideModal({ onClose }: UserGuideModalProps) {
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
        className="modal-dialog user-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <h2 id={titleId}>{messages.userGuideTitle}</h2>

        <ParagraphSection heading={messages.userGuideAboutHeading}>
          {messages.userGuideAboutBody}
        </ParagraphSection>

        <section className="user-guide-section">
          <h3>{messages.userGuideHowHeading}</h3>
          <ol>
            {messages.userGuideHowSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <BulletSection
          heading={messages.userGuideSignageHeading}
          items={messages.userGuideSignageItems}
        />

        <BulletSection
          heading={messages.userGuideContentHeading}
          items={messages.userGuideContentItems}
        />

        <BulletSection
          heading={messages.userGuideRealismHeading}
          items={messages.userGuideRealismItems}
        />

        <BulletSection
          heading={messages.userGuidePerspectiveHeading}
          items={messages.userGuidePerspectiveItems}
        />

        <ParagraphSection heading={messages.userGuideOverlaysHeading}>
          {messages.userGuideOverlaysBody}
        </ParagraphSection>

        <BulletSection
          heading={messages.userGuideTipsHeading}
          items={messages.userGuideTipsItems}
        />

        <BulletSection
          heading={messages.userGuideDataHeading}
          items={messages.userGuideDataItems}
        />

        <ParagraphSection heading={messages.userGuideExportHeading}>
          {messages.userGuideExportBody}
        </ParagraphSection>

        <div className="user-guide-actions">
          <button type="button" onClick={onClose}>
            {messages.userGuideCloseButton}
          </button>
        </div>
      </div>
    </div>
  );
}
