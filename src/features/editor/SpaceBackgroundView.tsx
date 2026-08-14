import { Image as KonvaImage } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { computeCoverFit } from '../../lib/spaceBackgroundFit';
import type { SpaceBackground } from '../../types/editor';

interface SpaceBackgroundViewProps {
  spaceBackground: SpaceBackground;
  width: number;
  height: number;
}

/** Renders the space/site photo scaled to cover the full canvas, behind all signage objects. */
export function SpaceBackgroundView({ spaceBackground, width, height }: SpaceBackgroundViewProps) {
  const asset = getRegisteredAsset(spaceBackground.sourceId);
  if (!asset) return null;

  const fit = computeCoverFit(asset.naturalWidth, asset.naturalHeight, width, height);

  return (
    <KonvaImage
      image={asset.image}
      x={fit.x}
      y={fit.y}
      width={fit.width}
      height={fit.height}
      listening={false}
    />
  );
}
