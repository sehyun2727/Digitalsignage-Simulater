import Konva from 'konva';
import { useEffect, useRef } from 'react';
import { Group, Image as KonvaImage } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { resolveOcclusionFeatherRadius } from '../../lib/occlusion';
import type { DocumentSize } from '../../lib/quadGeometry';
import { computeCoverFit } from '../../lib/spaceBackgroundFit';
import type { OcclusionMask, SpaceBackground } from '../../types/editor';

interface OcclusionMaskLayerProps {
  masks: OcclusionMask[];
  documentSize: DocumentSize;
  spaceBackground: SpaceBackground;
}

/**
 * Renders every enabled foreground occlusion mask belonging to one object, restoring the
 * original space-photo pixels over whatever was just drawn for that object's body (sprint spec
 * section 7). Rendered as a document-absolute sibling (not nested inside the object's own
 * rotated/transformed Group) since mask points are normalized to the *whole document*, exactly
 * like `perspectiveQuad` — see PerspectiveScreenView.tsx for the same rationale.
 */
export function OcclusionMaskLayer({
  masks,
  documentSize,
  spaceBackground,
}: OcclusionMaskLayerProps) {
  const enabled = masks.filter((mask) => mask.enabled && mask.points.length >= 3);
  if (enabled.length === 0) return null;

  return (
    <>
      {enabled.map((mask) => (
        <OcclusionMaskView
          key={mask.id}
          mask={mask}
          documentSize={documentSize}
          spaceBackground={spaceBackground}
        />
      ))}
    </>
  );
}

interface OcclusionMaskViewProps {
  mask: OcclusionMask;
  documentSize: DocumentSize;
  spaceBackground: SpaceBackground;
}

function OcclusionMaskView({ mask, documentSize, spaceBackground }: OcclusionMaskViewProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const asset = getRegisteredAsset(spaceBackground.sourceId);

  const pointsPx = mask.points.map((point) => ({
    x: point.x * documentSize.width,
    y: point.y * documentSize.height,
  }));
  const minX = Math.min(...pointsPx.map((point) => point.x));
  const maxX = Math.max(...pointsPx.map((point) => point.x));
  const minY = Math.min(...pointsPx.map((point) => point.y));
  const maxY = Math.max(...pointsPx.map((point) => point.y));
  const blurRadius = resolveOcclusionFeatherRadius(mask.feather, maxX - minX, maxY - minY);

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    if (blurRadius <= 0) {
      node.clearCache();
      node.filters([]);
    } else {
      // Explicit polygon-bounding-box cache rect (padded by the blur radius, mirroring
      // ContactShadowView) rather than Konva's automatic client-rect, which would size the cache
      // to the full document-sized background image and defeat the point of a small clip.
      const pad = blurRadius * 2;
      node.cache({
        x: minX - pad,
        y: minY - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      });
      node.filters([Konva.Filters.Blur]);
      node.blurRadius(blurRadius);
    }
    node.getLayer()?.batchDraw();
  });

  if (!asset) return null;

  const fit = computeCoverFit(
    asset.naturalWidth,
    asset.naturalHeight,
    documentSize.width,
    documentSize.height,
  );

  return (
    <Group
      ref={groupRef}
      clipFunc={(ctx) => {
        ctx.beginPath();
        pointsPx.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
      }}
      opacity={mask.opacity / 100}
      listening={false}
    >
      <KonvaImage
        image={asset.image}
        x={fit.x}
        y={fit.y}
        width={fit.width}
        height={fit.height}
        listening={false}
      />
    </Group>
  );
}
