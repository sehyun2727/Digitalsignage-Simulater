import { describe, expect, it } from 'vitest';
import {
  detectActivePreset,
  getPresetContactShadow,
  getPresetEnvironmentIntegration,
  getPresetMaterialSettings,
  RENDERING_PRESET_IDS,
  resolvePresetPatch,
} from '../../src/lib/renderingPresets';

describe('getPresetMaterialSettings', () => {
  it('returns a distinct baseline per material for the natural preset', () => {
    const led = getPresetMaterialSettings('led', 'natural');
    const lcd = getPresetMaterialSettings('lcd', 'natural');
    const transparentLed = getPresetMaterialSettings('transparent-led', 'natural');

    expect(led).not.toEqual(lcd);
    expect(led).not.toEqual(transparentLed);
    expect(lcd.glow).toBe(0);
    expect(lcd.gridDensity).toBe(0);
    expect(transparentLed.transparency).toBeGreaterThan(0);
  });

  it('normalizes the legacy outdoor-led value the same as led', () => {
    expect(getPresetMaterialSettings('outdoor-led', 'natural')).toEqual(
      getPresetMaterialSettings('led', 'natural'),
    );
  });

  it('brightens and raises contrast for the bright preset relative to natural', () => {
    const natural = getPresetMaterialSettings('led', 'natural');
    const bright = getPresetMaterialSettings('led', 'bright');
    expect(bright.brightness).toBeGreaterThan(natural.brightness);
    expect(bright.contrast).toBeGreaterThan(natural.contrast);
  });

  it('dims and boosts glow for the night preset relative to natural', () => {
    const natural = getPresetMaterialSettings('led', 'natural');
    const night = getPresetMaterialSettings('led', 'night');
    expect(night.brightness).toBeLessThan(natural.brightness);
    expect(night.glow).toBeGreaterThan(natural.glow);
  });

  it('keeps every value within the 0-100 slider range for every material/preset pair', () => {
    const materials = ['led', 'lcd', 'transparent-led'] as const;
    for (const material of materials) {
      for (const preset of RENDERING_PRESET_IDS) {
        const settings = getPresetMaterialSettings(material, preset);
        for (const value of Object.values(settings)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe('getPresetContactShadow', () => {
  it('resolves a wall-mode shadow for a non-transparent display', () => {
    const shadow = getPresetContactShadow('display', 'led', 'natural');
    expect(shadow.enabled).toBe(true);
    expect(shadow.offsetY).toBeCloseTo(0.035);
  });

  it('resolves a window-mode (fainter) shadow for a transparent-led display', () => {
    const wall = getPresetContactShadow('display', 'led', 'natural');
    const window = getPresetContactShadow('display', 'transparent-led', 'natural');
    expect(window.strength).toBeLessThan(wall.strength);
  });

  it('resolves a freestanding shadow for a portable object', () => {
    const freestanding = getPresetContactShadow('portable', 'lcd', 'natural');
    expect(freestanding.enabled).toBe(true);
    expect(freestanding.offsetY).toBeGreaterThan(0.035);
  });

  it('makes the bright preset shadow stronger and the night preset fainter than natural', () => {
    const natural = getPresetContactShadow('display', 'led', 'natural');
    const bright = getPresetContactShadow('display', 'led', 'bright');
    const night = getPresetContactShadow('display', 'led', 'night');
    expect(bright.strength).toBeGreaterThan(natural.strength);
    expect(night.strength).toBeLessThan(natural.strength);
  });
});

describe('getPresetEnvironmentIntegration', () => {
  it('gives every preset a strength within 0-100', () => {
    for (const preset of RENDERING_PRESET_IDS) {
      const { strength } = getPresetEnvironmentIntegration(preset);
      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(100);
    }
  });

  it('blends the bright preset the most and the night preset the least', () => {
    const bright = getPresetEnvironmentIntegration('bright').strength;
    const natural = getPresetEnvironmentIntegration('natural').strength;
    const night = getPresetEnvironmentIntegration('night').strength;
    expect(bright).toBeGreaterThan(natural);
    expect(night).toBeLessThan(natural);
  });
});

describe('resolvePresetPatch', () => {
  it('bundles all three resolved value groups consistently with the individual getters', () => {
    const patch = resolvePresetPatch('display', 'led', 'bright');
    expect(patch.materialSettings).toEqual(getPresetMaterialSettings('led', 'bright'));
    expect(patch.contactShadow).toEqual(getPresetContactShadow('display', 'led', 'bright'));
    expect(patch.environmentIntegration).toEqual(getPresetEnvironmentIntegration('bright'));
  });
});

describe('detectActivePreset', () => {
  it('detects the preset an object was just seeded from', () => {
    for (const preset of RENDERING_PRESET_IDS) {
      const patch = resolvePresetPatch('display', 'led', preset);
      expect(
        detectActivePreset(
          'display',
          'led',
          patch.materialSettings,
          patch.contactShadow,
          patch.environmentIntegration,
        ),
      ).toBe(preset);
    }
  });

  it('returns null once the user hand-edits a value away from every preset', () => {
    const patch = resolvePresetPatch('display', 'led', 'natural');
    const edited = { ...patch.materialSettings, intensity: 7 };
    expect(
      detectActivePreset('display', 'led', edited, patch.contactShadow, patch.environmentIntegration),
    ).toBeNull();
  });
});
