import type { DisplayMaterial } from '../types/editor';

export const LED_PATTERN_MAX_OPACITY = 0.35;
export const TRANSPARENT_LED_PATTERN_MAX_OPACITY = 0.55;
export const LCD_HIGHLIGHT_MAX_OPACITY = 0.15;
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
export function normalizeMaterial(value: unknown): DisplayMaterial {
  if (value === 'outdoor-led') return 'led';
  if (value === 'led' || value === 'lcd' || value === 'transparent-led') return value;
  return 'led';
}

/** Opacity of the per-material texture overlay (LED/Transparent LED grid, LCD highlight), 0-max. */
export function materialPatternOpacity(material: DisplayMaterial, intensity: number): number {
  const normalized = normalizeMaterial(material);
  const max =
    normalized === 'lcd'
      ? LCD_HIGHLIGHT_MAX_OPACITY
      : normalized === 'transparent-led'
        ? TRANSPARENT_LED_PATTERN_MAX_OPACITY
        : LED_PATTERN_MAX_OPACITY;
  return (Math.min(100, Math.max(0, intensity)) / 100) * max;
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

/** Diagonal highlight gradient stops for the LCD material; scaled by materialPatternOpacity. */
export const LCD_HIGHLIGHT_COLOR_STOPS = [
  0,
  'rgba(255,255,255,1)',
  0.4,
  'rgba(255,255,255,0)',
  1,
  'rgba(255,255,255,0)',
];

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
