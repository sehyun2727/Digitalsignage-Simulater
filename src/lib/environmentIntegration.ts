import {
  MAX_CONTACT_SHADOW_SETTING,
  MAX_CONTACT_SHADOW_SPREAD,
  MAX_CONTACT_SHADOW_TINT,
  MAX_ENVIRONMENT_INTEGRATION,
  MIN_CONTACT_SHADOW_SETTING,
  MIN_CONTACT_SHADOW_SPREAD,
  MIN_CONTACT_SHADOW_TINT,
  MIN_ENVIRONMENT_INTEGRATION,
} from '../types/editor';
import type { ContactShadowSettings, DisplayMaterial, InstallationMode } from '../types/editor';
import type { NormalizedQuad } from './quadGeometry';
import { normalizeMaterial } from './materialTexture';

/** Contact shadow strength/blur share the same 0-100 range as material settings. */
export function clampContactShadowSetting(value: number): number {
  return Math.min(MAX_CONTACT_SHADOW_SETTING, Math.max(MIN_CONTACT_SHADOW_SETTING, value));
}

const MAX_CONTACT_SHADOW_OFFSET = 1;

export function clampContactShadowOffset(offset: number): number {
  return Math.min(MAX_CONTACT_SHADOW_OFFSET, Math.max(-MAX_CONTACT_SHADOW_OFFSET, offset));
}

export function clampContactShadowSpread(value: number): number {
  return Math.min(MAX_CONTACT_SHADOW_SPREAD, Math.max(MIN_CONTACT_SHADOW_SPREAD, value));
}

export function clampContactShadowTint(value: number): number {
  return Math.min(MAX_CONTACT_SHADOW_TINT, Math.max(MIN_CONTACT_SHADOW_TINT, value));
}

/**
 * Shadow fill color for a -100 (cool/blue) .. 100 (warm/amber) tint setting: 0 stays neutral
 * black (the pre-4.5 fixed fill), and each direction interpolates toward a restrained, desaturated
 * hue rather than a saturated color so a "warm/cool" shadow never reads as a colored spotlight.
 */
