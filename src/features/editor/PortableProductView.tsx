import type Konva from 'konva';
import { Group, Image as KonvaImage, Line, Rect } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { resolveScreenRegionRect } from '../../lib/contentLayout';
import { ENVIRONMENT_BLEND_COLOR, environmentBlendOpacity } from '../../lib/environmentIntegration';
import { normalizedQuadToDocument, type DocumentSize } from '../../lib/quadGeometry';
import type { NormalizedQuad, PortableSignageObject, SpaceBackground } from '../../types/editor';
import { ContactShadowView } from './ContactShadowView';
import { OcclusionMaskLayer } from './OcclusionMaskLayer';
import { PerspectiveScreenView } from './PerspectiveScreenView';
import { ScreenComposition } from './ScreenComposition';
import { ScreenReflection } from './ScreenReflection';

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
}

/** See SignageDisplayView.tsx for the same helper — flattens the four quad corners into an
 *  alternating x,y coordinate list in absolute document pixels for Konva.Line's points prop. */
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
 * Renders a user's own portable product photo as the object's background (instead of a
 * hand-authored frame, as SignageDisplayView draws for the built-in templates), and reuses
 * ScreenComposition for the marked screen region's content/material/curvature rendering.
 * `object.screenRegion` is a fraction of the *photo's* own dimensions, but since the object's
 * bounding box is always kept at the photo's aspect ratio (see the transform aspect-lock in
 * CanvasObjectView.tsx), it can be resolved directly against the object size.
 */
export function PortableProductView({
  object,
  groupProps,
  documentSize,
  spaceBackground,
  onPerspectiveQuadTranslate,
}: PortableProductViewProps) {
  const productAsset = getRegisteredAsset(object.productSourceId);
  const screen = resolveScreenRegionRect(
    { width: object.width, height: object.height },
    { shape: 'rect', ...object.screenRegion },
  );

  const blendOpacity = environmentBlendOpacity(object.environmentIntegration.strength);

  const body = (
    <>
      {productAsset && (
        <KonvaImage
          image={productAsset.image}
          x={0}
          y={0}
          width={object.width}
          height={object.height}
          listening={false}
        />
      )}
      <ScreenComposition
        screen={screen}
        material={object.material}
        materialSettings={object.materialSettings}
        curvature={object.curvature}
        content={object.content}
        objectId={object.id}
      />
      <ScreenReflection
        screen={screen}
        material={object.material}
        materialSettings={object.materialSettings}
        curvature={object.curvature}
        content={object.content}
        installationMode={object.installationMode}
        objectId={object.id}
      />
      {blendOpacity > 0 && (
        // Restricted to the screen region only (not the whole product photo): see
        // SignageDisplayView.tsx for why the frame/product body must stay out of the blend.
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

  // See SignageDisplayView.tsx: perspectiveQuad is absolute document-space and decoupled from
  // this object's own x/y/rotation, so the warped photo+screen renders as a sibling of the
  // interactive Group rather than inside it.
  const showPerspective =
    object.placementMode === 'perspective' && object.perspectiveQuad && documentSize;

  return (
    <>
      {/* See SignageDisplayView.tsx: once placementMode is 'perspective', the object's flat
          x/y/width/height/rotation rect no longer describes the warped body's actual on-screen
          position, so the shadow switches to the quad-anchored perspective variant. */}
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
        // See SignageDisplayView.tsx for the equivalent perspective-mode hit-area treatment:
        // the visible body lives inside PerspectiveScreenView (warped to absolute quad corners),
        // so the interactive Group here has to sit at the document origin and use a Line that
        // traces the quad rather than a Rect at the object's original x/y — otherwise clicking
        // the visibly warped product would land on a hit region that has drifted off screen.
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
        </Group>
      ) : (
        <Group {...groupProps}>
          {/* Every other descendant below is listening={false} (product photo, clip contents,
              material overlays); Konva only bubbles click/tap/drag hits up to this Group from a
              listening descendant, so without this rect a portable object isn't reselectable
              after being deselected. `fill="transparent"` (not an omitted fill) is required:
              Konva's default hit function skips painting the hit canvas entirely for a shape with
              no fill, so an undefined fill is invisible AND unclickable, whereas a defined
              zero-alpha fill is invisible but still hit-tested as this rect's full bounding box.
              This is also this sprint's documented transparent-photo hit policy: the hit target is
              always the object's full rectangular bounds, never the product photo's actual alpha
              channel — per CLAUDE.md/ADR 0004, alpha-aware hit testing is out of scope. It paints
              nothing, so it never appears in exported PNGs. */}
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
