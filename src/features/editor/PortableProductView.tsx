import { Group, Image as KonvaImage, Rect } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { computeContentLayout, resolveScreenRegionRect } from '../../lib/contentLayout';
import {
  getBrightnessOverlay,
  getLedPatternCanvas,
  LCD_HIGHLIGHT_COLOR_STOPS,
  materialPatternOpacity,
} from '../../lib/materialTexture';
import type { PortableSignageObject } from '../../types/editor';

interface PortableProductViewProps {
  object: PortableSignageObject;
  // Shared select/drag/transform props built by CanvasObjectView, spread onto the outer
  // Group so a portable object participates in the same Transformer as every other kind.
  groupProps: Record<string, unknown>;
}

/**
 * Renders a user's own portable product photo as the object's background (instead of a
 * hand-authored frame, as SignageDisplayView draws for the built-in templates), clips the
 * marked screen region, and reuses the same content/material rendering recipe as a built-in
 * display. `object.screenRegion` is a fraction of the *photo's* own dimensions, but since the
 * object's bounding box is always kept at the photo's aspect ratio (see the transform
 * aspect-lock in CanvasObjectView.tsx), it can be resolved directly against the object size.
 */
export function PortableProductView({ object, groupProps }: PortableProductViewProps) {
  const productAsset = getRegisteredAsset(object.productSourceId);
  const screen = resolveScreenRegionRect(
    { width: object.width, height: object.height },
    { shape: 'rect', ...object.screenRegion },
  );
  const contentAsset = object.content ? getRegisteredAsset(object.content.sourceId) : undefined;
  const patternOpacity = materialPatternOpacity(object.material, object.materialSettings.intensity);
  const brightnessOverlay = getBrightnessOverlay(object.materialSettings.brightness);
  const contentLayout =
    contentAsset && object.content
      ? computeContentLayout(
          screen,
          contentAsset.naturalWidth,
          contentAsset.naturalHeight,
          object.content,
        )
      : null;

  return (
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
      <Group clipFunc={(ctx) => ctx.rect(screen.x, screen.y, screen.width, screen.height)}>
        <Rect
          x={screen.x}
          y={screen.y}
          width={screen.width}
          height={screen.height}
          fill="#05070a"
          listening={false}
        />
        {contentAsset && contentLayout && (
          <KonvaImage
            image={contentAsset.image}
            x={contentLayout.x}
            y={contentLayout.y}
            width={contentLayout.width}
            height={contentLayout.height}
            listening={false}
          />
        )}
        {object.material === 'outdoor-led' && (
          <Rect
            x={screen.x}
            y={screen.y}
            width={screen.width}
            height={screen.height}
            // Konva's runtime fillPatternImage accepts HTMLCanvasElement (Shape.js passes it
            // straight to ctx.createPattern), but its ShapeConfig type only declares
            // HTMLImageElement — a known type/runtime mismatch in the Konva package.
            fillPatternImage={getLedPatternCanvas() as unknown as HTMLImageElement}
            fillPatternRepeat="repeat"
            opacity={patternOpacity}
            listening={false}
          />
        )}
        {object.material === 'lcd' && (
          <Rect
            x={screen.x}
            y={screen.y}
            width={screen.width}
            height={screen.height}
            fillLinearGradientStartPoint={{ x: screen.x, y: screen.y }}
            fillLinearGradientEndPoint={{ x: screen.x + screen.width, y: screen.y + screen.height }}
            fillLinearGradientColorStops={LCD_HIGHLIGHT_COLOR_STOPS}
            opacity={patternOpacity}
            listening={false}
          />
        )}
        {brightnessOverlay && (
          <Rect
            x={screen.x}
            y={screen.y}
            width={screen.width}
            height={screen.height}
            fill={brightnessOverlay.fill}
            opacity={brightnessOverlay.opacity}
            listening={false}
          />
        )}
      </Group>
    </Group>
  );
}
