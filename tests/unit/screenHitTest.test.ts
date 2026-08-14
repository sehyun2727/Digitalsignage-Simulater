import { describe, expect, it } from 'vitest';
import {
  findTopmostScreenHit,
  getObjectScreenRect,
  isPointOnObjectScreen,
  rectContainsPoint,
  toLocalPoint,
} from '../../src/lib/screenHitTest';
import { getScreenRect } from '../../src/lib/displayFrame';
import { resolveScreenRegionRect } from '../../src/lib/contentLayout';
import {
  DEFAULT_CONTACT_SHADOW,
  DEFAULT_CURVATURE,
  DEFAULT_ENVIRONMENT_INTEGRATION,
  DEFAULT_MATERIAL_SETTINGS,
  type DisplaySignageObject,
  type PortableSignageObject,
  type TextSignageObject,
} from '../../src/types/editor';

const display: DisplaySignageObject = {
  id: 'display-1',
  kind: 'display',
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  rotation: 0,
  frameId: 'wall-led',
  content: null,
  material: 'led',
  materialSettings: DEFAULT_MATERIAL_SETTINGS,
  curvature: DEFAULT_CURVATURE,
  placementMode: 'rect',
  perspectiveQuad: null,
  contactShadow: DEFAULT_CONTACT_SHADOW,
  environmentIntegration: DEFAULT_ENVIRONMENT_INTEGRATION,
  installationMode: 'wall',
  occlusionMasks: [],
};

const portable: PortableSignageObject = {
  id: 'portable-1',
  kind: 'portable',
  x: 0,
  y: 0,
  width: 300,
  height: 200,
  rotation: 0,
  productSourceId: 'source-1',
  productIntrinsicWidth: 600,
  productIntrinsicHeight: 400,
  productHasAlpha: false,
  screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
  content: null,
  material: 'lcd',
  materialSettings: DEFAULT_MATERIAL_SETTINGS,
  curvature: DEFAULT_CURVATURE,
  placementMode: 'rect',
  perspectiveQuad: null,
  contactShadow: DEFAULT_CONTACT_SHADOW,
  environmentIntegration: DEFAULT_ENVIRONMENT_INTEGRATION,
  installationMode: 'freestanding',
  occlusionMasks: [],
};

const text: TextSignageObject = {
  id: 'text-1',
  kind: 'text',
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  rotation: 0,
  text: 'hello',
  fontSize: 16,
  color: '#000000',
  align: 'left',
};

const documentSize = { width: 1000, height: 1000 };

describe('toLocalPoint', () => {
  it('is a plain translation when rotation is 0', () => {
    expect(toLocalPoint({ x: 130, y: 150 }, { x: 100, y: 100, rotation: 0 })).toEqual({
      x: 30,
      y: 50,
    });
  });

  it('inverse-rotates around the object origin for a 90-degree rotation', () => {
    // Forward-rotating local (100, 50) by 90deg around origin (100, 100) lands at world
    // (50, 200); toLocalPoint must map that world point back to the original local point.
    const local = toLocalPoint({ x: 50, y: 200 }, { x: 100, y: 100, rotation: 90 });
    expect(local.x).toBeCloseTo(100);
    expect(local.y).toBeCloseTo(50);
  });
});

describe('rectContainsPoint', () => {
  it('includes points exactly on the rect boundary', () => {
    const rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectContainsPoint(rect, { x: 0, y: 0 })).toBe(true);
    expect(rectContainsPoint(rect, { x: 10, y: 10 })).toBe(true);
  });

  it('excludes points outside the rect', () => {
    const rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectContainsPoint(rect, { x: 10.1, y: 5 })).toBe(false);
    expect(rectContainsPoint(rect, { x: 5, y: -0.1 })).toBe(false);
  });
});

describe('getObjectScreenRect', () => {
  it('matches getScreenRect for a display object', () => {
    expect(getObjectScreenRect(display)).toEqual(
      getScreenRect(display.frameId, display.width, display.height),
    );
  });

  it('matches resolveScreenRegionRect for a portable object', () => {
    expect(getObjectScreenRect(portable)).toEqual(
      resolveScreenRegionRect(
        { width: portable.width, height: portable.height },
        { shape: 'rect', ...portable.screenRegion },
      ),
    );
  });

  it('returns null for object kinds with no screen region', () => {
    expect(getObjectScreenRect(text)).toBeNull();
  });
});

