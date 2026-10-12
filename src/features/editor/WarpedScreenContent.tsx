import Konva from 'konva';
import { useMemo, useRef } from 'react';
import { Group, Line, Shape, Text as KonvaText } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import {
  PORTABLE_PRESET_SCREEN_QUADS,
  type PortableTemplateView,
} from '../../lib/portableTemplate';
import { buildQuadMesh, normalizedQuadToDocument } from '../../lib/quadGeometry';
import type { NormalizedQuad } from '../../types/editor';
import type { QuadMeshCell } from '../../lib/quadGeometry';
import { drawWarpedImageMesh } from '../../lib/warpMesh';
import type { SignageContent } from '../../types/editor';
import { useVideoPlaybackRedraw } from './useVideoPlaybackRedraw';

// v2-S5 K2 (a-2 perspectiveLogicalSize 공통화). Quad apparent aspect in object-local
// pixel coords, same formula as src/lib/perspectiveLogicalSize.ts's
// `perspectiveLogicalAspect`. Returns null for a degenerate quad.
function quadApparentAspect(q: {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}): number | null {
  const topEdge = Math.hypot(q.topRight.x - q.topLeft.x, q.topRight.y - q.topLeft.y);
  const bottomEdge = Math.hypot(q.bottomRight.x - q.bottomLeft.x, q.bottomRight.y - q.bottomLeft.y);
  const leftEdge = Math.hypot(q.bottomLeft.x - q.topLeft.x, q.bottomLeft.y - q.topLeft.y);
  const rightEdge = Math.hypot(q.bottomRight.x - q.topRight.x, q.bottomRight.y - q.topRight.y);
  const apparentW = (topEdge + bottomEdge) / 2;
  const apparentH = (leftEdge + rightEdge) / 2;
  if (apparentW <= 0 || apparentH <= 0) return null;
  return apparentW / apparentH;
}

/** v2-S5 K2. Produce an inset sub-quad whose apparent aspect matches `contentAspect`,
 *  letterboxing proportionally within the source quad. Linear interpolation along
 *  opposite edges — approximates perspective inset well for near-axis-aligned quads
 *  (front) and shears to the correct direction for the angled views. */
function computeContainSubQuad(
  quad: NormalizedQuad,
  objWidth: number,
  objHeight: number,
  contentAspect: number,
): NormalizedQuad {
  const localQuad = {
    topLeft: { x: quad.topLeft.x * objWidth, y: quad.topLeft.y * objHeight },
    topRight: { x: quad.topRight.x * objWidth, y: quad.topRight.y * objHeight },
    bottomRight: { x: quad.bottomRight.x * objWidth, y: quad.bottomRight.y * objHeight },
    bottomLeft: { x: quad.bottomLeft.x * objWidth, y: quad.bottomLeft.y * objHeight },
  };
  const quadAspect = quadApparentAspect(localQuad);
  if (quadAspect == null || contentAspect <= 0) return quad;
  if (Math.abs(contentAspect - quadAspect) < 1e-4) return quad;

  const lerp = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    t: number,
  ): { x: number; y: number } => ({ x: a.x * (1 - t) + b.x * t, y: a.y * (1 - t) + b.y * t });

  if (contentAspect > quadAspect) {
    // Content is wider than the quad → letterbox top/bottom. Shrink along vertical axis.
    const ratio = quadAspect / contentAspect;
    const inset = (1 - ratio) / 2;
    return {
      topLeft: lerp(quad.topLeft, quad.bottomLeft, inset),
      topRight: lerp(quad.topRight, quad.bottomRight, inset),
      bottomRight: lerp(quad.bottomRight, quad.topRight, inset),
      bottomLeft: lerp(quad.bottomLeft, quad.topLeft, inset),
    };
  }
  // Content is narrower than the quad → pillarbox left/right. Shrink along horizontal axis.
  const ratio = contentAspect / quadAspect;
  const inset = (1 - ratio) / 2;
  return {
    topLeft: lerp(quad.topLeft, quad.topRight, inset),
    topRight: lerp(quad.topRight, quad.topLeft, inset),
    bottomRight: lerp(quad.bottomRight, quad.bottomLeft, inset),
    bottomLeft: lerp(quad.bottomLeft, quad.bottomRight, inset),
  };
}

const MESH_SUBDIVISIONS = 8;

interface WarpedScreenContentProps {
  view: PortableTemplateView;
  width: number;
  height: number;
  content: SignageContent | null;
}

