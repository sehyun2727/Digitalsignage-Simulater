import { create } from 'zustand';
import { readOnboardingDismissed, writeOnboardingDismissed } from '../lib/onboardingStorage';
import { readRealismGuideDismissed, writeRealismGuideDismissed } from '../lib/realismGuideStorage';

/**
 * Error source taxonomy (v2-S2, requirement C7). Each source has one slot: a new error replaces
 * the previous one for that source, success at the same source clears it, and success at a
 * different source leaves it untouched (requirement 5-1 / section 2.3 of the sprint spec).
 */
export type UploadErrorSource = 'space-photo' | 'content' | 'export';

/** Discriminated error code per source. Keeps every runtime failure a renderer might show in
 *  one union — i18n strings and the banner UI pick a cause/remedy pair by this code. */
export type UploadErrorCode =
  // space-photo + content (image kind) share identical codes; the renderer picks the right
  // noun phrase from the source + kind context, not from a different code name.
  | 'image-unsupported-type'
  | 'image-too-large'
  | 'image-dimensions-too-large'
  | 'image-decode-error'
  // content (video kind)
  | 'video-unsupported-type'
  | 'video-too-large'
  | 'video-unsupported-codec'
  | 'video-dimensions-too-large'
  | 'video-duration-too-long'
  | 'video-decode-error'
  // export
  | 'export-png-failed'
  | 'export-video-failed';

/** Error params are the raw numbers the i18n layer interpolates — never a formatted string.
 *  Keeps the data shape serializable and lets the message rebuild in the active locale when
 *  the user switches language mid-error (requirement 2-5 / self-validation V13). */
export type UploadErrorParams = Record<string, number | string | readonly string[]>;

export interface UploadError {
  source: UploadErrorSource;
  code: UploadErrorCode;
  params: UploadErrorParams;
}

/**
 * Transient, non-persisted UI state (comparison mode, sales review mode) plus two deliberately-
 * persisted exceptions (onboarding and realism-guide dismissal, via onboardingStorage.ts/
 * realismGuideStorage.ts) plus the per-source upload-error slots (v2-S2).
 *
 * Error slots are intentionally in the UI store rather than the editor store — they are not
 * part of the document and must not land in undo/redo history (sprint spec section 2.4).
 */
export interface UiState {
  comparisonMode: boolean;
  salesReviewMode: boolean;
  onboardingDismissed: boolean;
  realismGuideDismissed: boolean;
  /** When true, the HULL watermark is suppressed from PNG and video exports. */
  watermarkDisabled: boolean;
  /** One slot per source. Only sources with an active error appear here. */
  errors: Partial<Record<UploadErrorSource, UploadError>>;
  /** Monotonically-increasing per-source request id. Async callers capture this at the start
   *  of their request; when the request resolves/rejects they compare the captured id against
   *  the current one and silently drop their result if a newer request has started — stopping
   *  a slow failure from clobbering a later success (sprint spec section 2.3, async-race
   *  guard, self-validation V7). */
  requestSequence: Record<UploadErrorSource, number>;
  setComparisonMode: (value: boolean) => void;
  setSalesReviewMode: (value: boolean) => void;
  dismissOnboarding: () => void;
  dismissRealismGuide: () => void;
  toggleWatermarkDisabled: () => void;
  /** Allocates a new request id for `source` and returns it. Callers hold on to this id until
   *  their request resolves. */
  beginUploadRequest: (source: UploadErrorSource) => number;
  /** Replaces (or installs) the single error slot for `source`. No-ops if `requestId` is stale
   *  — i.e. a newer request for the same source has already started. */
  setUploadError: (source: UploadErrorSource, requestId: number, error: UploadError) => void;
  /** Clears the error slot for `source` (success path, or × click). Also no-ops if the caller's
   *  captured `requestId` has been superseded. */
  clearUploadError: (source: UploadErrorSource, requestId: number) => void;
  /** Dismiss variant for the × button: ignores request ids and clears unconditionally. */
  dismissUploadError: (source: UploadErrorSource) => void;
  /** v2-S3 2-6: UserGuideModal open state. Lifted into the uiStore so both the header's
   *  「使い方ガイド」 button (EditorLayout) and the footer's 📖 icon (App shell) toggle a
   *  single source of truth. Session-only — not persisted to localStorage. */
  userGuideOpen: boolean;
  setUserGuideOpen: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  comparisonMode: false,
  salesReviewMode: false,
  onboardingDismissed: readOnboardingDismissed(),
  realismGuideDismissed: readRealismGuideDismissed(),
  watermarkDisabled: false,
  errors: {},
  requestSequence: { 'space-photo': 0, content: 0, export: 0 },
  userGuideOpen: false,
  setUserGuideOpen: (value) => set({ userGuideOpen: value }),
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
  beginUploadRequest: (source) => {
    const next = get().requestSequence[source] + 1;
    set((state) => ({ requestSequence: { ...state.requestSequence, [source]: next } }));
    return next;
  },
  setUploadError: (source, requestId, error) => {
    if (get().requestSequence[source] !== requestId) return;
    set((state) => ({ errors: { ...state.errors, [source]: error } }));
  },
  clearUploadError: (source, requestId) => {
    if (get().requestSequence[source] !== requestId) return;
    set((state) => {
      if (!state.errors[source]) return state;
      const { [source]: _dropped, ...rest } = state.errors;
      void _dropped;
      return { errors: rest };
    });
  },
  dismissUploadError: (source) => {
    set((state) => {
      if (!state.errors[source]) return state;
      const { [source]: _dropped, ...rest } = state.errors;
      void _dropped;
      return { errors: rest };
    });
  },
}));
