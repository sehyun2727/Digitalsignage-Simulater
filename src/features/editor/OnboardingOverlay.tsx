import { useId, useMemo } from 'react';
import { useLocale } from '../../i18n/localeContext';
import {
  getOnboardingStep,
  ONBOARDING_STEP_COUNT,
  type OnboardingStep,
} from '../../lib/onboardingStep';
import { useEditorStore } from '../../store/editorStore';
import { useUiStore } from '../../store/uiStore';
import type { Messages } from '../../types/i18n';

interface OnboardingOverlayProps {
  onDismiss: () => void;
  /** Reuses EditorLayout's own PNG export handler for step 4 — never duplicated here. */
  onExportClick: () => void;
}

/** Scrolls a toolbar control into view and focuses it so the user's next Enter/click reuses
 *  that control's own existing handler, instead of this card reimplementing file upload/
 *  validation logic for a control it does not own. */
function focusToolbarTrigger(id: string) {
  const element = window.document.getElementById(id);
  if (!(element instanceof HTMLElement)) return;
  element.scrollIntoView({ block: 'center' });
  element.focus();
}

function stepContent(step: OnboardingStep, messages: Messages) {
  switch (step) {
    case 1:
      return {
        title: messages.onboardingStep1Title,
        description: messages.onboardingStep1Description,
        ctaLabel: messages.onboardingStep1CtaLabel,
      };
    case 2:
      return {
        title: messages.onboardingStep2Title,
        description: messages.onboardingStep2Description,
        ctaLabel: messages.onboardingStep2CtaLabel,
      };
    case 3:
      return {
        title: messages.onboardingStep3Title,
        description: messages.onboardingStep3Description,
        ctaLabel: messages.onboardingStep3CtaLabel,
      };
    case 4:
      return {
        title: messages.onboardingStep4Title,
        description: messages.onboardingStep4Description,
        ctaLabel: messages.onboardingStep4CtaLabel,
      };
  }
}

/**
 * A small, non-blocking card guiding a first-time user through the 4-step sales flow (space
 * photo -> add signage -> apply content -> save PNG), one step at a time, based on the document's
 * own current state (see getOnboardingStep). Unlike a modal dialog, it has no backdrop, focus
 * trap, or scroll lock: every toolbar and canvas control stays fully usable while it is showing.
 * Each step's call-to-action reuses an existing handler/store action rather than reimplementing
 * upload or export logic here.
 */
export function OnboardingOverlay({ onDismiss, onExportClick }: OnboardingOverlayProps) {
  const { messages } = useLocale();
  const dismissOnboarding = useUiStore((state) => state.dismissOnboarding);
  const document = useEditorStore((state) => state.document);
  const selectObject = useEditorStore((state) => state.selectObject);
  const selectedId = useEditorStore((state) => state.selectedId);
  const titleId = useId();

  const step = useMemo(() => getOnboardingStep(document), [document]);
  const { title, description, ctaLabel } = stepContent(step, messages);

  const handleDismiss = () => {
    dismissOnboarding();
    onDismiss();
  };

  const handlePrimaryAction = () => {
    if (step === 1) {
      focusToolbarTrigger('toolbar-space-upload-trigger');
      return;
    }
    if (step === 2) {
      // Unlike auto-adding an LED display, this hands the choice of signage type (LED, LCD,
      // transparent LED, portable) back to the user via the real toolbar controls, matching
      // how steps 1 and 3 reuse existing controls instead of performing the action for them.
      focusToolbarTrigger('toolbar-add-signage-trigger');
      return;
    }
    if (step === 3) {
      const alreadySelected = document.objects.some(
        (object) =>
          object.id === selectedId && (object.kind === 'display' || object.kind === 'portable'),
      );
      if (!alreadySelected) {
        const firstSignage = document.objects.find(
          (object) => object.kind === 'display' || object.kind === 'portable',
        );
        if (firstSignage) selectObject(firstSignage.id);
      }
      focusToolbarTrigger('toolbar-content-upload-trigger');
      return;
    }
    onExportClick();
  };

  return (
    <div className="onboarding-card" role="note" aria-labelledby={titleId}>
      <h2 id={titleId}>{messages.onboardingTitle}</h2>
      <p>{messages.onboardingDescription}</p>
      <p className="onboarding-card-progress">
        {step} / {ONBOARDING_STEP_COUNT}
      </p>
      <p className="onboarding-card-step-title">{title}</p>
      <p className="onboarding-card-step-description">{description}</p>
      <div className="onboarding-card-actions">
        <button type="button" onClick={handlePrimaryAction}>
          {ctaLabel}
        </button>
        <button type="button" onClick={handleDismiss}>
          {messages.onboardingDismissButton}
        </button>
      </div>
    </div>
  );
}
