import type { DisplayMaterial } from '../types/editor';

export const LED_PATTERN_MAX_OPACITY = 0.35;
export const TRANSPARENT_LED_PATTERN_MAX_OPACITY = 0.55;
/** Peak opacity inside the LCD highlight's narrow band (see LCD_HIGHLIGHT_COLOR_STOPS below). */
export const LCD_HIGHLIGHT_MAX_OPACITY = 0.5;
const BRIGHTNESS_MAX_WHITE_OPACITY = 0.4;
const BRIGHTNESS_MAX_BLACK_OPACITY = 0.5;
const NEUTRAL_BRIGHTNESS = 50;
const NEUTRAL_CONTRAST = 50;

/**
 * Migrates a possibly-stale material value (Sprint 2-4.1 shipped only `'outdoor-led' | 'lcd'`)
 * to the current Sprint 4.2 vocabulary. There is no project-file persistence yet, so this only
 * matters for in-memory state built before this sprint's store defaults changed (e.g. a stale
 * object literal in a test fixture) — any unrecognized value falls back to `'led'` rather than
 * throwing, per CLAUDE.md's "old local/transient state must not crash the app" requirement.
 */
export function normalizeMaterial(value: unknown): Exclude<DisplayMaterial, 'outdoor-led'> {
  if (value === 'outdoor-led') return 'led';
  if (value === 'led' || value === 'lcd' || value === 'transparent-led') return value;
  return 'led';
}

/** Screen size (min of width/height, px) at/above which the LED/Transparent LED grid reads at
 *  its full intended opacity; below GRID_OPACITY_MIN_SIZE it fades toward GRID_OPACITY_MIN_
 *  MULTIPLIER instead of disappearing entirely. */
const GRID_OPACITY_FULL_SIZE = 140;
const GRID_OPACITY_MIN_SIZE = 28;
const GRID_OPACITY_MIN_MULTIPLIER = 0.25;

/**
 * A small display's pixel/mesh grid is not individually resolvable at a glance the way a large
 * one is — the grid should read as fading toward a smoother surface as the screen shrinks
 * (sprint spec section 8), rather than tiling at the same density/opacity regardless of size.
 */
function sizeAwareGridMultiplier(screenSizePx: number): number {
  if (screenSizePx >= GRID_OPACITY_FULL_SIZE) return 1;
  if (screenSizePx <= GRID_OPACITY_MIN_SIZE) return GRID_OPACITY_MIN_MULTIPLIER;
  const t =
    (screenSizePx - GRID_OPACITY_MIN_SIZE) / (GRID_OPACITY_FULL_SIZE - GRID_OPACITY_MIN_SIZE);
  return GRID_OPACITY_MIN_MULTIPLIER + t * (1 - GRID_OPACITY_MIN_MULTIPLIER);
}

/**
 * Opacity of the per-material texture overlay (LED/Transparent LED grid, LCD highlight), 0-max.
 * `screenSizePx` (the rendered screen's min(width, height) in document/export pixels) is
 * optional and defaults to "full size" so existing callers that only care about the intensity
 * curve are unaffected; LED/Transparent LED additionally fade the grid at small sizes (LCD's
 * highlight band is not a resolvable pixel grid, so it is left size-independent).
 */
export function materialPatternOpacity(
  material: DisplayMaterial,
  intensity: number,
  screenSizePx: number = GRID_OPACITY_FULL_SIZE,
): number {
  const normalized = normalizeMaterial(material);
  const max =
    normalized === 'lcd'
      ? LCD_HIGHLIGHT_MAX_OPACITY
      : normalized === 'transparent-led'
        ? TRANSPARENT_LED_PATTERN_MAX_OPACITY
        : LED_PATTERN_MAX_OPACITY;
  const sizeMultiplier = normalized === 'lcd' ? 1 : sizeAwareGridMultiplier(screenSizePx);
  return (Math.min(100, Math.max(0, intensity)) / 100) * max * sizeMultiplier;
}

