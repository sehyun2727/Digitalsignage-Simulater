import type { EditorDocument } from '../types/editor';

export type OnboardingStep = 1 | 2 | 3 | 4;

export const ONBOARDING_STEP_COUNT = 4;

/**
 * Which of the 4 sales-flow steps (space photo -> add signage -> apply content -> save PNG) the
 * user has not yet completed. Mirrors EditorLayout's `statusHint` derivation (same field checks,
 * same `.some` semantics: any one signage object having content is enough to reach step 4) but
 * returns a step number for the onboarding progress guide instead of a status-bar sentence.
 */
export function getOnboardingStep(document: EditorDocument): OnboardingStep {
  if (!document.spaceBackground) return 1;

  const hasSignage = document.objects.some(
    (object) => object.kind === 'display' || object.kind === 'portable',
  );
  if (!hasSignage) return 2;

  const hasContent = document.objects.some(
    (object) =>
      (object.kind === 'display' || object.kind === 'portable') && object.content !== null,
  );
  if (!hasContent) return 3;

  return 4;
}
