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
    const originalPosition = window.document.body.style.position;
    const originalTop = window.document.body.style.top;
    const originalWidth = window.document.body.style.width;
    // iOS Safari ignores `overflow: hidden` on the body for rubber-band scroll.
    // Locking the body to `position: fixed` (with the scroll offset captured as a
    // negative `top`) prevents the page from scrolling behind the modal. The scroll
    // position is restored on cleanup so the user returns to where they were.
    const scrollY = window.scrollY;
    window.document.body.style.overflow = 'hidden';
    window.document.body.style.position = 'fixed';
    window.document.body.style.top = `-${scrollY}px`;
    window.document.body.style.width = '100%';

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
      window.document.body.style.position = originalPosition;
      window.document.body.style.top = originalTop;
      window.document.body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { dialogRef, titleId };
}
