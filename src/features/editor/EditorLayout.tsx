import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSelector } from '../../components/LanguageSelector';
import { useLocale } from '../../i18n/localeContext';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { buildExportError } from '../../lib/uploadLimits';
import { buildExportFilename, buildVideoExportFilename } from '../../lib/exportFilename';
import { isVideoExportSupported } from '../../lib/videoExportCapability';
import { recordCanvasToVideo, resolveVideoExportDurationMs } from '../../lib/videoExport';
import { selectCanRedo, selectCanUndo, useEditorStore } from '../../store/editorStore';
import { useUiStore } from '../../store/uiStore';
import type { EditorCanvasHandle } from './EditorCanvas';
import { EditorCanvas } from './EditorCanvas';
import { ErrorBanner } from './ErrorBanner';
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
  // Hints are the "polite status" success-side announcements (export complete, drop missed its
  // target, …). Error banners live in uiStore.errors and have their own rendering + role=alert
  // channel below — hints and errors are two separate state slots and two separate elements
  // (requirement C7). Hints never carry an error style now.
  const [hintAnnouncement, setHintAnnouncement] = useState('');
  const errors = useUiStore((state) => state.errors);
  const beginUploadRequest = useUiStore((state) => state.beginUploadRequest);
  const setUploadError = useUiStore((state) => state.setUploadError);
  const clearUploadError = useUiStore((state) => state.clearUploadError);
  const dismissUploadError = useUiStore((state) => state.dismissUploadError);
  const setUserGuideOpen = useUiStore((state) => state.setUserGuideOpen);
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

  const handleExport = useCallback(() => {
    // EditorCanvas.exportToDataUrl() always captures the composed result, never the
    // comparison-mode space-photo-only view, regardless of what is currently on screen.
    const requestId = beginUploadRequest('export');
    let dataUrl: string | null = null;
    try {
      dataUrl = canvasRef.current?.exportToDataUrl() ?? null;
    } catch {
      // Fall through to the error banner below.
    }

    if (!dataUrl) {
      setUploadError('export', requestId, buildExportError('png'));
      return;
    }

    // iOS (iPhone/iPad) does not support the `download` attribute on anchor tags.
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
      setHintAnnouncement(messages.editorExportedIosAnnouncement);
    } else {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = buildExportFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      setHintAnnouncement(messages.editorExportedAnnouncement);
    }
    clearUploadError('export', requestId);
  }, [messages, beginUploadRequest, setUploadError, clearUploadError]);

  const handleExportVideo = useCallback(async () => {
    if (!videoExportSupported || isExportingVideo) return;

    const requestId = beginUploadRequest('export');
    const canvas = canvasRef.current?.beginVideoExportCapture() ?? null;
    if (!canvas) {
      setUploadError('export', requestId, buildExportError('video'));
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
      setHintAnnouncement(messages.editorExportedVideoAnnouncement);
      clearUploadError('export', requestId);
    } catch {
      setUploadError('export', requestId, buildExportError('video'));
    } finally {
      canvasRef.current?.endVideoExportCapture();
      setIsExportingVideo(false);
    }
  }, [
    messages,
    objects,
    videoExportSupported,
    isExportingVideo,
    beginUploadRequest,
    setUploadError,
    clearUploadError,
  ]);

  const handleDropWithoutTarget = useCallback(() => {
    // Drop-outside-target is a hint, not an error (requirement C7). The error banner channel
    // is reserved for actual upload failures.
    setHintAnnouncement(messages.editorContentDropNoTargetHint);
  }, [messages]);

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
  }, [
    salesReviewMode,
    setSalesReviewMode,
    selectObject,
    cancelPerspectiveEdit,
    cancelOcclusionEdit,
  ]);

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
          {/* v2-S3 2-6 (ADR 0012 D-9): always-visible UserGuide entry next to the language
           *  selector. The footer 📖 icon stays as a secondary entry point. The old
           *  `userGuideHereHint` 「← マニュアルはこちら」 inline label was removed with this
           *  button — users now have a persistent, labelled control instead of a decorative
           *  arrow pointing to a corner icon. */}
          <button
            type="button"
            className="editor-header-guide-button"
            data-testid="editor-header-user-guide"
            onClick={() => setUserGuideOpen(true)}
          >
            {messages.userGuideOpenButton}
          </button>
          <button
            type="button"
            data-testid="editor-header-export-png"
            onClick={handleExport}
            disabled={!spaceBackground || isExportingVideo}
          >
            {messages.editorExportButton}
          </button>
          {videoExportSupported && (
            <button
              type="button"
              data-testid="editor-header-export-video"
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
        <div className="editor-canvas-column">
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
              onDropWithoutTarget={handleDropWithoutTarget}
            />
            {/* Minimal in-canvas overlay still carries the watermark-off badge: it is a visible
                badge, not a status announcement, so it stays here where the user looking at the
                canvas can see it. The old hint/announcement rows moved to the status area below
                (requirement 2-5 §3-1 — status elements must not overlap the canvas). */}
            {watermarkDisabled && (
              <div className="editor-canvas-watermark-badge">
                <span className="watermark-off-badge" aria-label="watermark disabled">
                  watermark off
                </span>
              </div>
            )}
          </div>
          {/* v2-S2 status area below the canvas (requirement 2-5 §3-1, C7). Error banner above
              the polite status hint when both are present — order is enforced by DOM order, not
              CSS. The error banner lives here (not inside the canvas container) so its bounding
              box never overlaps the canvas. */}
          <div className="editor-status-area" data-testid="editor-status-area">
            {errors['space-photo'] && (
              <ErrorBanner
                error={errors['space-photo']}
                announce
                onDismiss={dismissUploadError}
                variant="full"
              />
            )}
            {errors.content && (
              <ErrorBanner
                error={errors.content}
                announce={!errors['space-photo']}
                onDismiss={dismissUploadError}
                variant="full"
              />
            )}
            {errors.export && (
              <ErrorBanner
                error={errors.export}
                announce={!errors['space-photo'] && !errors.content}
                onDismiss={dismissUploadError}
                variant="full"
              />
            )}
            <div
              className="editor-status-area-hint"
              role="status"
              aria-live="polite"
              data-testid="editor-status-area-hint"
            >
              {hintAnnouncement || statusHint}
            </div>
          </div>
        </div>
        {!salesReviewMode && (
          <Toolbar
            onExport={handleExport}
            onExportVideo={handleExportVideo}
            videoExportSupported={videoExportSupported}
            isExportingVideo={isExportingVideo}
          />
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
