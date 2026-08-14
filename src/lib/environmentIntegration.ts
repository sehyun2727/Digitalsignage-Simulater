import {
  MAX_CONTACT_SHADOW_SETTING,
  MAX_ENVIRONMENT_INTEGRATION,
  MIN_CONTACT_SHADOW_SETTING,
  MIN_ENVIRONMENT_INTEGRATION,
} from '../types/editor';
import type { ContactShadowSettings, DisplayMaterial } from '../types/editor';
import { normalizeMaterial } from './materialTexture';

/** Contact shadow strength/blur share the same 0-100 range as material settings. */
export function clampContactShadowSetting(value: number): number {
  return Math.min(MAX_CONTACT_SHADOW_SETTING, Math.max(MIN_CONTACT_SHADOW_SETTING, value));
}

const MAX_CONTACT_SHADOW_OFFSET = 1;

export function clampContactShadowOffset(offset: number): number {
  return Math.min(MAX_CONTACT_SHADOW_OFFSET, Math.max(-MAX_CONTACT_SHADOW_OFFSET, offset));
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

export interface ContactShadowGeometry {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  opacity: number;
}

const MAX_SHADOW_OPACITY = 0.6;

/**
 * Geometry/opacity for a squashed-ellipse ground-contact shadow beneath an object's own
 * (unwarped) bounding-box footprint — including in perspective placement mode, where warping the
 * shadow itself into the quad would add significant complexity for a visual-only effect that ADR
 * 0007 already treats as an approximation, not a physical simulation. Returns null when the
 * shadow would be invisible, so callers can skip rendering entirely.
 */
export function computeContactShadowGeometry(
  width: number,
  height: number,
  shadow: { enabled: boolean; strength: number; blur: number; offsetX: number; offsetY: number },
): ContactShadowGeometry | null {
  if (!shadow.enabled || shadow.strength <= 0 || width <= 0 || height <= 0) return null;
  return {
    centerX: width / 2 + clampContactShadowOffset(shadow.offsetX) * width,
    centerY: height + clampContactShadowOffset(shadow.offsetY) * height,
    radiusX: (width / 2) * 0.85,
    radiusY: Math.max(6, height * 0.08),
    opacity: (clampContactShadowSetting(shadow.strength) / 100) * MAX_SHADOW_OPACITY,
  };
}

/** Konva blur filter radius for the shadow's `blur` (0-100) setting, scaled to the object size. */
export function contactShadowBlurRadius(width: number, height: number, blur: number): number {
  return (clampContactShadowSetting(blur) / 100) * Math.max(width, height) * 0.15;
}

/**
 * Which installation plane an object's default shadow should imply: a wall-mounted panel casts a
 * tight, close shadow; a see-through transparent-LED "window" casts a faint one; a freestanding
 * portable device casts a larger, more separated one (spec section 13).
 */
export type ShadowMode = 'wall' | 'window' | 'freestanding';

export function resolveShadowMode(
  kind: 'display' | 'portable',
  material: DisplayMaterial | undefined,
): ShadowMode {
  if (kind === 'portable') return 'freestanding';
  return normalizeMaterial(material) === 'transparent-led' ? 'window' : 'wall';
}

/** Default contact-shadow settings per installation plane, replacing the flat disabled-by-default. */
export const SHADOW_MODE_BASE: Record<ShadowMode, ContactShadowSettings> = {
  wall: { enabled: true, strength: 30, blur: 35, offsetX: 0, offsetY: 0.035 },
  window: { enabled: true, strength: 18, blur: 30, offsetX: 0, offsetY: 0.03 },
  freestanding: { enabled: true, strength: 35, blur: 40, offsetX: 0, offsetY: 0.06 },
};
