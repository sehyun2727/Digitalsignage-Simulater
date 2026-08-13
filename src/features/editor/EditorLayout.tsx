import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSelector } from '../../components/LanguageSelector';
import { useLocale } from '../../i18n/localeContext';
import { buildExportFilename } from '../../lib/exportFilename';
import type { ImageValidationError } from '../../lib/fileValidation';
import { selectCanRedo, selectCanUndo, useEditorStore } from '../../store/editorStore';
import { useUiStore } from '../../store/uiStore';
import type { EditorCanvasHandle } from './EditorCanvas';
import { EditorCanvas } from './EditorCanvas';
import { OnboardingOverlay } from './OnboardingOverlay';
import { Toolbar } from './Toolbar';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function EditorLayout() {
  const { messages } = useLocale();
  const objectCount = useEditorStore((state) => state.document.objects.length);
  const objects = useEditorStore((state) => state.document.objects);
  const spaceBackground = useEditorStore((state) => state.document.spaceBackground);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const selectObject = useEditorStore((state) => state.selectObject);
  const comparisonMode = useUiStore((state) => state.comparisonMode);
  const setComparisonMode = useUiStore((state) => state.setComparisonMode);
  const onboardingDismissed = useUiStore((state) => state.onboardingDismissed);
  const canvasRef = useRef<EditorCanvasHandle>(null);
  const [announcement, setAnnouncement] = useState('');
  const [onboardingOpen, setOnboardingOpen] = useState(!onboardingDismissed);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        deleteSelected();
        return;
      }

      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, undo, redo]);

  const handleImageError = useCallback(
    (error: ImageValidationError) => {
      if (error === 'unsupported-type') {
        setAnnouncement(messages.editorImageUploadErrorUnsupportedType);
      } else if (error === 'too-large') {
        setAnnouncement(messages.editorImageUploadErrorTooLarge);
      } else {
        setAnnouncement(messages.editorImageUploadErrorDecodeFailed);
      }
    },
    [messages],
  );

  const handleExport = useCallback(() => {
    // EditorCanvas.exportToDataUrl() always captures the composed result, never the
    // comparison-mode space-photo-only view, regardless of what is currently on screen.
    let dataUrl: string | null = null;
    try {
      dataUrl = canvasRef.current?.exportToDataUrl() ?? null;
    } catch {
      // Fall through to the accessible error announcement below.
    }

    if (!dataUrl) {
      setAnnouncement(messages.editorExportErrorAnnouncement);
      return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = buildExportFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    setAnnouncement(messages.editorExportedAnnouncement);
  }, [messages]);

  const handleQuickCompareToggle = useCallback(() => {
    const next = !comparisonMode;
    setComparisonMode(next);
    if (next) selectObject(null);
  }, [comparisonMode, setComparisonMode, selectObject]);

  const statusHint = useMemo(() => {
    if (!spaceBackground) return messages.statusBarHintNoSpace;
    const hasSignage = objects.some(
      (object) => object.kind === 'display' || object.kind === 'portable',
    );
    if (!hasSignage) return messages.statusBarHintNoSignage;
    const hasContent = objects.some(
      (object) =>
        (object.kind === 'display' || object.kind === 'portable') && object.content !== null,
    );
    if (!hasContent) return messages.statusBarHintNoContent;
    return messages.statusBarHintReady;
  }, [spaceBackground, objects, messages]);

  return (
    <div className="editor-layout">
      <header className="editor-header">
        <h1 className="editor-header-title">{messages.appTitle}</h1>
        <div className="editor-header-actions">
          <button type="button" onClick={undo} disabled={!canUndo}>
            {messages.editorUndoButton}
          </button>
          <button type="button" onClick={redo} disabled={!canRedo}>
            {messages.editorRedoButton}
          </button>
          <button type="button" onClick={handleQuickCompareToggle}>
            {comparisonMode
              ? messages.headerCompareToResultButton
              : messages.headerCompareToOriginalButton}
          </button>
          <LanguageSelector />
          <button type="button" onClick={handleExport} disabled={!spaceBackground}>
            {messages.editorExportButton}
          </button>
        </div>
      </header>

      <div className="editor-workspace">
        <div className="editor-canvas-wrapper">
          {!spaceBackground && !comparisonMode && (
            <p className="editor-empty-hint">{messages.editorCanvasEmptyHint}</p>
          )}
          {spaceBackground && objectCount === 0 && !comparisonMode && (
            <p className="editor-empty-hint">{messages.editorCanvasNoSignageHint}</p>
          )}
          <EditorCanvas
            ref={canvasRef}
            comparisonMode={comparisonMode}
            onImageError={handleImageError}
          />
        </div>
        <Toolbar onImageError={handleImageError} />
      </div>

      <p className="editor-status-bar">{statusHint}</p>

      <p role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </p>

      {onboardingOpen && <OnboardingOverlay onDismiss={() => setOnboardingOpen(false)} />}
    </div>
  );
}
