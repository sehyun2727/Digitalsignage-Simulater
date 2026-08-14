import Konva from 'konva';
import { useEffect, useRef } from 'react';
import { Ellipse, Group } from 'react-konva';
import {
  computeContactShadowGeometry,
  contactShadowBlurRadius,
} from '../../lib/environmentIntegration';
import type { ContactShadowSettings } from '../../types/editor';

interface ContactShadowViewProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shadow: ContactShadowSettings;
}

/**
 * A soft ground-contact shadow — a squashed ellipse beneath the object's own bounding-box
 * footprint, blurred via Konva.Filters.Blur the same way ScreenComposition's ContrastGroup
 * rasterizes+filters a Group once per settings commit rather than per animation frame. Rendered
 * as a sibling *before* the object's own interactive Group (see SignageDisplayView/
 * PortableProductView) so it always paints beneath that object's body.
 */
export function ContactShadowView({
  x,
  y,
  width,
  height,
  rotation,
  shadow,
}: ContactShadowViewProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const geometry = computeContactShadowGeometry(width, height, shadow);
  const blurRadius = contactShadowBlurRadius(width, height, shadow.blur);

  useEffect(() => {
    const node = groupRef.current;
    if (!node || !geometry) return;
    if (blurRadius <= 0) {
      node.clearCache();
      node.filters([]);
    } else {
      // Konva's automatic cache-bounds calculation hugs the ellipse's own bounding box with no
      // margin, which would clip the blur right at its edge; padding the explicit cache rect by
      // the blur radius keeps the softened edge inside the rasterized bitmap.
      const rect = node.getClientRect({ relativeTo: node });
      const pad = blurRadius * 2;
      node.cache({
        x: rect.x - pad,
        y: rect.y - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
      node.filters([Konva.Filters.Blur]);
      node.blurRadius(blurRadius);
    }
    node.getLayer()?.batchDraw();
  });

  if (!geometry) return null;

  return (
    <Group ref={groupRef} x={x} y={y} rotation={rotation} listening={false}>
      <Ellipse
        x={geometry.centerX}
        y={geometry.centerY}
        radiusX={geometry.radiusX}
        radiusY={geometry.radiusY}
        fill="#000000"
        opacity={geometry.opacity}
        listening={false}
      />
    </Group>
  );
}
