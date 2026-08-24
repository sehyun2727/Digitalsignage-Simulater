import type Konva from 'konva';
import { Group, Line, Rect } from 'react-konva';
import { computeCurvatureOutlinePoints, isCurvatureSupported } from '../../lib/curvature';
import { bezelFillForMaterial, getFrameDecorations, getScreenRect } from '../../lib/displayFrame';
import { ENVIRONMENT_BLEND_COLOR, environmentBlendOpacity } from '../../lib/environmentIntegration';
import { normalizeMaterial } from '../../lib/materialTexture';
import { normalizedQuadToDocument, type DocumentSize } from '../../lib/quadGeometry';
import type { DisplaySignageObject, SpaceBackground } from '../../types/editor';
import { ContactShadowView } from './ContactShadowView';
import { OcclusionMaskLayer } from './OcclusionMaskLayer';
import { PerspectiveScreenView } from './PerspectiveScreenView';
import { ScreenComposition } from './ScreenComposition';
import { ScreenReflection } from './ScreenReflection';

interface SignageDisplayViewProps {
  object: DisplaySignageObject;
  // Shared select/drag/transform props built by CanvasObjectView, spread onto the outer
  // Group so a display object participates in the same Transformer as every other kind.
  groupProps: Record<string, unknown>;
  documentSize: DocumentSize | null;
  spaceBackground: SpaceBackground | null;
  /** Perspective-mode drag handler injected by CanvasObjectView (which reads the store action);
   *  passed as a prop rather than pulled from `useEditorStore` here so this file stays a pure
   *  render function usable in `canvasHitArea.test.tsx`-style plain-function tests that don't
   *  set up a React runtime for hooks. Optional so callers that never enter perspective mode
   *  (tests using only rect-mode objects) don't have to supply it. */
  onPerspectiveQuadTranslate?: (id: string, deltaDocumentX: number, deltaDocumentY: number) => void;
  /** True when this object is currently selected. Only used in perspective mode, where the
   *  shared Transformer can't attach a selection frame to the quad hit target — the hit-area
   *  Line strokes itself in the selection color while selected so the user still gets clear
   *  visual feedback that follows the actual warped quad shape. */
  isSelected?: boolean;
}

const PERSPECTIVE_SELECTION_STROKE = '#2563eb';
const PERSPECTIVE_SELECTION_STROKE_WIDTH = 2;
const PERSPECTIVE_SELECTION_DASH: number[] = [8, 4];

/** Flattens a normalized (0-1) quad into an alternating x,y coordinate array in absolute
 *  document pixels, as Konva.Line's `points` prop expects for its closed hit polygon. */
