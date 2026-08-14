import { useRef } from 'react';
import { useLocale } from '../../i18n/localeContext';
import {
  clampPoint01,
  documentToNormalized,
  documentToPreviewPoint,
  normalizedToDocument,
  previewToDocumentPoint,
  QUAD_CORNER_ORDER,
  quadPoints,
  validateQuad,
} from '../../lib/quadGeometry';
import type { DocumentSize, Point, QuadCorner, QuadInvalidReason } from '../../lib/quadGeometry';
import { useEditorStore } from '../../store/editorStore';
import type { Messages } from '../../types/i18n';

interface PerspectiveEditOverlayProps {
  documentSize: DocumentSize;
  fitScale: number;
}

/** `keyof Messages` narrowed to the string-valued keys (excludes `localeName`, the one
 *  Record-valued field), so indexing `messages` through one of these keys always yields a
 *  plain string rather than the full union of every message's value type. */
type StringMessageKey = {
  [K in keyof Messages]: Messages[K] extends string ? K : never;
}[keyof Messages];

const CORNER_LABEL_KEY: Record<QuadCorner, StringMessageKey> = {
  topLeft: 'editorPerspectiveCornerTopLeft',
  topRight: 'editorPerspectiveCornerTopRight',
  bottomRight: 'editorPerspectiveCornerBottomRight',
  bottomLeft: 'editorPerspectiveCornerBottomLeft',
};

const ERROR_MESSAGE_KEY: Record<QuadInvalidReason, StringMessageKey> = {
  'invalid-values': 'editorPerspectiveErrorInvalidValues',
  'out-of-bounds': 'editorPerspectiveErrorOutOfBounds',
  'self-intersecting': 'editorPerspectiveErrorSelfIntersecting',
  concave: 'editorPerspectiveErrorConcave',
  'min-area': 'editorPerspectiveErrorMinArea',
  'min-edge': 'editorPerspectiveErrorMinEdge',
};

/** Keyboard nudge step for a corner handle, in normalized (0-1) document fraction. */
const NUDGE_STEP = 0.01;
const NUDGE_STEP_LARGE = 0.05;

/**
 * HTML overlay (not Konva) rendered as a sibling of the Stage inside `.editor-canvas-container`,
 * absolutely positioned over it. documentToPreviewPoint/previewToDocumentPoint (quadGeometry.ts)
 * exist specifically for this: the Stage always fills its box at one uniform scale with no
 * letterboxing (EditorCanvas.tsx), so a plain HTML/pointer-event drag surface — the same pattern
 * PortableBuilderModal.tsx already uses for its screen-region editor — can track the Stage's
 * coordinate space with a single scalar conversion, without needing Konva-native shapes for the
 * drag handles.
 */
