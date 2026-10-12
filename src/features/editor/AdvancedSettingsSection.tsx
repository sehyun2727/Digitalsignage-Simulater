import type { ReactNode } from 'react';
import { useId } from 'react';
import { useLocale } from '../../i18n/localeContext';

interface AdvancedSettingsSectionProps {
  open: boolean;
  onToggle: () => void;
  variant: 'content' | 'appearance';
  children: ReactNode;
}

/**
 * v2-S5 U4 (requirement 2-3). The former AdvancedSettingsModal was a center-of-screen
 * `role="dialog"` that hid the signage underneath (requirement 2-3's "사이니지를 가리지
 * 않는 위치"). This section is its inline replacement: a plain accordion panel inside the
 * toolbar body. The container has NO role=dialog, no modal-overlay, and no focus trap —
 * tab order flows naturally from the trigger button into the panel.
 *
 * Keyboard navigation: the toggle button is `aria-expanded` + `aria-controls`; the panel
 * body is a plain `<div>` with `hidden` when closed so inner inputs are kept out of the
 * tab order (same contract as the 2-2 top-level accordion sections).
 *
 * Variant: `content` renders under the Content section; `appearance` renders under the
 * Appearance section.
 */
export function AdvancedSettingsSection({
  open,
  onToggle,
  variant,
  children,
}: AdvancedSettingsSectionProps) {
  const { messages } = useLocale();
  const bodyId = useId();
  const label =
    variant === 'content'
      ? messages.editorContentAdvancedSettingsOpenButton
      : messages.editorAdvancedSettingsOpenButton;
  return (
    <section
      className="toolbar-advanced-settings"
      data-testid={`toolbar-advanced-settings-${variant}`}
    >
      <h3 className="toolbar-subsection-heading">
        <button
          type="button"
          className="toolbar-subsection-toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          data-testid={`toolbar-advanced-settings-${variant}-toggle`}
        >
          <span>{label}</span>
          <span aria-hidden="true" className="toolbar-section-chevron">
            {open ? '▾' : '▸'}
          </span>
        </button>
      </h3>
      <div id={bodyId} className="toolbar-advanced-settings-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