function quadDocumentPointsFlat(
  quad: import('../../types/editor').NormalizedQuad,
  documentSize: DocumentSize,
): number[] {
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

export function SignageDisplayView({
  object,
  groupProps,
  documentSize,
  spaceBackground,
  onPerspectiveQuadTranslate,
  isSelected = false,
}: SignageDisplayViewProps) {
  const normalized = normalizeMaterial(object.material);
  const isTransparentLed = normalized === 'transparent-led';
  // A see-through panel has no opaque bezel — the transparent screen fills the entire object
  // rect. Locking the "screen" to the whole object here (instead of the frame template's inset
  // screen region) is what makes the visible frame stroke, the composed screen content, the
  // selection Transformer box, and the drop-target hit rect all line up. Any inset would leave
  // a visible gap between the frame edge and the selection box, which is the "네모 크기가 다름"
  // bug the see-through fix introduced.
  const screen = isTransparentLed
    ? { x: 0, y: 0, width: object.width, height: object.height }
    : getScreenRect(object.frameId, object.width, object.height);
  const decorations = getFrameDecorations(
    object.frameId,
    object.width,
    object.height,
    object.material,
  );
  const curvatureActive = isCurvatureSupported(normalized) && object.curvature.mode !== 'flat';
  const curvedScreenOutline = curvatureActive
    ? computeCurvatureOutlinePoints(screen, object.curvature)
    : null;
  // A separate outline for the whole signage body (bezel silhouette): the previous curvature
  // build only redrew the *screen* outline as a thin stroke and dropped the full-body bezel
  // decoration entirely, which visually made the "signage frame" disappear the moment curvature
  // was turned on — the user saw content stretch but no curved TV silhouette around it. Filling
  // this outline with the bezel color reinstates the frame body and matches its silhouette to
  // the screen's curve so the whole display reads as one curved object.
  //
  // Skipped entirely for a see-through / transparent-LED panel: filling a body silhouette
  // behind the screen would block the space photo the whole point of "see-through" is to reveal.
  // The frame silhouette for those is a thin stroke around the screen only (drawn further down).
  const curvedBodyOutline =
    curvatureActive && !isTransparentLed
      ? computeCurvatureOutlinePoints(
          { x: 0, y: 0, width: object.width, height: object.height },
          object.curvature,
        )
      : null;
  const bezelThickness = Math.min(18, Math.max(4, Math.min(screen.width, screen.height) * 0.04));
  // Transparent-LED frames read as a thin metal edge, not a chunky plastic/metal bezel, so
  // the see-through screen border stays subtle and doesn't visually crop into the screen area.
  const seeThroughFrameThickness = Math.max(1, bezelThickness / 3);
  const blendOpacity = environmentBlendOpacity(object.environmentIntegration.strength);

  const body = (
    <>
      {curvedBodyOutline ? (
        // Filled body silhouette that follows the curve (replaces the flat full-body bezel Rect
        // getFrameDecorations returns for wall-led). Drawn BEFORE the ScreenComposition so its
        // pixels sit behind the screen content, matching the "bezel around a screen" layer order
        // the flat mode already uses.
        <Line
          points={curvedBodyOutline}
          closed
          fill={bezelFillForMaterial(object.material)}
          listening={false}
        />
      ) : (
        decorations.map((rect, index) => (
          <Rect
            key={index}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={rect.fill}
            listening={false}
          />
        ))
      )}
      <ScreenComposition
        screen={screen}
        material={object.material}
        materialSettings={object.materialSettings}
        curvature={object.curvature}
        content={object.content}
        objectId={object.id}
      />
      {curvedScreenOutline && !isTransparentLed && (
        // Thin stroke around the *screen* curve, drawn on top of the composed screen and beneath
        // any reflection/blend layers so the boundary between the (bezel-colored) body and the
        // (content-carrying) screen stays readable at any curvature amount, matching how a real
        // curved display has a visible frame lip.
        <Line
          points={curvedScreenOutline}
          closed
          stroke={bezelFillForMaterial(object.material)}
          strokeWidth={Math.max(2, bezelThickness / 3)}
          listening={false}
        />
      )}
      {isTransparentLed && (
        // See-through panel edge: a thin metallic ring around just the screen rect — enough to
        // read as a physical frame silhouette without adding any filled area behind the screen
        // that would block the space photo from showing through the transparent backing.
        <Rect
          x={screen.x}
          y={screen.y}
          width={screen.width}
          height={screen.height}
          stroke={bezelFillForMaterial(object.material)}
          strokeWidth={seeThroughFrameThickness}
          listening={false}
        />
      )}
      <ScreenReflection
        screen={screen}
        material={object.material}
        materialSettings={object.materialSettings}
        curvature={object.curvature}
        content={object.content}
        installationMode={object.installationMode}
        objectId={object.id}
      />
      {blendOpacity > 0 && !isTransparentLed && (
        // Restricted to the screen region only (not the frame/bezel): blending the frame too
        // would desaturate/gray the physical-looking bezel along with the screen content, which
        // is the "muddy" failure mode baseline defect 5 calls out (spec section 6/16).
        // Also skipped for transparent-LED: the space photo already shows through the semi-
        // transparent backing, so adding a second wash overlay would only re-veil the very
        // background the see-through material was meant to reveal.
        <Rect
          x={screen.x}
          y={screen.y}
          width={screen.width}
          height={screen.height}
          fill={object.environmentIntegration.sampledColor ?? ENVIRONMENT_BLEND_COLOR}
          opacity={blendOpacity}
          listening={false}
        />
      )}
    </>
  );

  // 'perspective' warps the whole bezel+screen composition into perspectiveQuad's absolute
  // document-space corners (ADR 0008), decoupled from this object's own x/y/rotation — so it
  // renders as a sibling of the interactive Group below rather than inside it (see
  // PerspectiveScreenView.tsx), and the Group here keeps only its hit-area for
  // select/drag/transform, not the (now warped elsewhere) visual content.
  const showPerspective =
    object.placementMode === 'perspective' && object.perspectiveQuad && documentSize;

  return (
    <>
      {/* Once placementMode is 'perspective', the object's flat x/y/width/height/rotation rect no
          longer describes where the visible body sits (it warped to perspectiveQuad's own
          document-space corners — see the comment below), so the shadow switches to the
          quad-anchored perspective variant instead of the rect one (spec section 11). */}
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
        // Perspective mode's visible body is warped to `perspectiveQuad`'s absolute document
        // corners (see PerspectiveScreenView below), so the rect-based hit area that lives inside
        // this object's own rotated Group no longer overlaps with what the user sees on screen.
        // Instead, render an interactive Group at the document origin whose only child is a
        // closed Line tracing the four quad corners in document space — that Line is where clicks
        // are received and drags are captured, matching the visible warped shape exactly. The
        // drag translates the whole quad (via `translatePerspectiveQuad`) rather than moving an
        // x/y offset that would no longer make sense in this mode; Group is reset back to (0,0)
        // after every drag so the next drag also measures a fresh (0,0)-relative delta.
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
            name="display-hit-area"
          />
          {isSelected && (
            // Rendered as a separate sibling (not by stroking the hit-area Line above) so the
            // export path can hide every `perspective-selection-outline` node in one query
            // without also affecting hit testing. listening={false} keeps drag/click going to
            // the hit-area sibling.
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
        <Group {...groupProps}>
          {/* Every other descendant below is listening={false} (decoration, clip contents,
              material overlays); Konva only bubbles click/tap/drag hits up to this Group from a
              listening descendant, so without this rect nothing inside a display is reselectable
              after being deselected. `fill="transparent"` (not an omitted fill) is required:
              Konva's default hit function skips painting the hit canvas entirely for a shape with
              no fill, so an undefined fill is invisible AND unclickable, whereas a defined
              zero-alpha fill is invisible but still hit-tested as this rect's full bounding box —
              the rectangular, non-alpha-aware hit-area policy this sprint uses for opaque and
              transparent product photos alike. It paints nothing, so it never appears in
              exported PNGs. */}
          <Rect
            x={0}
            y={0}
            width={object.width}
            height={object.height}
            fill="transparent"
            listening
            perfectDrawEnabled={false}
            name="display-hit-area"
          />
          {body}
        </Group>
      )}
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