export function contactShadowFillColor(tint: number): string {
  const clamped = clampContactShadowTint(tint);
  if (clamped === 0) return '#000000';
  const magnitude = Math.abs(clamped) / 100;
  const [r, g, b] =
    clamped > 0
      ? [26 * magnitude, 14 * magnitude, 0]
      : [0, 14 * magnitude, 28 * magnitude];
  const toHex = (channel: number) =>
    Math.round(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function clampEnvironmentIntegration(strength: number): number {
  return Math.min(MAX_ENVIRONMENT_INTEGRATION, Math.max(MIN_ENVIRONMENT_INTEGRATION, strength));
}

const MAX_ENVIRONMENT_BLEND_OPACITY = 0.22;

/** A neutral gray-blue tone, close to typical ambient/ceiling lighting, used for the blend wash. */
export const ENVIRONMENT_BLEND_COLOR = '#888c94';

/**
 * Opacity for a flat neutral-gray wash blended over the whole signage composition (frame +
 * screen), pulling saturation, contrast, and highlight strength all toward the space photo's own
 * flatter tone in one bounded control (sprint spec section 9). Alpha-blending toward a neutral
 * gray both desaturates (shrinks color distance from the wash) and softens contrast (pulls
 * extremes toward the middle) in a single overlay — the same cheap composite-over-per-pixel-
 * filtering approach materialTexture.ts already uses for brightness/LED/LCD, rather than a
 * Konva.Filters chain requiring cache()/rasterization.
 */
export function environmentBlendOpacity(strength: number): number {
  const clamped = clampEnvironmentIntegration(strength);
  return (clamped / 100) * MAX_ENVIRONMENT_BLEND_OPACITY;
}

/** Pure RGB-to-hex averaging step of environment sampling, split out from the canvas readback in
 * `sampleAmbientColor` so the math itself is unit-testable without a real canvas (jsdom has no
 * working 2D context; see assetRegistry.ts's detectHasAlpha for the same split). */
export function averageColorToHex(r: number, g: number, b: number): string {
  const toHex = (channel: number) =>
    Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Samples the space photo's overall ambient tone for the user-triggered "sample environment"
 * action (sprint spec section 13/14): draws a small downscaled copy of the photo to an offscreen
 * canvas and averages its pixels, entirely in-browser (no upload — see CLAUDE.md section 8).
 * Returns null if canvas readback is unavailable rather than throwing, matching
 * assetRegistry.ts's detectHasAlpha fallback policy.
 */
export function sampleAmbientColor(image: CanvasImageSource): string | null {
  try {
    const sampleSize = 16;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
    let r = 0;
    let g = 0;
    let b = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
    }
    return averageColorToHex(r / pixelCount, g / pixelCount, b / pixelCount);
  } catch {
    return null;
  }
}

export interface ContactShadowGeometry {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  opacity: number;
  fill: string;
  /** Additional rotation (degrees) on top of any rotation the caller already applies. */
  rotationDeg: number;
  /** Footprint size feeding `contactShadowBlurRadius`, so blur stays bounded to the object's own
   * silhouette in both rect and perspective mode instead of the full document. */
  footprintWidth: number;
  footprintHeight: number;
}

const MAX_SHADOW_OPACITY = 0.6;
/** Neutral (spread/depth = 100) horizontal/vertical radius ratios, unchanged from the pre-4.5 shadow. */
const BASE_RADIUS_X_RATIO = 0.85;
const BASE_RADIUS_Y_RATIO = 0.08;

/**
 * Geometry/opacity/fill for a squashed-ellipse ground-contact shadow beneath an object's own
 * (unwarped) bounding-box footprint. Returns null when the shadow would be invisible, so callers
 * can skip rendering entirely.
 */
export function computeContactShadowGeometry(
  width: number,
  height: number,
  shadow: {
    enabled: boolean;
    strength: number;
    blur: number;
    offsetX: number;
    offsetY: number;
    spread: number;
    depth: number;
    tint: number;
  },
): ContactShadowGeometry | null {
  if (!shadow.enabled || shadow.strength <= 0 || width <= 0 || height <= 0) return null;
  const spreadFactor = clampContactShadowSpread(shadow.spread) / 100;
  const depthFactor = clampContactShadowSpread(shadow.depth) / 100;
  return {
    centerX: width / 2 + clampContactShadowOffset(shadow.offsetX) * width,
    centerY: height + clampContactShadowOffset(shadow.offsetY) * height,
    radiusX: (width / 2) * BASE_RADIUS_X_RATIO * spreadFactor,
    radiusY: Math.max(6, height * BASE_RADIUS_Y_RATIO * depthFactor),
    opacity: (clampContactShadowSetting(shadow.strength) / 100) * MAX_SHADOW_OPACITY,
    fill: contactShadowFillColor(shadow.tint),
    rotationDeg: 0,
    footprintWidth: width,
    footprintHeight: height,
  };
}

/**
 * Perspective-aligned variant of `computeContactShadowGeometry`: instead of the object's own
 * unwarped bounding box, anchors the shadow ellipse to the perspective quad's bottom edge (in
 * absolute document pixel coordinates) so a wall/floor display placed via four-point perspective
 * (ADR 0008) still casts a shadow that sits under its actual warped footprint, rather than being
 * suppressed outright. This is a documented visual approximation (spec section 11) — the ellipse
 * itself is not re-projected into the quad's own perspective, only anchored and rotated to its
 * bottom edge.
 */
export function computePerspectiveContactShadowGeometry(
  quad: NormalizedQuad,
  documentWidth: number,
  documentHeight: number,
  shadow: {
    enabled: boolean;
    strength: number;
    blur: number;
    offsetX: number;
    offsetY: number;
    spread: number;
    depth: number;
    tint: number;
  },
): ContactShadowGeometry | null {
  if (!shadow.enabled || shadow.strength <= 0 || documentWidth <= 0 || documentHeight <= 0) {
    return null;
  }
  const toPx = (point: { x: number; y: number }) => ({
    x: point.x * documentWidth,
    y: point.y * documentHeight,
  });
  const bottomLeft = toPx(quad.bottomLeft);
  const bottomRight = toPx(quad.bottomRight);
  const topLeft = toPx(quad.topLeft);
  const topRight = toPx(quad.topRight);

  const edgeDx = bottomRight.x - bottomLeft.x;
  const edgeDy = bottomRight.y - bottomLeft.y;
  const edgeLength = Math.hypot(edgeDx, edgeDy);
  if (edgeLength <= 0) return null;

  const quadHeight =
    (Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y) +
      Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y)) /
    2;

  const spreadFactor = clampContactShadowSpread(shadow.spread) / 100;
  const depthFactor = clampContactShadowSpread(shadow.depth) / 100;
  const rotationDeg = (Math.atan2(edgeDy, edgeDx) * 180) / Math.PI;
  const midX = (bottomLeft.x + bottomRight.x) / 2;
  const midY = (bottomLeft.y + bottomRight.y) / 2;
  const offsetAlongNormalY = clampContactShadowOffset(shadow.offsetY) * quadHeight;

  return {
    centerX: midX + clampContactShadowOffset(shadow.offsetX) * edgeLength,
    centerY: midY + offsetAlongNormalY,
    radiusX: (edgeLength / 2) * BASE_RADIUS_X_RATIO * spreadFactor,
    radiusY: Math.max(6, quadHeight * BASE_RADIUS_Y_RATIO * depthFactor),
    opacity: (clampContactShadowSetting(shadow.strength) / 100) * MAX_SHADOW_OPACITY,
    fill: contactShadowFillColor(shadow.tint),
    rotationDeg,
    footprintWidth: edgeLength,
    footprintHeight: quadHeight,
  };
}