export interface BrightnessOverlay {
  fill: 'white' | 'black';
  opacity: number;
}

/** A flat wash overlay approximating a brightness adjustment; null when brightness is neutral (50). */
export function getBrightnessOverlay(brightness: number): BrightnessOverlay | null {
  const clamped = Math.min(100, Math.max(0, brightness));
  if (clamped === NEUTRAL_BRIGHTNESS) return null;
  if (clamped > NEUTRAL_BRIGHTNESS) {
    return {
      fill: 'white',
      opacity: ((clamped - NEUTRAL_BRIGHTNESS) / NEUTRAL_BRIGHTNESS) * BRIGHTNESS_MAX_WHITE_OPACITY,
    };
  }
  return {
    fill: 'black',
    opacity: ((NEUTRAL_BRIGHTNESS - clamped) / NEUTRAL_BRIGHTNESS) * BRIGHTNESS_MAX_BLACK_OPACITY,
  };
}

/**
 * A narrow diagonal specular-highlight band (not a corner-to-corner wash) for the LCD material,
 * scaled by materialPatternOpacity: transparent before ~22%, a sharp peak around 30%, transparent
 * again by 42% of the gradient's start-to-end span, so the reflection reads as a directional,
 * localized streak rather than uniformly graying the whole screen (spec section 15).
 */
export const LCD_HIGHLIGHT_COLOR_STOPS = [
  0,
  'rgba(255,255,255,0)',
  0.22,
  'rgba(255,255,255,0)',
  0.3,
  'rgba(255,255,255,1)',
  0.42,
  'rgba(255,255,255,0)',
  1,
  'rgba(255,255,255,0)',
];

/** Peak opacity of the per-object secondary highlight streak, see getLcdSecondaryHighlight. */
export const LCD_SECONDARY_HIGHLIGHT_MAX_OPACITY = 0.22;

export interface LcdHighlightVariant {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  colorStops: (number | string)[];
}

/** A small deterministic hash, used only to derive stable cosmetic variation - never for
 *  anything security- or identity-sensitive. */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * A second, fainter specular streak layered on top of the LCD material's fixed primary highlight
 * band (LCD_HIGHLIGHT_COLOR_STOPS), so multiple same-sized LCD screens placed in one scene don't
 * read as exact visual clones of each other - real ambient reflections land differently on every
 * panel depending on its surroundings. Its diagonal and peak position are derived from a hash of
 * the object's own id, so the same object always renders the same streak (stable across
 * re-renders and undo/redo) while different objects differ from one another. This is an
 * *additional* layer rather than a replacement for the primary band, so the primary band's fixed
 * geometry (and anything that depends on it, e.g. e2e pixel assertions) is unaffected.
 */
export function getLcdSecondaryHighlight(
  objectId: string,
  width: number,
  height: number,
): LcdHighlightVariant {
  const hash = hashString(objectId);
  const useAntiDiagonal = (hash & 1) === 1;
  // 0.55-0.75: the opposite half of the screen from the primary band's fixed 0.3 peak, so the
  // two streaks read as distinct light sources instead of overlapping into one wide band.
  const peak = 0.55 + ((hash >>> 1) % 21) / 100;
  const bandHalfWidth = 0.06;

  const [startPoint, endPoint] = useAntiDiagonal
    ? [
        { x: width, y: 0 },
        { x: 0, y: height },
      ]
    : [
        { x: 0, y: 0 },
        { x: width, y: height },
      ];

  return {
    startPoint,
    endPoint,
    colorStops: [
      0,
      'rgba(255,255,255,0)',
      Math.max(0, peak - bandHalfWidth),
      'rgba(255,255,255,0)',
      peak,
      'rgba(255,255,255,1)',
      Math.min(1, peak + bandHalfWidth),
      'rgba(255,255,255,0)',
      1,
      'rgba(255,255,255,0)',
    ],
  };
}

