import { useId } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { useUiStore } from '../../store/uiStore';

interface OnboardingOverlayProps {
  onDismiss: () => void;
}

/**
 * A small, non-blocking card introducing the always-visible toolbar (Sprint 4.1 correction).
 * Unlike a modal dialog, it has no backdrop, focus trap, or scroll lock: every toolbar and
 * canvas control stays fully usable while it is showing, and it dismisses itself the same way
 * regardless of which button the user presses.
 */
export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  const { messages } = useLocale();
  const dismissOnboarding = useUiStore((state) => state.dismissOnboarding);
  const titleId = useId();

  const handleDismiss = () => {
    dismissOnboarding();
    onDismiss();
  };

  return (
    <div className="onboarding-card" role="note" aria-labelledby={titleId}>
      <h2 id={titleId}>{messages.onboardingTitle}</h2>
      <p>{messages.onboardingDescription}</p>
      <div className="onboarding-card-actions">
        <button type="button" onClick={handleDismiss}>
          {messages.onboardingStartButton}
        </button>
        <button type="button" onClick={handleDismiss}>
          {messages.onboardingDismissButton}
        </button>
      </div>
    </div>
  );
}