describe('isPointOnObjectScreen', () => {
  it('is true for a point inside the unrotated screen area', () => {
    // wall-led screen region is {x:0.02, y:0.02, w:0.96, h:0.96} of a 200x100 object, so its
    // center (100, 50 local) is well inside the screen, away from the bezel.
    expect(
      isPointOnObjectScreen(display, { x: display.x + 100, y: display.y + 50 }, documentSize),
    ).toBe(true);
  });

  it('is false for a point on the bezel, inside the object bounds but outside the screen', () => {
    expect(
      isPointOnObjectScreen(display, { x: display.x + 1, y: display.y + 1 }, documentSize),
    ).toBe(false);
  });

  it('is false for a point entirely outside the object bounds', () => {
    expect(isPointOnObjectScreen(display, { x: 10000, y: 10000 }, documentSize)).toBe(false);
  });

  it('accounts for rotation when testing a point against the screen area', () => {
    const rotated = { ...display, rotation: 90 };
    // The point that hits the unrotated screen center no longer does once rotated...
    expect(
      isPointOnObjectScreen(rotated, { x: display.x + 100, y: display.y + 50 }, documentSize),
    ).toBe(false);
    // ...but the forward-rotated equivalent of that same local point does.
    expect(isPointOnObjectScreen(rotated, { x: 50, y: 200 }, documentSize)).toBe(true);
  });

  it('is false for object kinds with no screen region', () => {
    expect(isPointOnObjectScreen(text, { x: 20, y: 20 }, documentSize)).toBe(false);
  });

  it('tests a perspective-mode object against its quad, in absolute document coordinates, ignoring x/y/rotation/frame', () => {
    const perspectiveDisplay: DisplaySignageObject = {
      ...display,
      // Deliberately mismatched rect fields, to prove the quad (not the rect+rotation path) is
      // what gets tested once placementMode is 'perspective'.
      x: 9999,
      y: 9999,
      rotation: 45,
      placementMode: 'perspective',
      perspectiveQuad: {
        topLeft: { x: 0.1, y: 0.1 },
        topRight: { x: 0.5, y: 0.1 },
        bottomRight: { x: 0.5, y: 0.5 },
        bottomLeft: { x: 0.1, y: 0.5 },
      },
    };

    // (300, 300) in document space is (0.3, 0.3) normalized — inside the quad.
    expect(isPointOnObjectScreen(perspectiveDisplay, { x: 300, y: 300 }, documentSize)).toBe(true);
    // (700, 700) is (0.7, 0.7) normalized — outside the quad.
    expect(isPointOnObjectScreen(perspectiveDisplay, { x: 700, y: 700 }, documentSize)).toBe(false);
  });

  it('falls back to the rect+rotation hit test when placementMode is perspective but no quad has been applied yet', () => {
    const notYetFitted: DisplaySignageObject = { ...display, placementMode: 'perspective' };
    expect(
      isPointOnObjectScreen(notYetFitted, { x: display.x + 100, y: display.y + 50 }, documentSize),
    ).toBe(true);
  });
});

describe('findTopmostScreenHit', () => {
  it('returns the last (topmost) overlapping object whose screen contains the point', () => {
    const back: DisplaySignageObject = { ...display, id: 'back' };
    const front: DisplaySignageObject = { ...display, id: 'front' };
    const point = { x: display.x + 100, y: display.y + 50 };

    expect(findTopmostScreenHit([back, front], point, documentSize)).toBe('front');
  });

  it('returns null when no object screen contains the point', () => {
    expect(
      findTopmostScreenHit([display, portable], { x: -9999, y: -9999 }, documentSize),
    ).toBeNull();
  });

  it('returns null for an empty object list', () => {
    expect(findTopmostScreenHit([], { x: 0, y: 0 }, documentSize)).toBeNull();
  });
});
