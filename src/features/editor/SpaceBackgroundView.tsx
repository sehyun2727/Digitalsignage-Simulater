import { Image as KonvaImage } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
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

  const scale = Math.max(width / asset.naturalWidth, height / asset.naturalHeight);
  const drawWidth = asset.naturalWidth * scale;
  const drawHeight = asset.naturalHeight * scale;

  return (
    <KonvaImage
      image={asset.image}
      x={(width - drawWidth) / 2}
      y={(height - drawHeight) / 2}
      width={drawWidth}
      height={drawHeight}
      listening={false}
    />
  );
}
