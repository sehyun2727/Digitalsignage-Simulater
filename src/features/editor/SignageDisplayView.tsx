import { Group, Line, Rect } from 'react-konva';
import { computeCurvatureOutlinePoints, isCurvatureSupported } from '../../lib/curvature';
import { getFrameDecorations, getScreenRect } from '../../lib/displayFrame';
import { normalizeMaterial } from '../../lib/materialTexture';
import type { DisplaySignageObject } from '../../types/editor';
import { ScreenComposition } from './ScreenComposition';

interface SignageDisplayViewProps {
  object: DisplaySignageObject;
  // Shared select/drag/transform props built by CanvasObjectView, spread onto the outer
  // Group so a display object participates in the same Transformer as every other kind.
  groupProps: Record<string, unknown>;
}

const BEZEL_FILL = '#15181f';

export function SignageDisplayView({ object, groupProps }: SignageDisplayViewProps) {
  const screen = getScreenRect(object.frameId, object.width, object.height);
  const decorations = getFrameDecorations(object.frameId, object.width, object.height);
  const curvatureActive =
    isCurvatureSupported(normalizeMaterial(object.material)) && object.curvature.mode !== 'flat';
  const curvedOutline = curvatureActive
    ? computeCurvatureOutlinePoints(screen, object.curvature)
    : null;
  const bezelThickness = Math.max(4, Math.min(screen.width, screen.height) * 0.04);

  return (
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
    </Group>
  );
}
