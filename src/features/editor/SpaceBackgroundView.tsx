import { Image as KonvaImage } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import {
  clampSpaceBackgroundOffsetY,
  computeContainFit,
  computeCoverFit,
} from '../../lib/spaceBackgroundFit';
import type { SpaceBackground } from '../../types/editor';

interface SpaceBackgroundViewProps {
  spaceBackground: SpaceBackground;
  width: number;
  height: number;
}

/**
 * Renders the space/site photo behind all signage objects. v2-S4-b 1-3 added a `fit` mode:
 * - `contain` (default for new photos): the whole photo fits inside the canvas, letterboxed on
 *   whichever axis has leftover room. offsetY is forced to 0 and ignored.
 * - `cover` (legacy and still available): the photo covers the canvas, cropping overflow; the
 *   stored `offsetY` pans the visible slice, re-clamped at render time so a stale/wider offset
 *   can't push the photo edge inside the canvas as a gap.
 */
export function SpaceBackgroundView({ spaceBackground, width, height }: SpaceBackgroundViewProps) {
  const asset = getRegisteredAsset(spaceBackground.sourceId);
  if (!asset) return null;

  const fit = spaceBackground.fit ?? 'cover';
  if (fit === 'contain') {
    const rect = computeContainFit(asset.naturalWidth, asset.naturalHeight, width, height);
    return (
      <KonvaImage
        image={asset.image}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        listening={false}
      />
    );
  }

  const cover = computeCoverFit(asset.naturalWidth, asset.naturalHeight, width, height);
  const offsetY = clampSpaceBackgroundOffsetY(height, cover.height, spaceBackground.offsetY);
  return (
    <KonvaImage
      image={asset.image}
      x={cover.x}
      y={cover.y + offsetY}
      width={cover.width}
      height={cover.height}
      listening={false}
    />
  );
}
