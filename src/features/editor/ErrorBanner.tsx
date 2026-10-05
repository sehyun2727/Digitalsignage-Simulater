import { useLocale } from '../../i18n/localeContext';
import { resolveErrorMessages } from '../../lib/errorBannerMessages';
import type { UploadError, UploadErrorSource } from '../../store/uiStore';

interface ErrorBannerProps {
  error: UploadError;
  /** When `true`, the banner carries `role="alert"` so assistive tech announces it. Only the
   *  single under-canvas banner uses this — the duplicates placed under upload buttons
   *  (requirement 2-5 §3-2) stay silent to avoid double announcements for one failure. */
  announce: boolean;
  onDismiss: (source: UploadErrorSource) => void;
  /** Compact variant for the under-button copies: hides the dismiss × and tightens padding so
   *  it fits beside its sibling input without stealing vertical space. The under-canvas banner
   *  uses the full variant with the × and both lines. */
  variant: 'full' | 'inline';
}

export function ErrorBanner({ error, announce, onDismiss, variant }: ErrorBannerProps) {
  const { messages } = useLocale();
  const { cause, remedy } = resolveErrorMessages(error, messages);
  return (
    <div
      className={`error-banner error-banner--${variant}`}
      role={announce ? 'alert' : undefined}
      data-testid={
        variant === 'full' ? 'editor-error-banner' : `editor-error-banner-inline-${error.source}`
      }
    >
      <span className="error-banner-icon" aria-hidden="true">
        ⚠
      </span>
      <div className="error-banner-body">
        <p className="error-banner-cause">{cause}</p>
        <p className="error-banner-remedy">{remedy}</p>
      </div>
      {variant === 'full' && (
        <button
          type="button"
          className="error-banner-dismiss"
          aria-label={messages.errorBannerDismissButtonLabel}
          onClick={() => onDismiss(error.source)}
        >
          ×
        </button>
      )}
    </div>
  );
}