/** Konva blur filter radius for the shadow's `blur` (0-100) setting, scaled to the object size. */
export function contactShadowBlurRadius(width: number, height: number, blur: number): number {
  return (clampContactShadowSetting(blur) / 100) * Math.max(width, height) * 0.15;
}

/**
 * Which installation plane an object's default shadow should imply: a wall-mounted panel casts a
 * tight, close shadow; a see-through transparent-LED "window" casts a faint one; a freestanding
 * portable device casts a larger, more separated one (spec section 13). Alias of the persisted
 * `InstallationMode` document field (src/types/editor.ts) — kept as a separate exported name here
 * since this module is the historical/shadow-specific home for the concept.
 */
export type ShadowMode = InstallationMode;

/** Material/kind-derived default, used to seed a freshly created object and to migrate documents
 * saved before `installationMode` existed as an explicit, user-overridable field. */
export function resolveShadowMode(
  kind: 'display' | 'portable',
  material: DisplayMaterial | undefined,
): ShadowMode {
  if (kind === 'portable') return 'freestanding';
  return normalizeMaterial(material) === 'transparent-led' ? 'window' : 'wall';
}

/** Default contact-shadow settings per installation plane, replacing the flat disabled-by-default. */
export const SHADOW_MODE_BASE: Record<ShadowMode, ContactShadowSettings> = {
  wall: {
    enabled: true,
    strength: 30,
    blur: 35,
    offsetX: 0,
    offsetY: 0.035,
    spread: 100,
    depth: 70,
    tint: 0,
  },
  window: {
    enabled: true,
    strength: 18,
    blur: 30,
    offsetX: 0,
    offsetY: 0.03,
    spread: 90,
    depth: 60,
    tint: 0,
  },
  freestanding: {
    enabled: true,
    strength: 35,
    blur: 40,
    offsetX: 0,
    offsetY: 0.06,
    spread: 120,
    depth: 110,
    tint: 8,
  },
};
