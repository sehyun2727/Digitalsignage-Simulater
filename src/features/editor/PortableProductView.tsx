import { Group, Image as KonvaImage, Rect } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { resolveScreenRegionRect } from '../../lib/contentLayout';
import type { DocumentSize } from '../../lib/quadGeometry';
import type { PortableSignageObject } from '../../types/editor';
import { PerspectiveScreenView } from './PerspectiveScreenView';
import { ScreenComposition } from './ScreenComposition';

interface PortableProductViewProps {
  object: PortableSignageObject;
  // Shared select/drag/transform props built by CanvasObjectView, spread onto the outer
  // Group so a portable object participates in the same Transformer as every other kind.
  groupProps: Record<string, unknown>;
  documentSize: DocumentSize | null;
}

/**
 * Renders a user's own portable product photo as the object's background (instead of a
 * hand-authored frame, as SignageDisplayView draws for the built-in templates), and reuses
 * ScreenComposition for the marked screen region's content/material/curvature rendering.
 * `object.screenRegion` is a fraction of the *photo's* own dimensions, but since the object's
 * bounding box is always kept at the photo's aspect ratio (see the transform aspect-lock in
 * CanvasObjectView.tsx), it can be resolved directly against the object size.
 */
export function PortableProductView({ object, groupProps, documentSize }: PortableProductViewProps) {
  const productAsset = getRegisteredAsset(object.productSourceId);
  const screen = resolveScreenRegionRect(
    { width: object.width, height: object.height },
    { shape: 'rect', ...object.screenRegion },
  );

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
      />
    </>
  );

  // See SignageDisplayView.tsx: perspectiveQuad is absolute document-space and decoupled from
  // this object's own x/y/rotation, so the warped photo+screen renders as a sibling of the
  // interactive Group rather than inside it.
  const showPerspective = object.placementMode === 'perspective' && object.perspectiveQuad && documentSize;

  return (
    <>
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
    </>
  );
}
