import type { DisplayMaterial } from '../types/editor';

export const LED_PATTERN_MAX_OPACITY = 0.35;
export const LCD_HIGHLIGHT_MAX_OPACITY = 0.15;
const BRIGHTNESS_MAX_WHITE_OPACITY = 0.4;
const BRIGHTNESS_MAX_BLACK_OPACITY = 0.5;
const NEUTRAL_BRIGHTNESS = 50;

/** Opacity of the per-material texture overlay (LED pixel grid / LCD highlight), 0-max. */
export function materialPatternOpacity(material: DisplayMaterial, intensity: number): number {
  const max = material === 'outdoor-led' ? LED_PATTERN_MAX_OPACITY : LCD_HIGHLIGHT_MAX_OPACITY;
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

let ledPatternCanvas: HTMLCanvasElement | null = null;

/**
 * A small repeating dot-grid tile used as an outdoor LED pixel texture via Konva's
 * fillPatternImage. Cached module-wide and built once — this renders a handful of pixels
 * on a canvas that Konva then tiles, instead of creating one node per LED pixel (which
 * would not scale to real content sizes; see CLAUDE.md performance guidance).
 */
export function getLedPatternCanvas(): HTMLCanvasElement {
  if (ledPatternCanvas) return ledPatternCanvas;
  const size = 6;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, size, size);
    ctx.clearRect(1, 1, size - 2, size - 2);
  }
  ledPatternCanvas = canvas;
  return canvas;
}
