import Konva from 'konva';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Group, Image as KonvaImage, Rect } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { computeContentLayout } from '../../lib/contentLayout';
import type { Rect as RectShape } from '../../lib/contentLayout';
import { computeCurvatureStrips, isCurvatureSupported } from '../../lib/curvature';
import {
  contrastFilterValue,
  getBrightnessOverlay,
  getGlowShadow,
  getLedPatternCanvas,
  LCD_HIGHLIGHT_COLOR_STOPS,
  materialPatternOpacity,
  normalizeMaterial,
  transparentBackingOpacity,
  transparentContentOpacity,
} from '../../lib/materialTexture';
import type { Curvature, DisplayMaterial, MaterialSettings, SignageContent } from '../../types/editor';

interface ScreenCompositionProps {
  /** Screen rect in the parent object's own local coordinate space. */
  screen: RectShape;
  material: DisplayMaterial;
  materialSettings: MaterialSettings;
  curvature: Curvature;
  content: SignageContent | null;
}

/**
 * Wraps `children` in a Group whose bitmap is re-cached and passed through
 * `Konva.Filters.Contrast` whenever the resolved contrast value or the composed content
 * changes. Filter application requires a rasterized (`.cache()`) node — caching once per
 * settings/content commit (not per animation frame) keeps this within the "no per-pixel
 * per-frame work" performance guidance while still producing a real contrast adjustment
 * rather than another opacity-overlay approximation. At the neutral value (50, contrastValue
 * 0) the cache is cleared instead, so the common case pays no rasterization cost at all.
 */
function ContrastGroup({ contrastValue, children }: { contrastValue: number; children: ReactNode }) {
  const groupRef = useRef<Konva.Group | null>(null);

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    if (contrastValue === 0) {
      node.clearCache();
      node.filters([]);
    } else {
      node.cache();
      node.filters([Konva.Filters.Contrast]);
      node.contrast(contrastValue);
    }
    node.getLayer()?.batchDraw();
  });

  return <Group ref={groupRef}>{children}</Group>;
}

/**
 * Renders a display/portable object's screen: content image, per-material texture overlay,
 * brightness wash, and (for LED/Transparent LED) an optional strip-based curvature warp — the
 * single rendering recipe shared by SignageDisplayView and PortableProductView (see ADR 0007).
 * Curvature is applied by wrapping the *same* flat-composition children in N per-strip Konva
 * Groups with different `y`/`scaleY`/clip (see lib/curvature.ts), rather than any manual pixel
 * warping, so every material effect below curves along with the strips for free.
 */
export function ScreenComposition({ screen, material, materialSettings, curvature, content }: ScreenCompositionProps) {
  const normalized = normalizeMaterial(material);
  const isTransparentLed = normalized === 'transparent-led';
  const asset = content ? getRegisteredAsset(content.sourceId) : undefined;
  const contentLayout =
    asset && content ? computeContentLayout(screen, asset.naturalWidth, asset.naturalHeight, content) : null;
  const patternOpacity = materialPatternOpacity(normalized, materialSettings.intensity);
  const brightnessOverlay = getBrightnessOverlay(materialSettings.brightness);
  const glow = normalized !== 'lcd' ? getGlowShadow(materialSettings.glow) : null;
  const contrastValue = contrastFilterValue(materialSettings.contrast);

  const effectiveCurvature = isCurvatureSupported(normalized) ? curvature : { mode: 'flat' as const, amount: 0 };
  const strips = computeCurvatureStrips(screen, effectiveCurvature);

  const body = (
    <Group clipFunc={(ctx) => ctx.rect(screen.x, screen.y, screen.width, screen.height)}>
      <Rect
        x={screen.x}
        y={screen.y}
        width={screen.width}
        height={screen.height}
        fill="#05070a"
        // Transparent LED's "background shows through dark areas" effect (see ADR 0007) comes
        // from this backing rect being only partially opaque: everything already painted below
        // in the same Layer (the space photo, drawn earlier) shows through by ordinary alpha
        // compositing, with no manual pixel sampling required.
        opacity={isTransparentLed ? transparentBackingOpacity(materialSettings.transparency) : 1}
        listening={false}
      />
      {asset && contentLayout && (
        <KonvaImage
          image={asset.image}
          x={contentLayout.x}
          y={contentLayout.y}
          width={contentLayout.width}
          height={contentLayout.height}
          opacity={isTransparentLed ? transparentContentOpacity(materialSettings.brightness) : 1}
          // 'lighten' takes the per-channel max of the content pixel and whatever is already
          // painted underneath (the backing rect above, and the space photo below that) — near-
          // black content stays transparent, bright content reads as illuminated (see
          // lib/materialTexture.ts transparentContentOpacity doc comment).
          globalCompositeOperation={isTransparentLed ? 'lighten' : 'source-over'}
          shadowColor={glow?.color}
          shadowBlur={glow?.blur}
          shadowOpacity={glow?.opacity}
          listening={false}
        />
      )}
      {(normalized === 'led' || isTransparentLed) && (
        <Rect
          x={screen.x}
          y={screen.y}
          width={screen.width}
          height={screen.height}
          // Konva's runtime fillPatternImage accepts HTMLCanvasElement (Shape.js passes it
          // straight to ctx.createPattern), but its ShapeConfig type only declares
          // HTMLImageElement — a known type/runtime mismatch in the Konva package.
          fillPatternImage={getLedPatternCanvas(materialSettings.gridDensity) as unknown as HTMLImageElement}
          fillPatternRepeat="repeat"
          opacity={patternOpacity}
          listening={false}
        />
      )}
      {normalized === 'lcd' && (
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
      {brightnessOverlay && !isTransparentLed && (
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
  );

  if (strips.length === 0) {
    return <ContrastGroup contrastValue={contrastValue}>{body}</ContrastGroup>;
  }

  return (
    <ContrastGroup contrastValue={contrastValue}>
      {strips.map((strip) => (
        <Group
          key={strip.index}
          y={strip.groupY}
          scaleY={strip.groupScaleY}
          clipFunc={(ctx) => ctx.rect(strip.x, screen.y, strip.width, screen.height)}
        >
          {body}
        </Group>
      ))}
    </ContrastGroup>
  );
}
