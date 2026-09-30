import { Image as KonvaImage } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { clampSpaceBackgroundOffsetY, computeCoverFit } from '../../lib/spaceBackgroundFit';
import type { SpaceBackground } from '../../types/editor';

interface SpaceBackgroundViewProps {
  spaceBackground: SpaceBackground;
  width: number;
  height: number;
}

/** Renders the space/site photo scaled to cover the full canvas, behind all signage objects.
 *  When the cover-fit overflows the canvas height, the stored `offsetY` pans the visible slice —
 *  clamped at render time too so a stale/wider stored offset can't push the photo edge into the
 *  canvas as a gap. */
export function SpaceBackgroundView({ spaceBackground, width, height }: SpaceBackgroundViewProps) {
  const asset = getRegisteredAsset(spaceBackground.sourceId);
  if (!asset) return null;

  const fit = computeCoverFit(asset.naturalWidth, asset.naturalHeight, width, height);
  const offsetY = clampSpaceBackgroundOffsetY(height, fit.height, spaceBackground.offsetY);

  return (
    <KonvaImage
      image={asset.image}
      x={fit.x}
      y={fit.y + offsetY}
      width={fit.width}
      height={fit.height}
      listening={false}
    />
  );
}
