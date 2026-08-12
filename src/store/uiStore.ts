import { create } from 'zustand';
import { readOnboardingDismissed, writeOnboardingDismissed } from '../lib/onboardingStorage';

/**
 * Transient, non-persisted UI state (comparison mode) plus the one deliberately-persisted
 * exception (onboarding dismissal, via onboardingStorage.ts). Kept entirely separate from
 * useEditorStore's persisted document/selection/undo-redo state: none of this belongs in
 * document history.
 */
export interface UiState {
  comparisonMode: boolean;
  onboardingDismissed: boolean;
  setComparisonMode: (value: boolean) => void;
  dismissOnboarding: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  comparisonMode: false,
  onboardingDismissed: readOnboardingDismissed(),
  setComparisonMode: (value) => set({ comparisonMode: value }),
  dismissOnboarding: () => {
    writeOnboardingDismissed();
    set({ onboardingDismissed: true });
  },
}));
