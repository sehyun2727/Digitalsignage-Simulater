import { useId, useState } from 'react';
import { useLocale } from '../../i18n/localeContext';

/**
 * v2-S3 2-3: in-panel collapsible appearance guide. Was previously a dismissable floating
 * card tied to `uiStore.realismGuideDismissed`; now a stable, non-dismissable description
 * block that sits at the top of the Appearance section and summarises each child control in
 * one line. The dismissal state, its localStorage persistence, and the dismiss button are
 * all gone — the user instead collapses the block whenever they want (session-only state).
 */
export function RealismGuideCard() {
  const { messages } = useLocale();
  const titleId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(true);

  return (
    <section className="realism-guide-card" aria-labelledby={titleId}>
      <button
        type="button"
        className="realism-guide-card-toggle"
        data-testid="appearance-guide-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span id={titleId} className="realism-guide-card-title">
          {messages.realismGuideTitle}
        </span>
        <span className="realism-guide-card-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div id={bodyId} className="realism-guide-card-body">
          <p>{messages.realismGuideDescription}</p>
          <ul>
            <li>{messages.realismGuideStepPreset}</li>
            <li>{messages.realismGuideStepInstallation}</li>
            <li>{messages.realismGuideStepEnvironment}</li>
            <li>{messages.realismGuideStepOcclusion}</li>
          </ul>
        </div>
      )}
    </section>
  );
}
