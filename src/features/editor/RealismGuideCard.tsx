import { useId } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { useUiStore } from '../../store/uiStore';

/**
 * A short, non-blocking first-use guide for the Appearance panel's realism controls (sprint spec
 * sections 15-16): shown above AppearanceFields the first time a display/portable object is
 * selected, until dismissed. Structurally mirrors OnboardingOverlay.tsx (same non-modal card, same
 * localStorage-backed one-time dismissal via uiStore), but scoped inline to this panel rather than
 * fixed-position over the whole page, since it specifically introduces these controls in place.
 */
export function RealismGuideCard() {
  const { messages } = useLocale();
  const dismissRealismGuide = useUiStore((state) => state.dismissRealismGuide);
  const titleId = useId();

  return (
    <div className="realism-guide-card" role="note" aria-labelledby={titleId}>
      <h3 id={titleId}>{messages.realismGuideTitle}</h3>
      <p>{messages.realismGuideDescription}</p>
      <ul>
        <li>{messages.realismGuideStepPreset}</li>
        <li>{messages.realismGuideStepInstallation}</li>
        <li>{messages.realismGuideStepEnvironment}</li>
        <li>{messages.realismGuideStepOcclusion}</li>
      </ul>
      <button type="button" onClick={dismissRealismGuide}>
        {messages.realismGuideDismissButton}
      </button>
    </div>
  );
}