export function PerspectiveEditOverlay({ documentSize, fitScale }: PerspectiveEditOverlayProps) {
  const { messages } = useLocale();
  const perspectiveEditId = useEditorStore((state) => state.perspectiveEditId);
  const draftQuad = useEditorStore((state) => state.perspectiveDraftQuad);
  const updatePerspectiveDraft = useEditorStore((state) => state.updatePerspectiveDraft);
  const applyPerspectiveEdit = useEditorStore((state) => state.applyPerspectiveEdit);
  const cancelPerspectiveEdit = useEditorStore((state) => state.cancelPerspectiveEdit);
  const resetPerspectiveEdit = useEditorStore((state) => state.resetPerspectiveEdit);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeCornerRef = useRef<QuadCorner | null>(null);

  if (!perspectiveEditId || !draftQuad) return null;

  const validation = validateQuad(draftQuad);

  const previewPointForCorner = (corner: QuadCorner): Point => {
    const documentPoint = normalizedToDocument(draftQuad[corner], documentSize);
    return documentToPreviewPoint(documentPoint, fitScale);
  };

  const updateCorner = (corner: QuadCorner, clientX: number, clientY: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const previewPoint = { x: clientX - box.left, y: clientY - box.top };
    const documentPoint = previewToDocumentPoint(previewPoint, fitScale);
    const normalizedPoint = clampPoint01(documentToNormalized(documentPoint, documentSize));
    updatePerspectiveDraft({ ...draftQuad, [corner]: normalizedPoint });
  };

  const handlePointerDown = (corner: QuadCorner) => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activeCornerRef.current = corner;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
  };

  const handlePointerMove = (corner: QuadCorner) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeCornerRef.current !== corner) return;
    updateCorner(corner, event.clientX, event.clientY);
  };

  const handlePointerUp = (corner: QuadCorner) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeCornerRef.current !== corner) return;
    activeCornerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (corner: QuadCorner) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
    let delta: Point | null = null;
    if (event.key === 'ArrowLeft') delta = { x: -step, y: 0 };
    else if (event.key === 'ArrowRight') delta = { x: step, y: 0 };
    else if (event.key === 'ArrowUp') delta = { x: 0, y: -step };
    else if (event.key === 'ArrowDown') delta = { x: 0, y: step };
    if (!delta) return;
    event.preventDefault();
    const current = draftQuad[corner];
    const next = clampPoint01({ x: current.x + delta.x, y: current.y + delta.y });
    updatePerspectiveDraft({ ...draftQuad, [corner]: next });
  };

  const handleNumericFieldChange = (corner: QuadCorner, axis: 'x' | 'y', value: number) => {
    if (!Number.isFinite(value)) return;
    const current = draftQuad[corner];
    const next = clampPoint01({ ...current, [axis]: value });
    updatePerspectiveDraft({ ...draftQuad, [corner]: next });
  };

  const handleApply = () => {
    applyPerspectiveEdit();
  };

  const outlinePoints = quadPoints(draftQuad)
    .map((corner) => {
      const preview = documentToPreviewPoint(normalizedToDocument(corner, documentSize), fitScale);
      return `${preview.x},${preview.y}`;
    })
    .join(' ');

  return (
    <div className="perspective-edit-overlay" ref={containerRef}>
      <p className="perspective-edit-hint">{messages.editorPerspectiveHint}</p>
      <svg className="perspective-edit-outline" aria-hidden="true">
        <polygon points={outlinePoints} />
      </svg>
      {QUAD_CORNER_ORDER.map((corner) => {
        const preview = previewPointForCorner(corner);
        const point = draftQuad[corner];
        return (
          <div
            key={corner}
            role="slider"
            tabIndex={0}
            className="perspective-edit-handle"
            style={{ left: `${preview.x}px`, top: `${preview.y}px` }}
            aria-label={messages[CORNER_LABEL_KEY[corner]]}
            aria-valuetext={`${Math.round(point.x * 100)}%, ${Math.round(point.y * 100)}%`}
            onPointerDown={handlePointerDown(corner)}
            onPointerMove={handlePointerMove(corner)}
            onPointerUp={handlePointerUp(corner)}
            onPointerCancel={handlePointerUp(corner)}
            onKeyDown={handleKeyDown(corner)}
          />
        );
      })}
      {/* Grouped into one bottom-docked panel (rather than each piece positioning itself
          absolutely) so the corner fields, validation alert, and action buttons stack in normal
          flow and never overlap the top-docked hint text — they previously did at some viewport
          widths, which silently ate clicks on Apply/Cancel/Reset in a real browser layout. */}
      <div className="perspective-edit-panel">
        <div className="perspective-corner-fields">
          {QUAD_CORNER_ORDER.map((corner) => {
            const point = draftQuad[corner];
            return (
              <fieldset key={corner}>
                <legend>{messages[CORNER_LABEL_KEY[corner]]}</legend>
                <label>
                  <span>{messages.editorPositionXLabel}</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={1}
                    value={Number(point.x.toFixed(2))}
                    onChange={(event) =>
                      handleNumericFieldChange(corner, 'x', Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  <span>{messages.editorPositionYLabel}</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={1}
                    value={Number(point.y.toFixed(2))}
                    onChange={(event) =>
                      handleNumericFieldChange(corner, 'y', Number(event.target.value))
                    }
                  />
                </label>
              </fieldset>
            );
          })}
        </div>
        {!validation.valid && validation.reason && (
          <p role="alert" className="editor-properties-error">
            {messages[ERROR_MESSAGE_KEY[validation.reason]]}
          </p>
        )}
        <div className="editor-properties-actions">
          <button type="button" onClick={resetPerspectiveEdit}>
            {messages.editorPerspectiveResetButton}
          </button>
          <button type="button" onClick={cancelPerspectiveEdit}>
            {messages.editorPerspectiveCancelButton}
          </button>
          <button type="button" onClick={handleApply} disabled={!validation.valid}>
            {messages.editorPerspectiveApplyButton}
          </button>
        </div>
      </div>
    </div>
  );
}
