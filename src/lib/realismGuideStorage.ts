const STORAGE_KEY = 'signage-canvas.realism-guide-dismissed';

export function readRealismGuideDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeRealismGuideDismissed(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // localStorage may be unavailable (e.g. private browsing); the guide card
    // simply reappears next session, which is an acceptable fallback.
  }
}
