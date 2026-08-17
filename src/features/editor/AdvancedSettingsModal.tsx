import type { ReactNode } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { useModalDialog } from './useModalDialog';

interface AdvancedSettingsModalProps {
  onClose: () => void;
  children: ReactNode;
}

/**
 * Houses the properties-panel controls a user reaches for occasionally rather than on every
 * object (curvature, installation mode, occlusion, contact shadow, environment integration) so
 * the main panel stays short instead of growing a new inline section per feature.
 */
export function AdvancedSettingsModal({ onClose, children }: AdvancedSettingsModalProps) {
  const { messages } = useLocale();
  const { dialogRef, titleId } = useModalDialog(onClose);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog advanced-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <h2 id={titleId}>{messages.editorAdvancedSettingsTitle}</h2>
        {children}
        <div className="editor-properties-actions">
          <button type="button" onClick={onClose}>
            {messages.editorAdvancedSettingsCloseButton}
          </button>
        </div>
      </div>
    </div>
  );
}
