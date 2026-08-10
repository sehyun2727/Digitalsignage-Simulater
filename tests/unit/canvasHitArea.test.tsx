import type { ReactElement, ReactNode } from 'react';
import { Rect } from 'react-konva';
import { describe, expect, it } from 'vitest';
import { PortableProductView } from '../../src/features/editor/PortableProductView';
import { SignageDisplayView } from '../../src/features/editor/SignageDisplayView';
import {
  DEFAULT_MATERIAL_SETTINGS,
  type DisplaySignageObject,
  type PortableSignageObject,
} from '../../src/types/editor';

// SignageDisplayView/PortableProductView are plain functions that return a Konva element tree;
// calling them directly (instead of mounting through react-konva's Stage-bound renderer) lets
// this suite assert on that tree's shape without a real <canvas> 2D context, which jsdom does
// not provide. Real click/tap hit-testing against the shape this test locates is covered by the
// Playwright reselection specs, which run in an actual Chromium canvas.
function findAllByType(node: ReactNode, type: unknown): ReactElement[] {
  const matches: ReactElement[] = [];
  const stack: ReactNode[] = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || current === undefined || typeof current !== 'object') continue;

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    const element = current as ReactElement<{ children?: ReactNode }>;
    if (element.type === type) matches.push(element);

    const children = element.props?.children;
    if (children !== undefined) stack.push(children);
  }

  return matches;
}

function findHitArea(tree: ReactElement, name: string): ReactElement<Record<string, unknown>> {
  const rects = findAllByType(tree, Rect) as ReactElement<Record<string, unknown>>[];
  const hitArea = rects.find((rect) => rect.props.name === name);
  if (!hitArea) throw new Error(`no Rect named "${name}" found in the rendered tree`);
  return hitArea;
}

const groupProps = { id: 'obj-1', draggable: true };

describe('canvas object hit-area (reselection fix)', () => {
  it('gives a Wall LED display a listening, transparent, full-bounds hit rect', () => {
    const object: DisplaySignageObject = {
      id: 'obj-1',
      kind: 'display',
      x: 0,
      y: 0,
      width: 480,
      height: 270,
      rotation: 0,
      frameId: 'wall-led',
      content: null,
      material: 'outdoor-led',
      materialSettings: DEFAULT_MATERIAL_SETTINGS,
    };

    const tree = SignageDisplayView({ object, groupProps });
    const hitArea = findHitArea(tree, 'display-hit-area');

    expect(hitArea.props).toMatchObject({
      x: 0,
      y: 0,
      width: object.width,
      height: object.height,
      fill: 'transparent',
      listening: true,
    });
  });

  it('gives a Stand Display a listening, transparent, full-bounds hit rect', () => {
    const object: DisplaySignageObject = {
      id: 'obj-2',
      kind: 'display',
      x: 0,
      y: 0,
      width: 220,
      height: 420,
      rotation: 0,
      frameId: 'stand-display',
      content: null,
      material: 'lcd',
      materialSettings: DEFAULT_MATERIAL_SETTINGS,
    };

    const tree = SignageDisplayView({ object, groupProps });
    const hitArea = findHitArea(tree, 'display-hit-area');

    expect(hitArea.props).toMatchObject({
      width: object.width,
      height: object.height,
      fill: 'transparent',
      listening: true,
    });
  });

  it('gives a portable product a full-bounds hit rect regardless of the photo having alpha', () => {
    const object: PortableSignageObject = {
      id: 'obj-3',
      kind: 'portable',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      rotation: 0,
      productSourceId: 'unregistered-source',
      productIntrinsicWidth: 600,
      productIntrinsicHeight: 400,
      // A transparent product photo must still use the object's rectangular bounds as its hit
      // area, never the photo's own alpha channel — alpha-aware hit testing is out of scope.
      productHasAlpha: true,
      screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
      content: null,
      material: 'lcd',
      materialSettings: DEFAULT_MATERIAL_SETTINGS,
    };

    const tree = PortableProductView({ object, groupProps });
    const hitArea = findHitArea(tree, 'portable-hit-area');

    expect(hitArea.props).toMatchObject({
      x: 0,
      y: 0,
      width: object.width,
      height: object.height,
      fill: 'transparent',
      listening: true,
    });
  });

  it('places the hit rect as the first Group child, so decorative shapes still paint on top', () => {
    const object: DisplaySignageObject = {
      id: 'obj-4',
      kind: 'display',
      x: 0,
      y: 0,
      width: 480,
      height: 270,
      rotation: 0,
      frameId: 'wall-led',
      content: null,
      material: 'outdoor-led',
      materialSettings: DEFAULT_MATERIAL_SETTINGS,
    };

    const tree = SignageDisplayView({ object, groupProps }) as ReactElement<{
      children?: ReactNode;
    }>;
    const groupChildren = tree.props.children;
    const firstChild = Array.isArray(groupChildren) ? groupChildren[0] : groupChildren;

    expect((firstChild as ReactElement<Record<string, unknown>>).props.name).toBe(
      'display-hit-area',
    );
  });
});
