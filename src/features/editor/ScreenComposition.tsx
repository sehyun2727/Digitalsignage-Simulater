import Konva from 'konva';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Group, Image as KonvaImage, Rect } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { computeContentLayout } from '../../lib/contentLayout';
import type { Rect as RectShape } from '../../lib/contentLayout';
import { glowLuminanceFactor, sampleMeanLuminance } from '../../lib/contentLuminance';
import { computeCurvatureStrips, isCurvatureSupported } from '../../lib/curvature';
import {
  contrastFilterValue,
  getBrightnessOverlay,
  getGlowShadow,
  getLcdSecondaryHighlight,
  getLedPatternCanvas,
  LCD_HIGHLIGHT_COLOR_STOPS,
  lcdSecondaryHighlightOpacity,
  materialPatternOpacity,
  normalizeMaterial,
  transparentBackingOpacity,
  transparentContentOpacity,
} from '../../lib/materialTexture';
import type {
  Curvature,
  DisplayMaterial,
  MaterialSettings,
  SignageContent,
} from '../../types/editor';
import { useUiStore } from '../../store/uiStore';
import { useVideoLuminance } from './useVideoLuminance';
import { useVideoPlaybackRedraw } from './useVideoPlaybackRedraw';

interface ScreenCompositionProps {
  /** Screen rect in the parent object's own local coordinate space. */
  screen: RectShape;
  material: DisplayMaterial;
  materialSettings: MaterialSettings;
  curvature: Curvature;
  content: SignageContent | null;
  /** The owning object's own id, used only to derive a stable per-object LCD highlight
   *  variant (see getLcdSecondaryHighlight) — never for security/identity purposes. */
  objectId: string;
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
function ContrastGroup({
  contrastValue,
  redrawContinuously,
  children,
}: {
  contrastValue: number;
  /** True while the composed content is a playing video, see the effect below. */
  redrawContinuously: boolean;
  children: ReactNode;
}) {
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

  // A cached Group draws a frozen bitmap (see Konva's Node.cache()), so a video element inside
  // it stops visibly playing the moment contrast is applied — the cache never observes the
  // video's later frames on its own. While contrast is active on video content, keep re-baking
  // the cache every animation frame (matching useVideoPlaybackRedraw's loop) so the filtered
  // result still plays instead of freezing on whichever frame happened to be cached first.
  useEffect(() => {
    if (!redrawContinuously || contrastValue === 0) return;
    const node = groupRef.current;
    const layer = node?.getLayer();
    if (!node || !layer) return;
    const animation = new Konva.Animation(() => {
      node.cache();
    }, layer);
    animation.start();
    return () => {
      animation.stop();
    };
  }, [redrawContinuously, contrastValue]);

  return <Group ref={groupRef}>{children}</Group>;
}

/**
 * The material glow (LED/OLED panel ambient light) as a soft-edged halo around the screen's own
 * rect, blurred via Konva.Filters.Blur with a padded cache rect the same way ContactShadowView
 * blurs its ground shadow. A shadow attached directly to the content image (the previous
 * approach) never escaped the `body` Group's clipFunc below, which is clipped to the exact
 * screen rect — canvas shadows are clipped like any other draw, so that glow was always fully
 * invisible. Rendered as a sibling *before* (behind) the curvature strips/body, unaffected by
 * their per-strip clipping, so the same halo works for both flat and curved screens.
 */
function ScreenGlowHalo({
  screen,
  glow,
}: {
  screen: RectShape;
  glow: { blur: number; opacity: number; color: string } | null;
}) {
  const groupRef = useRef<Konva.Group | null>(null);

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    if (!glow) {
      node.clearCache();
      node.filters([]);
    } else {
      const pad = glow.blur * 2;
      node.cache({
        x: screen.x - pad,
        y: screen.y - pad,
        width: screen.width + pad * 2,
        height: screen.height + pad * 2,
      });
      node.filters([Konva.Filters.Blur]);
      node.blurRadius(glow.blur);
    }
    node.getLayer()?.batchDraw();
  });

  if (!glow) return null;

  return (
    <Group ref={groupRef} listening={false}>
      <Rect
        x={screen.x}
        y={screen.y}
        width={screen.width}
        height={screen.height}
        fill={glow.color}
        opacity={glow.opacity}
        listening={false}
      />
    </Group>
  );
}

/**
 * Renders a display/portable object's screen: content image, per-material texture overlay,
 * brightness wash, and (for LED/Transparent LED) an optional strip-based curvature warp — the
 * single rendering recipe shared by SignageDisplayView and PortableProductView (see ADR 0007).
 * Curvature is applied by wrapping the *same* flat-composition children in N per-strip Konva
 * Groups with different `y`/`scaleY`/clip (see lib/curvature.ts), rather than any manual pixel
 * warping, so every material effect below curves along with the strips for free.
 */