/** Opacity of the secondary highlight streak, scaled by the same intensity setting as the
 *  primary band but capped lower so it always reads as the fainter of the two. */
export function lcdSecondaryHighlightOpacity(intensity: number): number {
  return (Math.min(100, Math.max(0, intensity)) / 100) * LCD_SECONDARY_HIGHLIGHT_MAX_OPACITY;
}

/**
 * Backing-rect opacity for the Transparent LED material: how much of whatever is already
 * painted underneath (the space background photo, drawn earlier in the same Konva Layer/canvas)
 * shows through the screen's dark/off areas. 0 transparency reads close to an opaque LED
 * backing; 100 leaves only a faint tint so the background reads clearly (see ADR 0007).
 */
export function transparentBackingOpacity(transparency: number): number {
  const clamped = Math.min(100, Math.max(0, transparency));
  const minOpacity = 0.08;
  const maxOpacity = 0.85;
  return maxOpacity - (clamped / 100) * (maxOpacity - minOpacity);
}

/**
 * Content opacity for the Transparent LED material, combined with a 'lighten' composite
 * operation (see ScreenComposition.tsx): compositing with 'lighten' takes the per-channel
 * maximum of the content pixel and whatever is already painted underneath, so near-black
 * content pixels barely affect the result (the background stays visible) while bright pixels
 * dominate and read as illuminated — a cheap approximation of "dark areas stay transparent,
 * bright content contributes light" with no manual pixel sampling required.
 */
export function transparentContentOpacity(brightness: number): number {
  const clamped = Math.min(100, Math.max(0, brightness));
  return 0.35 + (clamped / 100) * 0.65;
}

export interface GlowShadow {
  blur: number;
  opacity: number;
  color: string;
}

/** Konva shadow-blur parameters approximating LED/Transparent LED glow; null when glow is 0. */
export function getGlowShadow(glow: number, color = '#8fd6ff'): GlowShadow | null {
  const clamped = Math.min(100, Math.max(0, glow));
  if (clamped <= 0) return null;
  return { blur: (clamped / 100) * 18, opacity: 0.25 + (clamped / 100) * 0.35, color };
}

/**
 * Maps the 0-100 "contrast" material setting (50 = neutral) onto the -100..100 range expected
 * by Konva.Filters.Contrast, so the mild contrast boost stays clamped to a readable range
 * instead of blowing out content.
 */
export function contrastFilterValue(contrast: number): number {
  const clamped = Math.min(100, Math.max(0, contrast));
  return (clamped - NEUTRAL_CONTRAST) * 1.2;
}

const ledPatternCanvasCache = new Map<number, HTMLCanvasElement>();

/** Buckets a 0-100 density value down to a handful of cache keys instead of one per pixel value. */
function densityBucket(density: number): number {
  return Math.round(Math.min(100, Math.max(0, density)) / 10) * 10;
}

/**
 * A small repeating dot-grid tile used as an LED/Transparent LED pixel texture via Konva's
 * fillPatternImage. Cached per density bucket and built once per bucket — this renders a
 * handful of pixels on a canvas that Konva then tiles, instead of creating one node per LED
 * pixel (which would not scale to real content sizes; see CLAUDE.md performance guidance).
 * Higher density means a smaller repeating tile (a tighter, denser-looking grid).
 */
export function getLedPatternCanvas(density = 50): HTMLCanvasElement {
  const bucket = densityBucket(density);
  const cached = ledPatternCanvasCache.get(bucket);
  if (cached) return cached;

  // Density 0 -> a coarse 10px tile (large, sparse-looking pixels); density 100 -> a tight 4px
  // tile. The dot itself is always inset by 1px so the pattern reads as a grid at any size.
  const size = Math.max(4, Math.round(10 - (bucket / 100) * 6));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, size, size);
    ctx.clearRect(1, 1, size - 2, size - 2);
  }
  ledPatternCanvasCache.set(bucket, canvas);
  return canvas;
}
