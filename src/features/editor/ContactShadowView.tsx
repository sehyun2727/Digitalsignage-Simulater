import Konva from 'konva';
import { useEffect, useRef } from 'react';
import { Ellipse, Group } from 'react-konva';
import {
  computeContactShadowGeometry,
  computePerspectiveContactShadowGeometry,
  contactShadowBlurRadius,
} from '../../lib/environmentIntegration';
import type { NormalizedQuad } from '../../lib/quadGeometry';
import type { ContactShadowSettings } from '../../types/editor';

interface ContactShadowRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shadow: ContactShadowSettings;
  perspective?: undefined;
}

interface ContactShadowPerspectiveProps {
  /** Perspective quad + document size, in place of the flat x/y/width/height/rotation footprint. */
  perspective: {
    quad: NormalizedQuad;
    documentWidth: number;
    documentHeight: number;
  };
  shadow: ContactShadowSettings;
}

type ContactShadowViewProps = ContactShadowRectProps | ContactShadowPerspectiveProps;

/**
 * A soft ground-contact shadow — a squashed ellipse beneath the object's own bounding-box
 * footprint (or, in perspective placement mode, the perspective quad's bottom edge — see
 * `computePerspectiveContactShadowGeometry`), blurred via Konva.Filters.Blur the same way
 * ScreenComposition's ContrastGroup rasterizes+filters a Group once per settings commit rather
 * than per animation frame. Rendered as a sibling *before* the object's own interactive Group
 * (see SignageDisplayView/PortableProductView) so it always paints beneath that object's body.
 */
export function ContactShadowView(props: ContactShadowViewProps) {
  const { shadow } = props;
  const groupRef = useRef<Konva.Group | null>(null);
  const geometry = props.perspective
    ? computePerspectiveContactShadowGeometry(
        props.perspective.quad,
        props.perspective.documentWidth,
        props.perspective.documentHeight,
        shadow,
      )
    : computeContactShadowGeometry(props.width, props.height, shadow);
  // Blur is bounded to the shadow's own footprint (object bounds, or the perspective quad's
  // bottom-edge/height) rather than the full document, matching the pre-4.5 rect-mode behavior.
  const footprintWidth = geometry?.footprintWidth ?? 0;
  const footprintHeight = geometry?.footprintHeight ?? 0;
  const blurRadius = contactShadowBlurRadius(footprintWidth, footprintHeight, shadow.blur);
  // Perspective mode anchors the group at the ellipse's own center (so `rotationDeg` rotates the
  // ellipse's long axis in place) rather than at a shared object pivot like rect mode does, since
  // there is no single object x/y anchor once the shadow is derived from the quad's own edge.
  const groupX = props.perspective ? (geometry?.centerX ?? 0) : props.x;
  const groupY = props.perspective ? (geometry?.centerY ?? 0) : props.y;
  const groupRotation = props.perspective ? (geometry?.rotationDeg ?? 0) : props.rotation;
  const ellipseX = props.perspective ? 0 : (geometry?.centerX ?? 0);
  const ellipseY = props.perspective ? 0 : (geometry?.centerY ?? 0);

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
    <Group ref={groupRef} x={groupX} y={groupY} rotation={groupRotation} listening={false}>
      <Ellipse
        x={ellipseX}
        y={ellipseY}
        radiusX={geometry.radiusX}
        radiusY={geometry.radiusY}
        fill={geometry.fill}
        opacity={geometry.opacity}
        listening={false}
      />
    </Group>
  );
}