export function ScreenComposition({
  screen,
  material,
  materialSettings,
  curvature,
  content,
  objectId,
}: ScreenCompositionProps) {
  const normalized = normalizeMaterial(material);
  const isTransparentLed = normalized === 'transparent-led';
  const isVideo = content?.kind === 'video';
  const asset = content ? getRegisteredAsset(content.sourceId) : undefined;
  const rootRef = useRef<Konva.Group | null>(null);
  // Comparison mode hides the objects group entirely, so keeping the video decoding + Konva
  // redraw loop running would burn CPU frames on invisible content — pause it while hidden.
  const comparisonMode = useUiStore((state) => state.comparisonMode);
  useVideoPlaybackRedraw(rootRef, content?.sourceId ?? null, isVideo, !comparisonMode);
  // A rotation of 90 swaps the content's effective width/height as seen by the screen: layout
  // is computed against the rotated shape so a portrait photo lands correctly rotated inside a
  // landscape screen instead of leaving unused left/right space. The Konva image itself is drawn
  // with an actual 90° rotation below (matching how the layout was computed).
  const contentRotation = content?.rotation ?? 0;
  const contentIsRotated = contentRotation === 90;
  const layoutSourceWidth = asset
    ? contentIsRotated
      ? asset.naturalHeight
      : asset.naturalWidth
    : 0;
  const layoutSourceHeight = asset
    ? contentIsRotated
      ? asset.naturalWidth
      : asset.naturalHeight
    : 0;
  const contentLayout =
    asset && content
      ? computeContentLayout(screen, layoutSourceWidth, layoutSourceHeight, content)
      : null;
  const screenSizePx = Math.min(screen.width, screen.height);
  const patternOpacity = materialPatternOpacity(
    normalized,
    materialSettings.intensity,
    screenSizePx,
  );
  const brightnessOverlay = getBrightnessOverlay(materialSettings.brightness);
  const imageLuminance = useMemo(() => {
    if (!asset || !content || content.kind !== 'image') return null;
    return sampleMeanLuminance(asset.image as HTMLImageElement | HTMLCanvasElement);
  }, [asset, content]);
  // LCD never glows regardless of luminance (see the `glow` computation below), and a glow
  // slider at 0 has nothing to scale, so sampling is skipped in both cases rather than paying a
  // throttled-but-still-nonzero readback cost for a value that would never be used.
  const videoLuminance = useVideoLuminance(
    isVideo ? content!.sourceId : null,
    isVideo && normalized !== 'lcd' && materialSettings.glow > 0,
  );
  const meanLuminance = isVideo ? videoLuminance : imageLuminance;
  const glow =
    normalized !== 'lcd'
      ? getGlowShadow(materialSettings.glow * glowLuminanceFactor(meanLuminance))
      : null;
  const contrastValue = contrastFilterValue(materialSettings.contrast);
  const secondaryHighlight = useMemo(
    () => getLcdSecondaryHighlight(objectId, screen.width, screen.height),
    [objectId, screen.width, screen.height],
  );
  const secondaryHighlightOpacity = lcdSecondaryHighlightOpacity(materialSettings.intensity);

  const effectiveCurvature = isCurvatureSupported(normalized)
    ? curvature
    : { mode: 'flat' as const, amount: 0 };
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
        // Konva shape rotation is around the shape's own (x, y) — so a shape at (X + H, Y) with
        // rotation=90 and internal size (W, H) draws its rotated bounding box from (X, Y) to
        // (X + H, Y + W). That is exactly the (layout.x, layout.y, layout.width, layout.height)
        // rect we want to fill: pass the pre-swap natural dimensions for the shape's own width/
        // height, then translate the (x, y) by the rotated bounding width so the rotated corners
        // land on the layout rect. For unrotated content this collapses to the previous inline.
        <KonvaImage
          image={asset.image}
          x={contentIsRotated ? contentLayout.x + contentLayout.width : contentLayout.x}
          y={contentLayout.y}
          width={contentIsRotated ? contentLayout.height : contentLayout.width}
          height={contentIsRotated ? contentLayout.width : contentLayout.height}
          rotation={contentRotation}
          opacity={isTransparentLed ? transparentContentOpacity(materialSettings.brightness) : 1}
          // 'lighten' takes the per-channel max of the content pixel and whatever is already
          // painted underneath (the backing rect above, and the space photo below that) — near-
          // black content stays transparent, bright content reads as illuminated (see
          // lib/materialTexture.ts transparentContentOpacity doc comment).
          globalCompositeOperation={isTransparentLed ? 'lighten' : 'source-over'}
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
          fillPatternImage={
            getLedPatternCanvas(materialSettings.gridDensity) as unknown as HTMLImageElement
          }
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
          // Konva resolves gradient points in the shape's own local drawing space (always
          // starting at (0,0) regardless of its x/y translate), not the parent-relative
          // coordinates screen.x/screen.y are expressed in — using screen.x/screen.y here would
          // double-count that offset and shift the highlight band away from the screen rect.
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: screen.width, y: screen.height }}
          fillLinearGradientColorStops={LCD_HIGHLIGHT_COLOR_STOPS}
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
          fillLinearGradientStartPoint={secondaryHighlight.startPoint}
          fillLinearGradientEndPoint={secondaryHighlight.endPoint}
          fillLinearGradientColorStops={secondaryHighlight.colorStops}
          opacity={secondaryHighlightOpacity}
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
    return (
      <Group ref={rootRef}>
        <ScreenGlowHalo screen={screen} glow={glow} />
        <ContrastGroup contrastValue={contrastValue} redrawContinuously={isVideo}>
          {body}
        </ContrastGroup>
      </Group>
    );
  }

  return (
    <Group ref={rootRef}>
      <ScreenGlowHalo screen={screen} glow={glow} />
      <ContrastGroup contrastValue={contrastValue} redrawContinuously={isVideo}>
        {strips.map((strip) => (
          <Group
            key={strip.index}
            y={strip.groupY}
            scaleY={strip.groupScaleY}
            clipFunc={(ctx) => ctx.rect(strip.clipX, screen.y, strip.clipWidth, screen.height)}
          >
            {body}
          </Group>
        ))}
      </ContrastGroup>
    </Group>
  );
}
