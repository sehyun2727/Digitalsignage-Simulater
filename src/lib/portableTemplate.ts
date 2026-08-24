import type { NormalizedQuad } from '../types/editor';
import type { Rect } from './contentLayout';

/**
 * Fixed photo-based portable signage template. The "Add portable" flow spawns one of three
 * pre-rendered product photographs (bundled under `src/assets/portable/`) rather than a
 * user-uploaded product photo or a vector redraw. Three viewing angles are supported:
 *
 *   - `front`         (0°)   — the reference straight-on shot
 *   - `angled-right`  (+60°) — the reference 3/4 view (stand/wheel on the left)
 *   - `angled-left`   (−60°) — the same 3/4 asset rendered horizontally mirrored
 *
 * Every view shares the same bounding-box aspect ratio (`PORTABLE_TEMPLATE_ASPECT`) — the
 * asset PNGs are all 1024×1536 (2:3), so switching between them never resizes the object on
 * the canvas. The screen quad is derived per-view from `PORTABLE_PRESET_SCREEN_QUADS`, and
 * the axis-aligned rect used by `screenHitTest`/`ScreenComposition` is *derived* from that
 * same quad (see `SCREEN_REGIONS` below), guaranteeing that the clear-screen mask, the
 * warped-content quad, the drop-target rect, and the debug overlay all reference one single
 * source of truth.
 */

export type PortableTemplateView = 'front' | 'angled-right' | 'angled-left';

export const PORTABLE_TEMPLATE_VIEWS: readonly PortableTemplateView[] = [
  'angled-left',
  'front',
  'angled-right',
];

/** The right-3/4 photo is the "hero" reference shot, so a newly added portable spawns with it. */
export const DEFAULT_PORTABLE_TEMPLATE_VIEW: PortableTemplateView = 'angled-right';

/** Aspect ratio (width / height) of the object's bounding box, matching the source PNGs at
 *  1024×1536. Kept identical across all views so a view change never has to also touch
 *  `object.width` / `object.height`. */
export const PORTABLE_TEMPLATE_ASPECT = 1024 / 1536;

/**
 * Preset four-point perspective-correct screen quads for each template view. Corner order is
 * fixed: topLeft → topRight → bottomRight → bottomLeft (matching `NormalizedQuad`). Values
 * are normalized (0–1) fractions of the object's own bounding box, so they scale with the
 * object without any recalculation.
 *
 * Measured directly from the source PNGs at 1024×1536 px by
 * `scripts/measure-portable-screen-quad.mjs`: it finds the largest colorful connected
 * component in each image (the food-photo screen area, excluding the white bezel), then picks
 * the four diagonal-extreme pixels (min x+y = TL, max x−y = TR, max x+y = BR, max y−x = BL).
 * Because the extraction is direction-based rather than edge-fit, interior plate holes in the
 * food photo do not perturb the corner picks.
 *
 * `angled-left` measurements are taken from the raw `angled.png` (screen on the LEFT of the
 * composition). `angled-right` is the exact horizontal mirror (x → 1−x) of `angled-left`,
 * matching how `PortableTemplateBody` renders the same asset flipped via `scaleX={-1}`.
 * The mirror swaps topLeft↔topRight and bottomLeft↔bottomRight (left/right corners trade
 * sides under a horizontal flip).
 */
export const PORTABLE_PRESET_SCREEN_QUADS: Record<PortableTemplateView, NormalizedQuad> = {
  front: {
    topLeft:     { x: 0.22461, y: 0.06706 },
    topRight:    { x: 0.77441, y: 0.06706 },
    bottomRight: { x: 0.77539, y: 0.75651 },
    bottomLeft:  { x: 0.22363, y: 0.75716 },
  },
  'angled-left': {
    topLeft:     { x: 0.35352, y: 0.09766 },
    topRight:    { x: 0.72656, y: 0.07292 },
    bottomRight: { x: 0.60840, y: 0.65104 },
    bottomLeft:  { x: 0.22461, y: 0.63281 },
  },
  'angled-right': {
    // Exact horizontal mirror (x → 1−x) of angled-left. Corner labels swap because a
    // horizontal flip trades left and right: angled-left's topRight becomes angled-right's
    // topLeft (and analogously for the bottom pair).
    topLeft:     { x: 1 - 0.72656, y: 0.07292 },  // ↔ angled-left.topRight
    topRight:    { x: 1 - 0.35352, y: 0.09766 },  // ↔ angled-left.topLeft
    bottomRight: { x: 1 - 0.22461, y: 0.63281 },  // ↔ angled-left.bottomLeft
    bottomLeft:  { x: 1 - 0.60840, y: 0.65104 },  // ↔ angled-left.bottomRight
  },
};

/**
 * Axis-aligned bounding box of each preset screen quad, in normalized coordinates. Derived
 * from `PORTABLE_PRESET_SCREEN_QUADS` at module load so there is *no* second hand-authored
 * copy of the screen geometry to drift from the quad — updating one automatically updates
 * the other. Consumed by `screenHitTest` (drop-target) and `ScreenComposition` (dark
 * backdrop rect when a per-object screenQuad is absent).
 */
function quadAxisAlignedRegion(quad: NormalizedQuad): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const xs = [quad.topLeft.x, quad.topRight.x, quad.bottomRight.x, quad.bottomLeft.x];
  const ys = [quad.topLeft.y, quad.topRight.y, quad.bottomRight.y, quad.bottomLeft.y];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const SCREEN_REGIONS: Record<
  PortableTemplateView,
  { x: number; y: number; width: number; height: number }
> = {
  front: quadAxisAlignedRegion(PORTABLE_PRESET_SCREEN_QUADS.front),
  'angled-left': quadAxisAlignedRegion(PORTABLE_PRESET_SCREEN_QUADS['angled-left']),
  'angled-right': quadAxisAlignedRegion(PORTABLE_PRESET_SCREEN_QUADS['angled-right']),
};

export function getPortableScreenRect(
  view: PortableTemplateView,
  width: number,
  height: number,
): Rect {
  const region = SCREEN_REGIONS[view];
  return {
    x: region.x * width,
    y: region.y * height,
    width: region.width * width,
    height: region.height * height,
  };
}

/**
 * Default width/height for a newly added template portable, sized so it reads clearly against
 * the space photo without dominating it. Same shape as (and replaces) the removed
 * `computeDefaultPortableSize`, but derives from the template aspect ratio directly instead of
 * from an intrinsic photo size — every portable is one template family now, no per-photo
 * geometry to preserve.
 */
export function getDefaultPortableSize(canvasSize: {
  width: number;
  height: number;
}): { width: number; height: number } {
  // Target ~55% of the canvas height, capped at 600px so a very tall canvas doesn't produce a
  // portable object bigger than any realistic on-screen scale. Width follows from the fixed
  // template aspect ratio, so the object stays the correct silhouette regardless of canvas.
  const height = Math.min(600, canvasSize.height * 0.55);
  return {
    width: height * PORTABLE_TEMPLATE_ASPECT,
    height,
  };
}
