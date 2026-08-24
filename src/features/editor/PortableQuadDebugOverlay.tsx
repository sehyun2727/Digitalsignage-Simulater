import { Circle, Group, Line, Text } from 'react-konva';
import {
  PORTABLE_PRESET_SCREEN_QUADS,
  type PortableTemplateView,
} from '../../lib/portableTemplate';
import type { NormalizedQuad } from '../../types/editor';

interface PortableQuadDebugOverlayProps {
  view: PortableTemplateView;
  width: number;
  height: number;
}

const CORNER_COLORS = {
  topLeft: '#ff2b2b',
  topRight: '#2be74e',
  bottomRight: '#2b8cff',
  bottomLeft: '#ffd83d',
} as const;

const CORNER_LABEL_LETTERS = {
  topLeft: 'TL',
  topRight: 'TR',
  bottomRight: 'BR',
  bottomLeft: 'BL',
} as const;

function quadPointsFlat(quad: NormalizedQuad, width: number, height: number): number[] {
  return [
    quad.topLeft.x * width, quad.topLeft.y * height,
    quad.topRight.x * width, quad.topRight.y * height,
    quad.bottomRight.x * width, quad.bottomRight.y * height,
    quad.bottomLeft.x * width, quad.bottomLeft.y * height,
  ];
}

/**
 * Dev-only overlay drawn on top of a portable object at object-local coordinates.
 * Renders the PORTABLE_PRESET_SCREEN_QUADS[view] polygon outline plus one colored
 * corner dot per corner (TL red / TR green / BR blue / BL yellow) and a small text
 * label with the corner's normalized coordinates. Because it sits inside the same
 * object Group as PortableTemplateBody and WarpedScreenContent, any misalignment
 * between the preset quad and either consumer becomes visually obvious.
 *
 * Guaranteed non-interactive: every child sets `listening={false}` so debug shapes
 * never intercept clicks/drags meant for the object hit area beneath.
 */
export function PortableQuadDebugOverlay({
  view,
  width,
  height,
}: PortableQuadDebugOverlayProps) {
  const quad = PORTABLE_PRESET_SCREEN_QUADS[view];
  const corners = (['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const).map(
    (corner) => ({
      corner,
      point: {
        x: quad[corner].x * width,
        y: quad[corner].y * height,
      },
    }),
  );
  const dotRadius = Math.max(4, Math.min(width, height) * 0.015);
  return (
    <Group listening={false}>
      <Line
        points={quadPointsFlat(quad, width, height)}
        closed
        stroke="#ff00ff"
        strokeWidth={Math.max(1, Math.min(width, height) * 0.004)}
        dash={[8, 6]}
        listening={false}
      />
      {corners.map(({ corner, point }) => (
        <Group key={corner} listening={false}>
          <Circle
            x={point.x}
            y={point.y}
            radius={dotRadius}
            fill={CORNER_COLORS[corner]}
            stroke="#000"
            strokeWidth={1}
            listening={false}
          />
          <Text
            x={point.x + dotRadius + 2}
            y={point.y - dotRadius - 2}
            text={`${CORNER_LABEL_LETTERS[corner]} (${quad[corner].x.toFixed(3)}, ${quad[corner].y.toFixed(3)})`}
            fontSize={Math.max(10, Math.min(width, height) * 0.028)}
            fill="#fff"
            stroke="#000"
            strokeWidth={0.5}
            fontStyle="bold"
            listening={false}
          />
        </Group>
      ))}
    </Group>
  );
}
