import type Konva from 'konva';
import { Group, Line, Rect } from 'react-konva';
import { normalizedQuadToDocument, type DocumentSize } from '../../lib/quadGeometry';
import type { NormalizedQuad, PortableSignageObject, SpaceBackground } from '../../types/editor';
import { ContactShadowView } from './ContactShadowView';
import { OcclusionMaskLayer } from './OcclusionMaskLayer';
import { PerspectiveScreenView } from './PerspectiveScreenView';
import { PortableQuadDebugOverlay } from './PortableQuadDebugOverlay';
import { PortableTemplateBody } from './PortableTemplateBody';
import { WarpedScreenContent } from './WarpedScreenContent';

/**
 * Dev-only calibration overlay flag. Enabled via either build-time
 * `VITE_DEBUG_PORTABLE_QUAD=true` OR runtime `?debugPortableQuad=1` URL param.
 * Evaluated once at module load so the per-render check is a cheap boolean read
 * — no re-parsing of the URL on every frame.
 *
 * The overlay is intentionally not exposed anywhere in the regular UI (no menu
 * entry, no toolbar toggle) so end users never see it; only developers running
 * the dev server with the flag on do.
 */
const SHOW_QUAD_DEBUG = (() => {
  const env = import.meta.env.VITE_DEBUG_PORTABLE_QUAD as string | undefined;
  if (env === 'true' || env === '1') return true;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugPortableQuad') === '1') return true;
  }
  return false;
})();

interface PortableProductViewProps {
  object: PortableSignageObject;
  // Shared select/drag/transform props built by CanvasObjectView, spread onto the outer
  // Group so a portable object participates in the same Transformer as every other kind.
  groupProps: Record<string, unknown>;
  documentSize: DocumentSize | null;
  spaceBackground: SpaceBackground | null;
  /** See SignageDisplayView.tsx — perspective-mode drag handler is passed in as a prop rather
   *  than sourced from the store here, so plain-function unit tests keep working. */
  onPerspectiveQuadTranslate?: (id: string, deltaDocumentX: number, deltaDocumentY: number) => void;
  /** See SignageDisplayView.tsx — draws a dashed outline that traces the quad while selected,
   *  since the shared Transformer can't attach to the quad-shaped hit target. */
  isSelected?: boolean;
}

const PERSPECTIVE_SELECTION_STROKE = '#2563eb';
const PERSPECTIVE_SELECTION_STROKE_WIDTH = 2;
const PERSPECTIVE_SELECTION_DASH: number[] = [8, 4];

/** Flattens the four quad corners into an alternating x,y list in absolute document pixels
 *  for Konva.Line's points prop. */
function quadDocumentPointsFlat(quad: NormalizedQuad, documentSize: DocumentSize): number[] {
  const doc = normalizedQuadToDocument(quad, documentSize);
  return [
    doc.topLeft.x,
    doc.topLeft.y,
    doc.topRight.x,
    doc.topRight.y,
    doc.bottomRight.x,
    doc.bottomRight.y,
    doc.bottomLeft.x,
    doc.bottomLeft.y,
  ];
}

/**
 * Renders a template portable signage as a self-contained compound object:
 *
 *   Layer 1 (bottom): WarpedScreenContent — dark screen backing + user content perspective-
 *     warped into the preset screenQuad for the current templateView.
 *   Layer 2 (top): PortableTemplateBody — the device photo (frame/stand/wheels) with its
 *     screen area made transparent via maskWhiteBackground + clearScreenArea, so the warped
 *     content in layer 1 shows through that hole while the device body overlays the edges.
 *
 * The screenQuad is developer-hardcoded per preset (PORTABLE_PRESET_SCREEN_QUADS), not
 * user-editable. The entire compound object moves, scales, and rotates as one unit.
 *
 * In global perspective placement mode the body is captured and warped by PerspectiveScreenView
 * at document level, bypassing the object's own x/y/rotation rect geometry.
 */
