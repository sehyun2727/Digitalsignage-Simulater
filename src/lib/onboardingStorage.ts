const STORAGE_KEY = 'signage-canvas.onboarding-dismissed';

export function readOnboardingDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOnboardingDismissed(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // localStorage may be unavailable (e.g. private browsing); the onboarding
    // overlay simply reappears next session, which is an acceptable fallback.
  }
}
