import { Group, Image as KonvaImage, Rect } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { computeContentLayout } from '../../lib/contentLayout';
import { getFrameDecorations, getScreenRect } from '../../lib/displayFrame';
import {
  getBrightnessOverlay,
  getLedPatternCanvas,
  LCD_HIGHLIGHT_COLOR_STOPS,
  materialPatternOpacity,
} from '../../lib/materialTexture';
import type { DisplaySignageObject } from '../../types/editor';

interface SignageDisplayViewProps {
  object: DisplaySignageObject;
  // Shared select/drag/transform props built by CanvasObjectView, spread onto the outer
  // Group so a display object participates in the same Transformer as every other kind.
  groupProps: Record<string, unknown>;
}

export function SignageDisplayView({ object, groupProps }: SignageDisplayViewProps) {
  const screen = getScreenRect(object.frameId, object.width, object.height);
  const decorations = getFrameDecorations(object.frameId, object.width, object.height);
  const asset = object.content ? getRegisteredAsset(object.content.sourceId) : undefined;
  const patternOpacity = materialPatternOpacity(object.material, object.materialSettings.intensity);
  const brightnessOverlay = getBrightnessOverlay(object.materialSettings.brightness);
  const contentLayout =
    asset && object.content ? computeContentLayout(screen, asset.naturalWidth, asset.naturalHeight, object.content) : null;

  return (
    <Group {...groupProps}>
      {decorations.map((rect, index) => (
        <Rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.fill} listening={false} />
      ))}
      <Group clipFunc={(ctx) => ctx.rect(screen.x, screen.y, screen.width, screen.height)}>
        <Rect x={screen.x} y={screen.y} width={screen.width} height={screen.height} fill="#05070a" listening={false} />
        {asset && contentLayout && (
          <KonvaImage
            image={asset.image}
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
