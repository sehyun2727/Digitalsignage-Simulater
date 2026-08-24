import { useEffect, useRef } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { documentToPreviewPoint, previewToDocumentPoint } from '../../lib/quadGeometry';
import {
  clampPoint01,
  documentToNormalized,
  normalizedToDocument,
} from '../../lib/occlusion';
import type { DocumentSize, Point } from '../../lib/occlusion';
import { useEditorStore } from '../../store/editorStore';
import { MAX_OCCLUSION_POINTS, MIN_OCCLUSION_POINTS } from '../../types/editor';

interface OcclusionEditOverlayProps {
  documentSize: DocumentSize;
  fitScale: number;
}

/** Keyboard nudge step for a point handle, in normalized (0-1) document fraction. */
const NUDGE_STEP = 0.01;
const NUDGE_STEP_LARGE = 0.05;

/**
 * HTML overlay for editing an arbitrary-point occlusion polygon. Renders only the visual
 * polygon outline and draggable point handles — the feather/opacity sliders and action
 * buttons live in the toolbar so they don't cover the canvas on mobile.
 */
export function OcclusionEditOverlay({ documentSize, fitScale }: OcclusionEditOverlayProps) {
  const { messages } = useLocale();
  const occlusionEditObjectId = useEditorStore((state) => state.occlusionEditObjectId);
  const draftPoints = useEditorStore((state) => state.occlusionDraftPoints);
  const updateOcclusionDraftPoints = useEditorStore((state) => state.updateOcclusionDraftPoints);
  const cancelOcclusionEdit = useEditorStore((state) => state.cancelOcclusionEdit);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activePointRef = useRef<number | null>(null);

  useEffect(() => {
    if (!occlusionEditObjectId) return;
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelOcclusionEdit();
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [occlusionEditObjectId, cancelOcclusionEdit]);

  // Editing is opened from the "詳細設定" settings modal, which on the mobile stacked layout
  // (canvas above a long, page-scrolling toolbar - see the 48rem media query in global.css) is
  // typically reached only after scrolling well past the canvas. The modal closes itself as soon
  // as this overlay mounts (see Toolbar.tsx's setSettingsOpen(false) before beginOcclusionEdit),
  // but that leaves the page scrolled to wherever the modal trigger was, with the canvas - and
  // this overlay's own tap-to-add-point target - off-screen and no longer reachable without the
  // user guessing to scroll back up manually.
  useEffect(() => {
    if (!occlusionEditObjectId) return;
    containerRef.current?.scrollIntoView({ block: 'center' });
  }, [occlusionEditObjectId]);

  if (!occlusionEditObjectId) return null;

  const previewPointFor = (point: Point): Point =>
    documentToPreviewPoint(normalizedToDocument(point, documentSize), fitScale);

  const normalizedFromClient = (clientX: number, clientY: number): Point | null => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return null;
    const previewPoint = { x: clientX - box.left, y: clientY - box.top };
    const documentPoint = previewToDocumentPoint(previewPoint, fitScale);
    return clampPoint01(documentToNormalized(documentPoint, documentSize));
  };

  const handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (draftPoints.length >= MAX_OCCLUSION_POINTS) return;
    const point = normalizedFromClient(event.clientX, event.clientY);
    if (!point) return;
    updateOcclusionDraftPoints([...draftPoints, point]);
  };

  const handlePointPointerDown = (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activePointRef.current = index;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
  };

  const handlePointPointerMove = (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointRef.current !== index) return;
    const point = normalizedFromClient(event.clientX, event.clientY);
    if (!point) return;
    const next = [...draftPoints];
    next[index] = point;
    updateOcclusionDraftPoints(next);
  };

  const handlePointPointerUp = (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointRef.current !== index) return;
    activePointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const removePoint = (index: number) => {
    if (draftPoints.length <= MIN_OCCLUSION_POINTS) return;
    updateOcclusionDraftPoints(draftPoints.filter((_, pointIndex) => pointIndex !== index));
  };

  const handlePointKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removePoint(index);
      return;
    }
    const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
    let delta: Point | null = null;
    if (event.key === 'ArrowLeft') delta = { x: -step, y: 0 };
    else if (event.key === 'ArrowRight') delta = { x: step, y: 0 };
    else if (event.key === 'ArrowUp') delta = { x: 0, y: -step };
    else if (event.key === 'ArrowDown') delta = { x: 0, y: step };
    if (!delta) return;
    event.preventDefault();
    const current = draftPoints[index]!;
    const next = clampPoint01({ x: current.x + delta.x, y: current.y + delta.y });
    const nextPoints = [...draftPoints];
    nextPoints[index] = next;
    updateOcclusionDraftPoints(nextPoints);
  };

  const outlinePoints = draftPoints
    .map((point) => {
      const preview = previewPointFor(point);
      return `${preview.x},${preview.y}`;
    })
    .join(' ');

  return (
    <div className="occlusion-edit-overlay" ref={containerRef} onClick={handleBackgroundClick}>
      <p className="occlusion-edit-hint">{messages.editorOcclusionHint}</p>
      {draftPoints.length >= 2 && (
        <svg className="occlusion-edit-outline" aria-hidden="true">
          <polygon points={outlinePoints} />
        </svg>
      )}
      {draftPoints.map((point, index) => {
        const preview = previewPointFor(point);
        return (
          <div
            key={index}
            role="slider"
            tabIndex={0}
            className="occlusion-edit-handle"
            style={{ left: `${preview.x}px`, top: `${preview.y}px` }}
            aria-label={`${messages.editorOcclusionPointLabel} ${index + 1}`}
            aria-valuetext={`${Math.round(point.x * 100)}%, ${Math.round(point.y * 100)}%`}
            onPointerDown={handlePointPointerDown(index)}
            onPointerMove={handlePointPointerMove(index)}
            onPointerUp={handlePointPointerUp(index)}
            onPointerCancel={handlePointPointerUp(index)}
            onKeyDown={handlePointKeyDown(index)}
          >
            {index + 1}
          </div>
        );
      })}
    </div>
  );
}
