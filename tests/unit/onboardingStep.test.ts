import { describe, expect, it } from 'vitest';
import { getOnboardingStep } from '../../src/lib/onboardingStep';
import { createEmptyDocument } from '../../src/types/editor';
import type {
  DisplaySignageObject,
  EditorDocument,
  PortableSignageObject,
  SignageContent,
  TextSignageObject,
} from '../../src/types/editor';
import {
  DEFAULT_CONTACT_SHADOW,
  DEFAULT_CURVATURE,
  DEFAULT_ENVIRONMENT_INTEGRATION,
  DEFAULT_MATERIAL_SETTINGS,
  DEFAULT_PLACEMENT_MODE,
} from '../../src/types/editor';

const SPACE_BACKGROUND: EditorDocument['spaceBackground'] = {
  sourceId: 'space-1',
  naturalWidth: 1920,
  naturalHeight: 1080,
  width: 1920,
  height: 1080,
  downscaled: false,
};

function textObject(): TextSignageObject {
  return {
    id: 'text-1',
    kind: 'text',
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    rotation: 0,
    text: 'hello',
    fontSize: 24,
    color: '#ffffff',
    align: 'left',
  };
}

function displayObject(content: SignageContent | null): DisplaySignageObject {
  return {
    id: 'display-1',
    kind: 'display',
    x: 0,
    y: 0,
    width: 480,
    height: 270,
    rotation: 0,
    frameId: 'wall-led',
    content,
    material: 'led',
    materialSettings: DEFAULT_MATERIAL_SETTINGS,
    curvature: { ...DEFAULT_CURVATURE },
    placementMode: DEFAULT_PLACEMENT_MODE,
    perspectiveQuad: null,
    contactShadow: { ...DEFAULT_CONTACT_SHADOW },
    environmentIntegration: { ...DEFAULT_ENVIRONMENT_INTEGRATION },
    installationMode: 'wall',
    occlusionMasks: [],
  };
}

function portableObject(content: SignageContent | null): PortableSignageObject {
  return {
    id: 'portable-1',
    kind: 'portable',
    x: 0,
    y: 0,
    width: 220,
    height: 420,
    rotation: 0,
    templateView: 'angled-right',
    content,
    material: 'lcd',
    materialSettings: DEFAULT_MATERIAL_SETTINGS,
    curvature: { ...DEFAULT_CURVATURE },
    placementMode: DEFAULT_PLACEMENT_MODE,
    perspectiveQuad: null,
    contactShadow: { ...DEFAULT_CONTACT_SHADOW },
    environmentIntegration: { ...DEFAULT_ENVIRONMENT_INTEGRATION },
    installationMode: 'freestanding',
    occlusionMasks: [],
    productPhotoSourceId: null,
    screenQuad: null,
  };
}

const IMAGE_CONTENT: SignageContent = {
  kind: 'image',
  sourceId: 'content-1',
  fit: 'contain',
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};

const VIDEO_CONTENT: SignageContent = { ...IMAGE_CONTENT, kind: 'video', sourceId: 'content-2' };

describe('getOnboardingStep', () => {
  it('returns step 1 when there is no space background', () => {
    expect(getOnboardingStep(createEmptyDocument())).toBe(1);
  });

  it('returns step 2 when a space background exists but no signage is placed', () => {
    const document: EditorDocument = {
      ...createEmptyDocument(),
      spaceBackground: SPACE_BACKGROUND,
    };
    expect(getOnboardingStep(document)).toBe(2);
  });

  it('returns step 2 when only non-signage objects (text/image) are placed', () => {
    const document: EditorDocument = {
      ...createEmptyDocument(),
      spaceBackground: SPACE_BACKGROUND,
      objects: [textObject()],
    };
    expect(getOnboardingStep(document)).toBe(2);
  });

  it('returns step 3 when a display exists with no content', () => {
    const document: EditorDocument = {
      ...createEmptyDocument(),
      spaceBackground: SPACE_BACKGROUND,
      objects: [displayObject(null)],
    };
    expect(getOnboardingStep(document)).toBe(3);
  });

  it('returns step 3 when a portable exists with no content', () => {
    const document: EditorDocument = {
      ...createEmptyDocument(),
      spaceBackground: SPACE_BACKGROUND,
      objects: [portableObject(null)],
    };
    expect(getOnboardingStep(document)).toBe(3);
  });

  it('returns step 4 when a display has image content', () => {
    const document: EditorDocument = {
      ...createEmptyDocument(),
      spaceBackground: SPACE_BACKGROUND,
      objects: [displayObject(IMAGE_CONTENT)],
    };
    expect(getOnboardingStep(document)).toBe(4);
  });

  it('returns step 4 when a portable has video content', () => {
    const document: EditorDocument = {
      ...createEmptyDocument(),
      spaceBackground: SPACE_BACKGROUND,
      objects: [portableObject(VIDEO_CONTENT)],
    };
    expect(getOnboardingStep(document)).toBe(4);
  });

  it('returns step 4 when at least one of several signage objects has content', () => {
    const document: EditorDocument = {
      ...createEmptyDocument(),
      spaceBackground: SPACE_BACKGROUND,
      objects: [displayObject(null), portableObject(IMAGE_CONTENT)],
    };
    expect(getOnboardingStep(document)).toBe(4);
  });
});
