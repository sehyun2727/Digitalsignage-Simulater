import { create } from 'zustand';
import { readOnboardingDismissed, writeOnboardingDismissed } from '../lib/onboardingStorage';
import { readRealismGuideDismissed, writeRealismGuideDismissed } from '../lib/realismGuideStorage';

/**
 * Transient, non-persisted UI state (comparison mode, sales review mode) plus two deliberately-
 * persisted exceptions (onboarding and realism-guide dismissal, via onboardingStorage.ts/
 * realismGuideStorage.ts). Kept entirely separate from useEditorStore's persisted document/
 * selection/undo-redo state: none of this belongs in document history.
 */
export interface UiState {
  comparisonMode: boolean;
  salesReviewMode: boolean;
  onboardingDismissed: boolean;
  realismGuideDismissed: boolean;
  /** When true, the HULL watermark is suppressed from PNG and video exports. */
  watermarkDisabled: boolean;
  setComparisonMode: (value: boolean) => void;
  setSalesReviewMode: (value: boolean) => void;
  dismissOnboarding: () => void;
  dismissRealismGuide: () => void;
  toggleWatermarkDisabled: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  comparisonMode: false,
  salesReviewMode: false,
  onboardingDismissed: readOnboardingDismissed(),
  realismGuideDismissed: readRealismGuideDismissed(),
  watermarkDisabled: false,
  setComparisonMode: (value) => set({ comparisonMode: value }),
  setSalesReviewMode: (value) => set({ salesReviewMode: value }),
  dismissOnboarding: () => {
    writeOnboardingDismissed();
    set({ onboardingDismissed: true });
  },
  dismissRealismGuide: () => {
    writeRealismGuideDismissed();
    set({ realismGuideDismissed: true });
  },
  toggleWatermarkDisabled: () => set((state) => ({ watermarkDisabled: !state.watermarkDisabled })),
}));
