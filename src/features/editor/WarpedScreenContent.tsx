import Konva from 'konva';
import { useMemo, useRef } from 'react';
import { Group, Line, Shape } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { PORTABLE_PRESET_SCREEN_QUADS, type PortableTemplateView } from '../../lib/portableTemplate';
import { buildQuadMesh, normalizedQuadToDocument } from '../../lib/quadGeometry';
import type { QuadMeshCell } from '../../lib/quadGeometry';
import { drawWarpedImageMesh } from '../../lib/warpMesh';
import type { SignageContent } from '../../types/editor';
import { useVideoPlaybackRedraw } from './useVideoPlaybackRedraw';

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
  const isVideo = content?.kind === 'video';
  useVideoPlaybackRedraw(groupRef, content?.sourceId ?? null, isVideo, true);

  const asset = content ? getRegisteredAsset(content.sourceId) : undefined;

  const objectLocalQuad = useMemo(
    () => normalizedQuadToDocument(PORTABLE_PRESET_SCREEN_QUADS[view], { width, height }),
    [view, width, height],
  );

  const mesh: QuadMeshCell[] | null = useMemo(
    () => buildQuadMesh(objectLocalQuad, MESH_SUBDIVISIONS),
    [objectLocalQuad],
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
    </Group>
  );
}
