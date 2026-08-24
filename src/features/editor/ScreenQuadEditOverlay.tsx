import { useRef } from 'react';
import { useLocale } from '../../i18n/localeContext';
import {
  clampPoint01,
  validateQuad,
  QUAD_CORNER_ORDER,
  quadPoints,
} from '../../lib/quadGeometry';
import type { Point, QuadCorner } from '../../lib/quadGeometry';
import { fromLocalPoint, toLocalPoint } from '../../lib/rotationTransform';
import { useEditorStore } from '../../store/editorStore';
import type { PortableSignageObject } from '../../types/editor';

interface ScreenQuadEditOverlayProps {
  object: PortableSignageObject;
  fitScale: number;
}

const NUDGE_STEP = 0.005;
const NUDGE_STEP_LARGE = 0.02;

export function ScreenQuadEditOverlay({ object, fitScale }: ScreenQuadEditOverlayProps) {
  const { messages } = useLocale();
  const screenQuadEditId = useEditorStore((state) => state.screenQuadEditId);
  const draftQuad = useEditorStore((state) => state.screenQuadDraftQuad);
  const updateScreenQuadDraft = useEditorStore((state) => state.updateScreenQuadDraft);
  const applyScreenQuadEdit = useEditorStore((state) => state.applyScreenQuadEdit);
  const cancelScreenQuadEdit = useEditorStore((state) => state.cancelScreenQuadEdit);
  const resetScreenQuadEdit = useEditorStore((state) => state.resetScreenQuadEdit);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeCornerRef = useRef<QuadCorner | null>(null);

  if (!screenQuadEditId || !draftQuad || screenQuadEditId !== object.id) return null;

  const validation = validateQuad(draftQuad);

  // Convert a normalized corner (0-1 of object bbox) to preview CSS pixels
  const previewPointForCorner = (corner: QuadCorner): Point => {
    const localPx = {
      x: draftQuad[corner].x * object.width,
      y: draftQuad[corner].y * object.height,
    };
    const docPt = fromLocalPoint(localPx, object);
    return { x: docPt.x * fitScale, y: docPt.y * fitScale };
  };

  const updateCorner = (corner: QuadCorner, clientX: number, clientY: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const previewPt = { x: clientX - box.left, y: clientY - box.top };
    const docPt = { x: previewPt.x / fitScale, y: previewPt.y / fitScale };
    const localPx = toLocalPoint(docPt, object);
    const normalized = clampPoint01({
      x: localPx.x / object.width,
      y: localPx.y / object.height,
    });
    updateScreenQuadDraft({ ...draftQuad, [corner]: normalized });
  };

  const handlePointerDown =
    (corner: QuadCorner) => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      activeCornerRef.current = corner;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus();
    };

  const handlePointerMove =
    (corner: QuadCorner) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (activeCornerRef.current !== corner) return;
      updateCorner(corner, event.clientX, event.clientY);
    };

  const handlePointerUp =
    (corner: QuadCorner) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (activeCornerRef.current !== corner) return;
      activeCornerRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    };

  const handleKeyDown =
    (corner: QuadCorner) => (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
      let delta: { x: number; y: number } | null = null;
      if (event.key === 'ArrowLeft') delta = { x: -step, y: 0 };
      else if (event.key === 'ArrowRight') delta = { x: step, y: 0 };
      else if (event.key === 'ArrowUp') delta = { x: 0, y: -step };
      else if (event.key === 'ArrowDown') delta = { x: 0, y: step };
      if (!delta) return;
      event.preventDefault();
      const current = draftQuad[corner];
      const next = clampPoint01({ x: current.x + delta.x, y: current.y + delta.y });
      updateScreenQuadDraft({ ...draftQuad, [corner]: next });
    };

  const outlinePoints = quadPoints(draftQuad)
    .map((corner) => {
      const localPx = { x: corner.x * object.width, y: corner.y * object.height };
      const docPt = fromLocalPoint(localPx, object);
      const preview = { x: docPt.x * fitScale, y: docPt.y * fitScale };
      return `${preview.x},${preview.y}`;
    })
    .join(' ');

  const CORNER_LABELS: Record<QuadCorner, string> = {
    topLeft: '↖',
    topRight: '↗',
    bottomRight: '↘',
    bottomLeft: '↙',
  };

  return (
    <div className="perspective-edit-overlay" ref={containerRef}>
      <p className="perspective-edit-hint">{messages.portableScreenQuadHint}</p>
      <svg className="perspective-edit-outline" aria-hidden="true">
        <polygon points={outlinePoints} />
      </svg>
      {QUAD_CORNER_ORDER.map((corner) => {
        const preview = previewPointForCorner(corner);
        return (
          <div
            key={corner}
            role="slider"
            tabIndex={0}
            className="perspective-edit-handle"
            style={{ left: `${preview.x}px`, top: `${preview.y}px` }}
            aria-label={CORNER_LABELS[corner]}
            onPointerDown={handlePointerDown(corner)}
            onPointerMove={handlePointerMove(corner)}
            onPointerUp={handlePointerUp(corner)}
            onPointerCancel={handlePointerUp(corner)}
            onKeyDown={handleKeyDown(corner)}
          />
        );
      })}
      <div className="perspective-edit-panel">
        {!validation.valid && (
          <p role="alert" className="editor-properties-error">
            {messages.editorPerspectiveErrorMinEdge}
          </p>
        )}
        <div className="editor-properties-actions">
          <button type="button" onClick={resetScreenQuadEdit}>
            {messages.portableScreenQuadResetButton}
          </button>
          <button type="button" onClick={cancelScreenQuadEdit}>
            {messages.portableScreenQuadCancelButton}
          </button>
          <button type="button" onClick={applyScreenQuadEdit} disabled={!validation.valid}>
            {messages.portableScreenQuadApplyButton}
          </button>
        </div>
      </div>
    </div>
  );
}
