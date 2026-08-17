import { Group } from 'react-konva';
import type { Rect as RectShape } from '../../lib/contentLayout';
import type {
  Curvature,
  DisplayMaterial,
  InstallationMode,
  MaterialSettings,
  SignageContent,
} from '../../types/editor';
import { ScreenComposition } from './ScreenComposition';

interface ScreenReflectionProps {
  /** Screen rect in the parent object's own local coordinate space, same as ScreenComposition. */
  screen: RectShape;
  material: DisplayMaterial;
  materialSettings: MaterialSettings;
  curvature: Curvature;
  content: SignageContent | null;
  installationMode: InstallationMode;
}

const REFLECTION_OPACITY = 0.18;
const MAX_REFLECTION_HEIGHT = 120;

/**
 * A faint, vertically-mirrored duplicate of the screen's own composition, anchored to the
 * screen's bottom edge, approximating the reflection a window-mounted display casts on the glass
 * below it (sprint spec section 18). Only rendered for `installationMode === 'window'` — the only
 * installation mode that implies a glass surface (see SHADOW_MODE_BASE in
 * lib/environmentIntegration.ts, which already gives 'window' its own contact-shadow tuning).
 * Reuses ScreenComposition wholesale (rather than re-deriving the material/curvature rendering)
 * so the reflection always stays visually in sync with the real screen, including its own glow
 * halo and curvature warp, for the cost of one extra composited render.
 */
export function ScreenReflection({
  screen,
  material,
  materialSettings,
  curvature,
  content,
  installationMode,
}: ScreenReflectionProps) {
  if (installationMode !== 'window') return null;

  const bottom = screen.y + screen.height;
  const reflectionHeight = Math.min(screen.height * 0.4, MAX_REFLECTION_HEIGHT);

  return (
    <Group
      clipFunc={(ctx) => ctx.rect(screen.x, bottom, screen.width, reflectionHeight)}
      opacity={REFLECTION_OPACITY}
      listening={false}
    >
      {/* Mirrors every point at local y across the screen's own bottom edge (y = bottom), so the
          bottom edge itself stays anchored and the rest of the screen unfolds downward below it. */}
      <Group y={bottom * 2} scaleY={-1}>
        <ScreenComposition
          screen={screen}
          material={material}
          materialSettings={materialSettings}
          curvature={curvature}
          content={content}
        />
      </Group>
    </Group>
  );
}
