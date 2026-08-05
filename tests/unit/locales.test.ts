import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../src/i18n/locales';
import { SUPPORTED_LOCALES } from '../../src/types/i18n';

describe('locale resources', () => {
  it('defines a message set for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(MESSAGES[locale]).toBeDefined();
    }
  });

  it('has matching message keys across all supported locales', () => {
    const [first, ...rest] = SUPPORTED_LOCALES;
    const referenceKeys = Object.keys(MESSAGES[first]).sort();

    for (const locale of rest) {
      expect(Object.keys(MESSAGES[locale]).sort()).toEqual(referenceKeys);
    }
  });

  it('has a localized display name for every supported locale in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const target of SUPPORTED_LOCALES) {
        expect(MESSAGES[locale].localeName[target]).toBeTruthy();
      }
    }
  });
});
