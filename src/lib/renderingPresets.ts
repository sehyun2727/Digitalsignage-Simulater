import type {
  ContactShadowSettings,
  DisplayMaterial,
  EnvironmentIntegrationSettings,
  MaterialSettings,
} from '../types/editor';
import {
  clampContactShadowSetting,
  clampEnvironmentIntegration,
  resolveShadowMode,
  SHADOW_MODE_BASE,
} from './environmentIntegration';
import { normalizeMaterial } from './materialTexture';

/**
 * Named starting points replacing the old single flat `DEFAULT_MATERIAL_SETTINGS` (spec section
 * 7/21): a freshly added display should already look plausible for a common installation
 * scenario instead of requiring the user to hand-tune every slider before it reads as
 * "photorealistic". Presets only seed initial values; every underlying slider remains freely
 * editable afterward.
 */
export type RenderingPresetId = 'natural' | 'bright' | 'night';

export const RENDERING_PRESET_IDS: readonly RenderingPresetId[] = ['natural', 'bright', 'night'];

/** Per-material baseline (the 'natural' preset), tuned per technology instead of one flat set. */
const MATERIAL_BASE_SETTINGS: Record<Exclude<DisplayMaterial, 'outdoor-led'>, MaterialSettings> = {
  led: { intensity: 45, brightness: 55, transparency: 0, gridDensity: 45, glow: 32, contrast: 52 },
  lcd: { intensity: 18, brightness: 52, transparency: 0, gridDensity: 0, glow: 0, contrast: 50 },
  'transparent-led': {
    intensity: 42,
    brightness: 58,
    transparency: 78,
    gridDensity: 45,
    glow: 38,
    contrast: 50,
  },
};

/**
 * Additive adjustments applied on top of a material's natural baseline for the 'bright'/'night'
 * presets, approximating how the same panel reads in strong ambient light vs. a dark environment:
 * a bright scene washes the panel out (more brightness/contrast to stay legible), a dark scene
 * makes it read as more luminous/glowing against its surroundings.
 */
const PRESET_ADJUSTMENT: Record<
  Exclude<RenderingPresetId, 'natural'>,
  Partial<Record<keyof MaterialSettings, number>>
> = {
  bright: { brightness: 14, contrast: 8, intensity: 5, glow: -6 },
  night: { brightness: -14, contrast: -5, glow: 16, intensity: -4 },
};

const MATERIAL_SETTING_KEYS: (keyof MaterialSettings)[] = [
  'intensity',
  'brightness',
  'transparency',
  'gridDensity',
  'glow',
  'contrast',
];

function clampMaterialSetting(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Resolved starting `MaterialSettings` for a given material + rendering preset. */
export function getPresetMaterialSettings(
  material: DisplayMaterial | undefined,
  preset: RenderingPresetId,
): MaterialSettings {
  const normalized = normalizeMaterial(material);
  const base = MATERIAL_BASE_SETTINGS[normalized];
  if (preset === 'natural') return { ...base };
  const adjustment = PRESET_ADJUSTMENT[preset];
  const result = { ...base };
  for (const key of MATERIAL_SETTING_KEYS) {
    if (key === 'transparency' && normalized !== 'transparent-led') continue;
    if (key === 'gridDensity' && normalized === 'lcd') continue;
    if (key === 'glow' && normalized === 'lcd') continue;
    const delta = adjustment[key];
    if (delta === undefined) continue;
    result[key] = clampMaterialSetting(base[key] + delta);
  }
  return result;
}

/** Shadow-strength multiplier per preset: harsher light -> more defined shadow, dark -> softer. */
const PRESET_SHADOW_MULTIPLIER: Record<RenderingPresetId, number> = {
  natural: 1,
  bright: 1.2,
  night: 0.7,
};

/** Resolved starting `ContactShadowSettings` for a given object kind + material + preset. */
export function getPresetContactShadow(
  kind: 'display' | 'portable',
  material: DisplayMaterial | undefined,
  preset: RenderingPresetId,
): ContactShadowSettings {
  const mode = resolveShadowMode(kind, material);
  const base = SHADOW_MODE_BASE[mode];
  const multiplier = PRESET_SHADOW_MULTIPLIER[preset];
  return {
    ...base,
    strength: clampContactShadowSetting(base.strength * multiplier),
  };
}

/** Resolved starting `EnvironmentIntegrationSettings` for a given preset. */
const PRESET_ENVIRONMENT_STRENGTH: Record<RenderingPresetId, number> = {
  natural: 15,
  bright: 30,
  night: 6,
};

export function getPresetEnvironmentIntegration(
  preset: RenderingPresetId,
): EnvironmentIntegrationSettings {
  return { strength: clampEnvironmentIntegration(PRESET_ENVIRONMENT_STRENGTH[preset]) };
}

export interface RenderingPresetPatch {
  materialSettings: MaterialSettings;
  contactShadow: ContactShadowSettings;
  environmentIntegration: EnvironmentIntegrationSettings;
}

/** Convenience bundle of the three preset-resolved value groups, for a single store commit. */
export function resolvePresetPatch(
  kind: 'display' | 'portable',
  material: DisplayMaterial | undefined,
  preset: RenderingPresetId,
): RenderingPresetPatch {
  return {
    materialSettings: getPresetMaterialSettings(material, preset),
    contactShadow: getPresetContactShadow(kind, material, preset),
    environmentIntegration: getPresetEnvironmentIntegration(preset),
  };
}

/**
 * Best-effort reverse lookup for UI highlighting ("which preset button is active"): returns a
 * preset id only when the object's current values match that preset's resolved patch exactly,
 * and `null` once the user has hand-edited any slider away from a preset starting point. This is
 * deliberately not persisted anywhere — it is derived on every render from current object state.
 */
export function detectActivePreset(
  kind: 'display' | 'portable',
  material: DisplayMaterial | undefined,
  materialSettings: MaterialSettings,
  contactShadow: ContactShadowSettings,
  environmentIntegration: EnvironmentIntegrationSettings,
): RenderingPresetId | null {
  for (const preset of RENDERING_PRESET_IDS) {
    const patch = resolvePresetPatch(kind, material, preset);
    const materialMatches = MATERIAL_SETTING_KEYS.every(
      (key) => patch.materialSettings[key] === materialSettings[key],
    );
    const shadowMatches =
      patch.contactShadow.enabled === contactShadow.enabled &&
      patch.contactShadow.strength === contactShadow.strength &&
      patch.contactShadow.blur === contactShadow.blur &&
      patch.contactShadow.offsetX === contactShadow.offsetX &&
      patch.contactShadow.offsetY === contactShadow.offsetY;
    const environmentMatches =
      patch.environmentIntegration.strength === environmentIntegration.strength;
    if (materialMatches && shadowMatches && environmentMatches) return preset;
  }
  return null;
}