/**
 * Renders the user's screen content (image or video) perspective-warped into the device's
 * preset screen quad, confined entirely within the parent object's Group so it moves, scales,
 * and rotates with the device as a single compound unit.
 *
 * Layer order (bottom → top) within PortableProductView:
 *   1. WarpedScreenContent (this): dark backing polygon + perspective-warped content image
 *   2. PortableTemplateBody: device photo with a transparent hole punched at the screen area,
 *      so the warped content below shows through while the bezel/stand/wheels overlay it.
 *
 * The screen quad is the developer-hardcoded PORTABLE_PRESET_SCREEN_QUADS value for the current
 * view — not user-editable. Coordinates are in object-local pixel space (0..width × 0..height).
 */
export function WarpedScreenContent({ view, width, height, content }: WarpedScreenContentProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const mediaContent = content && content.kind !== 'text' ? content : null;
  const textContent = content?.kind === 'text' ? content : null;
  const isVideo = mediaContent?.kind === 'video';
  useVideoPlaybackRedraw(groupRef, mediaContent?.sourceId ?? null, isVideo, true);

  const asset = mediaContent ? getRegisteredAsset(mediaContent.sourceId) : undefined;

  // v2-S5 K2. The dark backing always fills the FULL preset quad. The content mesh covers
  // either (a) the full quad in cover mode or when aspects already match, or (b) an inset
  // sub-quad in contain mode so the content letterboxes within the quad. The outer region
  // of the quad shows the dark backing — matching the behavior of a real signage screen
  // showing letterboxed content.
  const presetQuadNorm = PORTABLE_PRESET_SCREEN_QUADS[view];
  const objectLocalQuad = useMemo(
    () => normalizedQuadToDocument(presetQuadNorm, { width, height }),
    [presetQuadNorm, width, height],
  );
  const contentQuadNorm = useMemo(() => {
    if (!asset || !mediaContent || mediaContent.fit !== 'contain') return presetQuadNorm;
    if (asset.naturalWidth <= 0 || asset.naturalHeight <= 0) return presetQuadNorm;
    const contentAspect = asset.naturalWidth / asset.naturalHeight;
    return computeContainSubQuad(presetQuadNorm, width, height, contentAspect);
  }, [asset, mediaContent, presetQuadNorm, width, height]);
  const contentQuadLocal = useMemo(
    () => normalizedQuadToDocument(contentQuadNorm, { width, height }),
    [contentQuadNorm, width, height],
  );

  const mesh: QuadMeshCell[] | null = useMemo(
    () => buildQuadMesh(contentQuadLocal, MESH_SUBDIVISIONS),
    [contentQuadLocal],
  );

  const quadPoints = [
    objectLocalQuad.topLeft.x,
    objectLocalQuad.topLeft.y,
    objectLocalQuad.topRight.x,
    objectLocalQuad.topRight.y,
    objectLocalQuad.bottomRight.x,
    objectLocalQuad.bottomRight.y,
    objectLocalQuad.bottomLeft.x,
    objectLocalQuad.bottomLeft.y,
  ];

  // Text content is drawn axis-aligned inside the quad's bounding box rather than mesh-warped —
  // Konva.Text doesn't support the sceneFunc mesh-warp path drawWarpedImageMesh uses. For most
  // portable template views (roughly rectangular quads) this reads as text on the screen; the
  // strong 3/4 angled view has some perspective slop for text but the trade-off is worth it vs.
  // authoring a full text-warp renderer for what will typically be short marketing copy.
  const textBoundingBox = textContent
    ? (() => {
        const xs = [
          objectLocalQuad.topLeft.x,
          objectLocalQuad.topRight.x,
          objectLocalQuad.bottomRight.x,
          objectLocalQuad.bottomLeft.x,
        ];
        const ys = [
          objectLocalQuad.topLeft.y,
          objectLocalQuad.topRight.y,
          objectLocalQuad.bottomRight.y,
          objectLocalQuad.bottomLeft.y,
        ];
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      })()
    : null;

  return (
    <Group ref={groupRef} listening={false}>
      {/* Dark backing fills the screen polygon so the device body photo's transparent
          screen-area hole shows a dark surface instead of the space photo beneath. */}
      <Line points={quadPoints} closed fill="#05070a" strokeWidth={0} listening={false} />
      {asset && mesh && (
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            drawWarpedImageMesh(
              ctx,
              mesh,
              asset.image as HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
              asset.naturalWidth,
              asset.naturalHeight,
            );
          }}
        />
      )}
      {textContent &&
        textBoundingBox &&
        (() => {
          const shortSide = Math.min(textBoundingBox.width, textBoundingBox.height);
          const fontSizePx = Math.max(6, textContent.fontSize * shortSide);
          return (
            <KonvaText
              x={textBoundingBox.x}
              y={textBoundingBox.y}
              width={textBoundingBox.width}
              height={textBoundingBox.height}
              text={textContent.text}
              fontSize={fontSizePx}
              fill={textContent.color}
              align={textContent.align}
              verticalAlign="middle"
              listening={false}
            />
          );
        })()}
    </Group>
  );
}
