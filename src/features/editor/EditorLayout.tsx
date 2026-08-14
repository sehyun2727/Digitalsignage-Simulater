import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSelector } from '../../components/LanguageSelector';
import { useLocale } from '../../i18n/localeContext';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import type { ContentValidationError } from '../../lib/contentUpload';
import { buildExportFilename, buildVideoExportFilename } from '../../lib/exportFilename';
import type { ImageValidationError } from '../../lib/fileValidation';
import { isVideoExportSupported } from '../../lib/videoExportCapability';
import { recordCanvasToVideo, resolveVideoExportDurationMs } from '../../lib/videoExport';
import { selectCanRedo, selectCanUndo, useEditorStore } from '../../store/editorStore';
import { useUiStore } from '../../store/uiStore';
import type { ContentKind } from '../../types/editor';
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
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  // Feature support does not change over the page's lifetime, so this is computed once rather
  // than re-probed on every render.
  const videoExportSupported = useMemo(() => isVideoExportSupported(), []);

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

  // Image and video validation errors share the same string values (e.g. 'too-large') for
  // different limits (10MB vs. 80MB), so the announcement must branch on `kind` first to show
  // an accurate message rather than reusing handleImageError's image-only wording.
  const handleContentError = useCallback(
    (kind: ContentKind, error: ContentValidationError) => {
      if (kind === 'image') {
        handleImageError(error as ImageValidationError);
        return;
      }
      if (error === 'unsupported-type') {
        setAnnouncement(messages.editorVideoUploadErrorUnsupportedType);
      } else if (error === 'too-large') {
        setAnnouncement(messages.editorVideoUploadErrorTooLarge);
      } else if (error === 'unsupported-codec') {
        setAnnouncement(messages.editorVideoUploadErrorUnsupportedCodec);
      } else {
        setAnnouncement(messages.editorVideoUploadErrorDecodeFailed);
      }
    },
    [messages, handleImageError],
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

  const handleExportVideo = useCallback(async () => {
    if (!videoExportSupported || isExportingVideo) return;

    const canvas = canvasRef.current?.beginVideoExportCapture() ?? null;
    if (!canvas) {
      setAnnouncement(messages.editorExportErrorAnnouncement);
      return;
    }

    setIsExportingVideo(true);
    try {
      const videoDurationsSeconds = objects
        .flatMap((object) => (object.kind === 'display' || object.kind === 'portable' ? [object.content] : []))
        .flatMap((content) => (content?.kind === 'video' ? [content.sourceId] : []))
        .map((sourceId) => getRegisteredAsset(sourceId)?.image)
        .flatMap((image) => (image instanceof HTMLVideoElement ? [image.duration] : []));

      const blob = await recordCanvasToVideo(canvas, {
        durationMs: resolveVideoExportDurationMs(videoDurationsSeconds),
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildVideoExportFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setAnnouncement(messages.editorExportedVideoAnnouncement);
    } catch {
      setAnnouncement(messages.editorExportVideoErrorAnnouncement);
    } finally {
      canvasRef.current?.endVideoExportCapture();
      setIsExportingVideo(false);
    }
  }, [messages, objects, videoExportSupported, isExportingVideo]);

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
          {videoExportSupported && (
            <button
              type="button"
              onClick={handleExportVideo}
              disabled={!spaceBackground || isExportingVideo}
            >
              {isExportingVideo
                ? messages.editorExportVideoInProgressButton
                : messages.editorExportVideoButton}
            </button>
          )}
        </div>
      </header>
      {!videoExportSupported && (
        <p className="editor-header-notice">{messages.editorExportVideoUnsupportedHint}</p>
      )}

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
            onContentError={handleContentError}
          />
        </div>
        <Toolbar onImageError={handleImageError} onContentError={handleContentError} />
      </div>

      <p className="editor-status-bar">{statusHint}</p>

      <p role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </p>

      {onboardingOpen && <OnboardingOverlay onDismiss={() => setOnboardingOpen(false)} />}
    </div>
  );
}