export function PortableProductView({
  object,
  groupProps,
  documentSize,
  spaceBackground,
  onPerspectiveQuadTranslate,
  isSelected = false,
}: PortableProductViewProps) {
  const showPerspective =
    object.placementMode === 'perspective' && object.perspectiveQuad && documentSize;

  // Compound body used by global perspective mode: warped screen content first (bottom),
  // device photo with transparent screen hole on top. Optional quad debug overlay renders
  // last so calibration dots/labels sit on top of everything else.
  const body = (
    <>
      <WarpedScreenContent
        view={object.templateView}
        width={object.width}
        height={object.height}
        content={object.content}
      />
      <PortableTemplateBody
        view={object.templateView}
        width={object.width}
        height={object.height}
        productPhotoSourceId={object.productPhotoSourceId}
      />
      {SHOW_QUAD_DEBUG && (
        <PortableQuadDebugOverlay
          view={object.templateView}
          width={object.width}
          height={object.height}
        />
      )}
    </>
  );

  return (
    <>
      {/* Contact shadow: switches to quad-anchored variant when in perspective placement mode. */}
      {showPerspective && object.perspectiveQuad && documentSize ? (
        <ContactShadowView
          perspective={{
            quad: object.perspectiveQuad,
            documentWidth: documentSize.width,
            documentHeight: documentSize.height,
          }}
          shadow={object.contactShadow}
        />
      ) : (
        <ContactShadowView
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          rotation={object.rotation}
          shadow={object.contactShadow}
        />
      )}

      {showPerspective && object.perspectiveQuad && documentSize ? (
        // Perspective placement: hit area is the warped quad at document level.
        <Group
          id={object.id}
          x={0}
          y={0}
          draggable
          onClick={groupProps.onClick as (() => void) | undefined}
          onTap={groupProps.onTap as (() => void) | undefined}
          onDragEnd={(event: Konva.KonvaEventObject<DragEvent>) => {
            const dx = event.target.x();
            const dy = event.target.y();
            event.target.position({ x: 0, y: 0 });
            (groupProps.onClick as (() => void) | undefined)?.();
            if ((dx !== 0 || dy !== 0) && onPerspectiveQuadTranslate) {
              onPerspectiveQuadTranslate(object.id, dx, dy);
            }
          }}
        >
          <Line
            points={quadDocumentPointsFlat(object.perspectiveQuad, documentSize)}
            closed
            fill="transparent"
            perfectDrawEnabled={false}
            name="portable-hit-area"
          />
          {isSelected && (
            <Line
              points={quadDocumentPointsFlat(object.perspectiveQuad, documentSize)}
              closed
              stroke={PERSPECTIVE_SELECTION_STROKE}
              strokeWidth={PERSPECTIVE_SELECTION_STROKE_WIDTH}
              dash={PERSPECTIVE_SELECTION_DASH}
              listening={false}
              perfectDrawEnabled={false}
              name="perspective-selection-outline"
            />
          )}
        </Group>
      ) : (
        // Rect placement: the Transformer attaches to this Group. The compound body layers
        // (warped content + device photo) render at object-local coordinates.
        <Group {...groupProps}>
          {/* Transparent full-bbox hit area — required for re-selection after deselect. */}
          <Rect
            x={0}
            y={0}
            width={object.width}
            height={object.height}
            fill="transparent"
            listening
            perfectDrawEnabled={false}
            name="portable-hit-area"
          />
          {body}
        </Group>
      )}

      {/* Global perspective warp: entire compound body captured off-canvas and warped into
          perspectiveQuad. The body renders the device photo + warped screen content at
          object-local coordinates; PerspectiveScreenView rasterizes and re-warps the whole. */}
      {showPerspective && object.perspectiveQuad && documentSize && (
        <PerspectiveScreenView
          width={object.width}
          height={object.height}
          quad={object.perspectiveQuad}
          documentSize={documentSize}
          redrawContinuously={object.content?.kind === 'video'}
        >
          {body}
        </PerspectiveScreenView>
      )}

      {documentSize && spaceBackground && object.occlusionMasks.length > 0 && (
        <OcclusionMaskLayer
          masks={object.occlusionMasks}
          documentSize={documentSize}
          spaceBackground={spaceBackground}
        />
      )}
    </>
  );
}
