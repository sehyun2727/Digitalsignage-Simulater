import { create } from 'zustand';
import { readOnboardingDismissed, writeOnboardingDismissed } from '../lib/onboardingStorage';
import { readRealismGuideDismissed, writeRealismGuideDismissed } from '../lib/realismGuideStorage';

/**
 * Transient, non-persisted UI state (comparison mode) plus two deliberately-persisted exceptions
 * (onboarding and realism-guide dismissal, via onboardingStorage.ts/realismGuideStorage.ts). Kept
 * entirely separate from useEditorStore's persisted document/selection/undo-redo state: none of
 * this belongs in document history.
 */
export interface UiState {
  comparisonMode: boolean;
  onboardingDismissed: boolean;
  realismGuideDismissed: boolean;
  setComparisonMode: (value: boolean) => void;
  dismissOnboarding: () => void;
  dismissRealismGuide: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  comparisonMode: false,
  onboardingDismissed: readOnboardingDismissed(),
  realismGuideDismissed: readRealismGuideDismissed(),
  setComparisonMode: (value) => set({ comparisonMode: value }),
  dismissOnboarding: () => {
    writeOnboardingDismissed();
    set({ onboardingDismissed: true });
  },
  dismissRealismGuide: () => {
    writeRealismGuideDismissed();
    set({ realismGuideDismissed: true });
  },
}));
