import { Group, Line, Rect } from 'react-konva';
import { computeCurvatureOutlinePoints, isCurvatureSupported } from '../../lib/curvature';
import { getFrameDecorations, getScreenRect } from '../../lib/displayFrame';
import { ENVIRONMENT_BLEND_COLOR, environmentBlendOpacity } from '../../lib/environmentIntegration';
import { normalizeMaterial } from '../../lib/materialTexture';
import type { DocumentSize } from '../../lib/quadGeometry';
import type { DisplaySignageObject, SpaceBackground } from '../../types/editor';
import { ContactShadowView } from './ContactShadowView';
import { OcclusionMaskLayer } from './OcclusionMaskLayer';
import { PerspectiveScreenView } from './PerspectiveScreenView';
import { ScreenComposition } from './ScreenComposition';

interface SignageDisplayViewProps {
  object: DisplaySignageObject;
  // Shared select/drag/transform props built by CanvasObjectView, spread onto the outer
  // Group so a display object participates in the same Transformer as every other kind.
  groupProps: Record<string, unknown>;
  documentSize: DocumentSize | null;
  spaceBackground: SpaceBackground | null;
}

const BEZEL_FILL = '#15181f';

export function SignageDisplayView({
  object,
  groupProps,
  documentSize,
  spaceBackground,
}: SignageDisplayViewProps) {
  const screen = getScreenRect(object.frameId, object.width, object.height);
  const decorations = getFrameDecorations(object.frameId, object.width, object.height);
  const curvatureActive =
    isCurvatureSupported(normalizeMaterial(object.material)) && object.curvature.mode !== 'flat';
  const curvedOutline = curvatureActive
    ? computeCurvatureOutlinePoints(screen, object.curvature)
    : null;
  const bezelThickness = Math.min(18, Math.max(4, Math.min(screen.width, screen.height) * 0.04));
  const blendOpacity = environmentBlendOpacity(object.environmentIntegration.strength);

  const body = (
    <>
      {curvedOutline ? (
        // Curvature is a 2D visual approximation (see ADR 0007): the flat rectangular bezel
        // would either clip the curved screen's bulge or leave an uneven flat-vs-curved gap, so
        // the bezel itself is redrawn as a stroked outline that hugs the screen's own curved
        // silhouette instead — a cheap way to make "frame treatment follows the curve" true
        // without warping the frame's own geometry.
        <Line
          points={curvedOutline}
          closed
          stroke={BEZEL_FILL}
          strokeWidth={bezelThickness}
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
      />
      {blendOpacity > 0 && (
        // Restricted to the screen region only (not the frame/bezel): blending the frame too
        // would desaturate/gray the physical-looking bezel along with the screen content, which
        // is the "muddy" failure mode baseline defect 5 calls out (spec section 6/16).
        <Rect
          x={screen.x}
          y={screen.y}
          width={screen.width}
          height={screen.height}
          fill={ENVIRONMENT_BLEND_COLOR}
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
      {/* The shadow's geometry is derived from the object's flat x/y/width/height/rotation rect
          (see ContactShadowView), which is meaningless once placementMode is 'perspective' — the
          visible body has moved to perspectiveQuad's own document-space corners instead (see the
          comment above). Rendering it anyway would draw a shadow disconnected from where the
          warped screen actually sits, so it is suppressed rather than shown in the wrong place. */}
      {!showPerspective && (
        <ContactShadowView
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          rotation={object.rotation}
          shadow={object.contactShadow}
        />
      )}
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
        {!showPerspective && body}
      </Group>
      {showPerspective && object.perspectiveQuad && documentSize && (
        <PerspectiveScreenView
          width={object.width}
          height={object.height}
          quad={object.perspectiveQuad}
          documentSize={documentSize}
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
