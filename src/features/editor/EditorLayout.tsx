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
  const objects = useEditorStore((state) => state.document.objects);
  const spaceBackground = useEditorStore((state) => state.document.spaceBackground);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const resetDocument = useEditorStore((state) => state.resetDocument);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const selectObject = useEditorStore((state) => state.selectObject);
  const cancelPerspectiveEdit = useEditorStore((state) => state.cancelPerspectiveEdit);
  const cancelOcclusionEdit = useEditorStore((state) => state.cancelOcclusionEdit);
  const comparisonMode = useUiStore((state) => state.comparisonMode);
  const setComparisonMode = useUiStore((state) => state.setComparisonMode);
  const salesReviewMode = useUiStore((state) => state.salesReviewMode);
  const setSalesReviewMode = useUiStore((state) => state.setSalesReviewMode);
  const onboardingDismissed = useUiStore((state) => state.onboardingDismissed);
  const watermarkDisabled = useUiStore((state) => state.watermarkDisabled);
  const toggleWatermarkDisabled = useUiStore((state) => state.toggleWatermarkDisabled);
  const canvasRef = useRef<EditorCanvasHandle>(null);
  const resetClickCountRef = useRef(0);
  const [announcement, setAnnouncementText] = useState('');
  const [isAnnouncementError, setIsAnnouncementError] = useState(false);
  const setAnnouncement = useCallback((text: string, isError = false) => {
    setAnnouncementText(text);
    setIsAnnouncementError(isError);
  }, []);
  const [onboardingOpen, setOnboardingOpen] = useState(!onboardingDismissed);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  // Feature support does not change over the page's lifetime, so this is computed once rather
  // than re-probed on every render.
  const videoExportSupported = useMemo(() => isVideoExportSupported(), []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target) || salesReviewMode) return;

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
  }, [deleteSelected, undo, redo, salesReviewMode]);

  const handleImageError = useCallback(
    (error: ImageValidationError) => {
      if (error === 'unsupported-type') {
        setAnnouncement(messages.editorImageUploadErrorUnsupportedType, true);
      } else if (error === 'too-large') {
        setAnnouncement(messages.editorImageUploadErrorTooLarge, true);
      } else if (error === 'dimensions-too-large') {
        setAnnouncement(messages.editorImageUploadErrorDimensionsTooLarge, true);
      } else {
        setAnnouncement(messages.editorImageUploadErrorDecodeFailed, true);
      }
    },
    [messages, setAnnouncement],
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
        setAnnouncement(messages.editorVideoUploadErrorUnsupportedType, true);
      } else if (error === 'too-large') {
        setAnnouncement(messages.editorVideoUploadErrorTooLarge, true);
      } else if (error === 'unsupported-codec') {
        setAnnouncement(messages.editorVideoUploadErrorUnsupportedCodec, true);
      } else if (error === 'dimensions-too-large') {
        setAnnouncement(messages.editorVideoUploadErrorDimensionsTooLarge, true);
      } else if (error === 'duration-too-long') {
        setAnnouncement(messages.editorVideoUploadErrorDurationTooLong, true);
      } else {
        setAnnouncement(messages.editorVideoUploadErrorDecodeFailed, true);
      }
    },
    [messages, handleImageError, setAnnouncement],
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
      setAnnouncement(messages.editorExportErrorAnnouncement, true);
      return;
    }

    // iOS (iPhone/iPad) does not support the `download` attribute on anchor tags.
    // Try window.open first (works in Safari); if it returns null the browser
    // blocked the popup (common in iOS Chrome), so fall back to an anchor with
    // target="_blank" which bypasses popup blocking by routing through a real DOM click.
    const isIos = /iP(hone|od|ad)/.test(navigator.userAgent);
    if (isIos) {
      const opened = window.open(dataUrl, '_blank');
      if (!opened) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setAnnouncement(messages.editorExportedIosAnnouncement);
    } else {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = buildExportFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      setAnnouncement(messages.editorExportedAnnouncement);
    }
  }, [messages, setAnnouncement]);

  const handleExportVideo = useCallback(async () => {
    if (!videoExportSupported || isExportingVideo) return;

    const canvas = canvasRef.current?.beginVideoExportCapture() ?? null;
    if (!canvas) {
      setAnnouncement(messages.editorExportErrorAnnouncement, true);
      return;
    }

    setIsExportingVideo(true);
    try {
      const videoDurationsSeconds = objects
        .flatMap((object) =>
          object.kind === 'display' || object.kind === 'portable' ? [object.content] : [],
        )
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
      setAnnouncement(messages.editorExportVideoErrorAnnouncement, true);
    } finally {
      canvasRef.current?.endVideoExportCapture();
      setIsExportingVideo(false);
    }
  }, [messages, objects, videoExportSupported, isExportingVideo, setAnnouncement]);

  const handleDropWithoutTarget = useCallback(() => {
    setAnnouncement(messages.editorContentDropNoTargetHint, true);
  }, [messages, setAnnouncement]);

  const handleQuickCompareToggle = useCallback(() => {
    const next = !comparisonMode;
    setComparisonMode(next);
    if (next) {
      // Any open perspective/occlusion overlay is anchored to the composed view, not the
      // comparison photo, so its handles would misalign against the space photo underneath and
      // silently eat clicks — dismiss the edit session on entry rather than leaving stale UI.
      selectObject(null);
      cancelPerspectiveEdit();
      cancelOcclusionEdit();
    }
  }, [comparisonMode, setComparisonMode, selectObject, cancelPerspectiveEdit, cancelOcclusionEdit]);

  // A distraction-free, non-editable presentation view (sprint spec section 17): the toolbar is
  // hidden and the canvas itself becomes unclickable (see the `.editor-canvas-wrapper--review`
  // CSS rule), so a salesperson can hand the screen to a client without risking an accidental
  // move/resize/delete. Clearing the selection on entry also clears the Transformer's handles,
  // the same way handleQuickCompareToggle already does for comparison mode.
  const handleSalesReviewToggle = useCallback(() => {
    const next = !salesReviewMode;
    setSalesReviewMode(next);
    if (next) {
      // Sales review disables canvas pointer events entirely (see .editor-canvas-wrapper--review);
      // an open perspective/occlusion overlay would remain visible but unresponsive, trapping the
      // user with no way to Apply/Cancel until they exit sales review.
      selectObject(null);
      cancelPerspectiveEdit();
      cancelOcclusionEdit();
    }
  }, [salesReviewMode, setSalesReviewMode, selectObject, cancelPerspectiveEdit, cancelOcclusionEdit]);

  // Clicking ⟳ five times in a row (regardless of the confirm result) triggers a hidden toggle
  // that disables the export watermark. Clicking five more times re-enables it.
  const handleResetClick = useCallback(() => {
    resetClickCountRef.current += 1;
    if (resetClickCountRef.current >= 5) {
      toggleWatermarkDisabled();
      resetClickCountRef.current = 0;
    }
    if (window.confirm(messages.editorResetConfirm)) resetDocument();
  }, [messages, resetDocument, toggleWatermarkDisabled]);

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
        <div className="app-hero">
          <p className="app-hero-eyebrow">{messages.appTitle}</p>
          <h1 className="app-hero-name">{messages.appName}</h1>
          <p className="app-hero-tagline">{messages.appTagline}</p>
        </div>
        <div className="editor-header-actions">
          {!salesReviewMode && (
            <>
              <button
                type="button"
                className="editor-header-icon-button"
                onClick={handleResetClick}
                title={messages.editorResetButton}
                aria-label={messages.editorResetButton}
              >
                {/* A circular reset arrow keeps the header layout compact and reads as "start
                    over" without needing a text label; the accessible name comes from aria-label. */}
                <span aria-hidden="true">⟳</span>
              </button>
              <button
                type="button"
                className="editor-header-icon-button"
                onClick={undo}
                disabled={!canUndo}
                title={messages.editorUndoButton}
                aria-label={messages.editorUndoButton}
              >
                <span aria-hidden="true">↶</span>
              </button>
              <button
                type="button"
                className="editor-header-icon-button"
                onClick={redo}
                disabled={!canRedo}
                title={messages.editorRedoButton}
                aria-label={messages.editorRedoButton}
              >
                <span aria-hidden="true">↷</span>
              </button>
            </>
          )}
          <button type="button" onClick={handleQuickCompareToggle}>
            {comparisonMode
              ? messages.headerCompareToResultButton
              : messages.headerCompareToOriginalButton}
          </button>
          <button type="button" onClick={handleSalesReviewToggle} aria-pressed={salesReviewMode}>
            {salesReviewMode ? messages.salesReviewExitButton : messages.salesReviewEnterButton}
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
      {salesReviewMode && <p className="editor-header-notice">{messages.salesReviewModeHint}</p>}

      <div className="editor-workspace">
        <div
          className={
            salesReviewMode
              ? 'editor-canvas-wrapper editor-canvas-wrapper--review'
              : 'editor-canvas-wrapper'
          }
        >
          {!spaceBackground && !comparisonMode && !salesReviewMode && (
            <p className="editor-empty-hint">{messages.editorCanvasEmptyHint}</p>
          )}
          <EditorCanvas
            ref={canvasRef}
            comparisonMode={comparisonMode}
            watermarkDisabled={watermarkDisabled}
            onContentError={handleContentError}
            onDropWithoutTarget={handleDropWithoutTarget}
          />
          {/* Status hint + polite announcement region moved inside the canvas wrapper as a
              non-blocking overlay along the bottom edge — this reclaims the ~70px they were
              previously eating below the workspace and lets the canvas fill the whole remaining
              viewport height. Still readable, still `role=status`/aria-live for screen readers,
              and `pointer-events: none` so it never blocks a drag on canvas objects underneath. */}
          <div className="editor-canvas-status-overlay" aria-hidden={!statusHint && !announcement && !watermarkDisabled}>
            {watermarkDisabled && (
              <span className="watermark-off-badge" aria-label="watermark disabled">
                watermark off
              </span>
            )}
            {statusHint && <span className="editor-canvas-status-hint">{statusHint}</span>}
            <span
              role="status"
              aria-live="polite"
              className={
                isAnnouncementError
                  ? 'editor-canvas-status-announcement editor-canvas-status-announcement--error'
                  : 'editor-canvas-status-announcement'
              }
            >
              {announcement}
            </span>
          </div>
        </div>
        {!salesReviewMode && (
          <Toolbar onImageError={handleImageError} onContentError={handleContentError} />
        )}
      </div>

      {onboardingOpen && (
        <OnboardingOverlay
          onDismiss={() => setOnboardingOpen(false)}
          onExportClick={handleExport}
        />
      )}
    </div>
  );
}
