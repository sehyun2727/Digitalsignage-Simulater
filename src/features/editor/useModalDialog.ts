import { useEffect, useId, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared focus-trap/Esc-to-close/background-scroll-lock/focus-restore behavior for a dialog
 * rendered as a direct child of `.modal-overlay` > `.modal-dialog` (see PortableBuilderModal.tsx,
 * the first modal in the app, whose behavior this hook was extracted from once a second modal
 * needed the identical accessibility behavior).
 */
export function useModalDialog(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    previouslyFocusedRef.current = window.document.activeElement;
    const dialog = dialogRef.current;
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    const originalOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.document.removeEventListener('keydown', handleKeyDown);
      window.document.body.style.overflow = originalOverflow;
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { dialogRef, titleId };
}
