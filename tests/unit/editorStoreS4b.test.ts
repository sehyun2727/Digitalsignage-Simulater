import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';
import {
  createEmptyDocument,
  DEFAULT_OCCLUSION_FEATHER,
  DEFAULT_OCCLUSION_OPACITY,
  type DisplaySignageObject,
  type PortableSignageObject,
} from '../../src/types/editor';

/**
 * v2-S4-b unit tests. Store-level logic for 1-1 (copy/paste/duplicate), 1-2 (aspect lock),
 * 1-3 (Fit/Cover), and the C-items (C13 asset-ref sharing, C14 Undo coverage, C19 portable
 * default lock, C22 Fit/Cover coord preservation). The e2e companion is `e2e/v2-s4b.spec.ts`
 * — this file isolates everything that is testable without a running browser.
 */

class SucceedingMockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 640;
  naturalHeight = 480;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function resetStore() {
  useEditorStore.setState({
    document: createEmptyDocument(),
    selectedId: null,
    past: [],
    future: [],
    perspectiveEditId: null,
    perspectiveDraftQuad: null,
    perspectiveEditOriginalQuad: null,
    occlusionEditObjectId: null,
    occlusionEditMaskId: null,
    occlusionDraftPoints: [],
    occlusionDraftFeather: DEFAULT_OCCLUSION_FEATHER,
    occlusionDraftOpacity: DEFAULT_OCCLUSION_OPACITY,
    clipboard: null,
  });
}

function addPhoto(sourceId = 'photo-1', width = 1920, height = 1080) {
  useEditorStore.getState().setSpaceBackground({
    sourceId,
    naturalWidth: width,
    naturalHeight: height,
    width,
    height,
    downscaled: false,
  });
}

describe('v2-S4-b 1-1 clipboard', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', SucceedingMockImage);
    resetStore();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('copies then pastes with (+20, +20) stagger and selects the new object', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const original = useEditorStore.getState().document.objects[0]! as DisplaySignageObject;
    useEditorStore.getState().copySelected();
    useEditorStore.getState().pasteFromClipboard();
    const state = useEditorStore.getState();
    expect(state.document.objects).toHaveLength(2);
    const pasted = state.document.objects[1]! as DisplaySignageObject;
    expect(pasted.id).not.toBe(original.id);
    expect(pasted.x).toBe(original.x + 20);
    expect(pasted.y).toBe(original.y + 20);
    expect(state.selectedId).toBe(pasted.id);
  });

  it('three consecutive pastes land at +20, +40, +60 from the original', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const base = useEditorStore.getState().document.objects[0]! as DisplaySignageObject;
    const store = useEditorStore.getState();
    store.copySelected();
    store.pasteFromClipboard();
    store.pasteFromClipboard();
    store.pasteFromClipboard();
    const positions = useEditorStore
      .getState()
      .document.objects.slice(1)
      .map((o) => ({ x: o.x - base.x, y: o.y - base.y }));
    expect(positions).toEqual([
      { x: 20, y: 20 },
      { x: 40, y: 40 },
      { x: 60, y: 60 },
    ]);
  });

  it('Undo removes a paste in one step; Redo restores it', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    useEditorStore.getState().copySelected();
    useEditorStore.getState().pasteFromClipboard();
    expect(useEditorStore.getState().document.objects).toHaveLength(2);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.objects).toHaveLength(1);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.objects).toHaveLength(2);
  });

  it('paste clamps the new object inside the document bounds', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const docW = 1920;
    const docH = 1080;
    const target = useEditorStore.getState().document.objects[0]! as DisplaySignageObject;
    // Move the original to the far corner so (+20, +20) would otherwise push past the edge.
    useEditorStore.getState().commitObjectChange(target.id, {
      x: docW - target.width + 5,
      y: docH - target.height + 5,
    });
    useEditorStore.getState().copySelected();
    useEditorStore.getState().pasteFromClipboard();
    const pasted = useEditorStore.getState().document.objects[1]! as DisplaySignageObject;
    expect(pasted.x).toBeLessThanOrEqual(docW - pasted.width);
    expect(pasted.y).toBeLessThanOrEqual(docH - pasted.height);
    expect(pasted.x).toBeGreaterThanOrEqual(0);
    expect(pasted.y).toBeGreaterThanOrEqual(0);
  });

  it('duplicate = copy + paste in one history entry', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const historyLen = useEditorStore.getState().past.length;
    useEditorStore.getState().duplicateSelected();
    const after = useEditorStore.getState();
    expect(after.document.objects).toHaveLength(2);
    expect(after.past.length).toBe(historyLen + 1);
    // A later Ctrl+V from this same duplicate overwrites the clipboard, so a second
    // paste shifts from the duplicated capture, not from the original stray state.
    useEditorStore.getState().pasteFromClipboard();
    expect(useEditorStore.getState().document.objects).toHaveLength(3);
  });

  it('copy of a display with content keeps the asset reference (C13)', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const target = useEditorStore.getState().document.objects[0]! as DisplaySignageObject;
    // Attach a content with a plain string sourceId (no decoded asset lookup needed to prove
    // the clone/share contract: the sourceId must stay identical between original and clone).
    useEditorStore.getState().commitObjectChange(target.id, {
      content: {
        kind: 'image',
        sourceId: 'shared-content-id',
        fit: 'contain',
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
      },
    });
    useEditorStore.getState().copySelected();
    useEditorStore.getState().pasteFromClipboard();
    const [orig, pasted] = useEditorStore.getState().document.objects as [
      DisplaySignageObject,
      DisplaySignageObject,
    ];
    expect(pasted.content).toBeDefined();
    expect(pasted.content!.kind).toBe('image');
    expect((pasted.content as { sourceId: string }).sourceId).toBe('shared-content-id');
    expect((pasted.content as { sourceId: string }).sourceId).toBe(
      (orig.content as { sourceId: string }).sourceId,
    );
  });

  it('deep copy: editing the pasted object does not touch the original', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const original = useEditorStore.getState().document.objects[0]! as DisplaySignageObject;
    useEditorStore.getState().copySelected();
    useEditorStore.getState().pasteFromClipboard();
    const pasted = useEditorStore.getState().document.objects[1]! as DisplaySignageObject;
    useEditorStore.getState().commitObjectChange(pasted.id, {
      materialSettings: { ...pasted.materialSettings, brightness: 95 },
    });
    const finalOriginal = useEditorStore
      .getState()
      .document.objects.find((o) => o.id === original.id)! as DisplaySignageObject;
    expect(finalOriginal.materialSettings.brightness).toBe(original.materialSettings.brightness);
    expect(finalOriginal.materialSettings.brightness).not.toBe(95);
  });

  it('copy + paste translates a perspective quad by the same normalized delta', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const target = useEditorStore.getState().document.objects[0]! as DisplaySignageObject;
    useEditorStore.getState().commitObjectChange(target.id, {
      placementMode: 'perspective',
      perspectiveQuad: {
        topLeft: { x: 0.1, y: 0.1 },
        topRight: { x: 0.3, y: 0.1 },
        bottomRight: { x: 0.3, y: 0.3 },
        bottomLeft: { x: 0.1, y: 0.3 },
      },
    });
    useEditorStore.getState().copySelected();
    useEditorStore.getState().pasteFromClipboard();
    const pasted = useEditorStore.getState().document.objects[1]! as DisplaySignageObject;
    const expectedDx = 20 / 1920;
    const expectedDy = 20 / 1080;
    expect(pasted.perspectiveQuad!.topLeft.x).toBeCloseTo(0.1 + expectedDx, 5);
    expect(pasted.perspectiveQuad!.topLeft.y).toBeCloseTo(0.1 + expectedDy, 5);
    expect(pasted.perspectiveQuad!.bottomRight.x).toBeCloseTo(0.3 + expectedDx, 5);
  });

  it('copySelected / pasteFromClipboard are no-ops with no selection / no clipboard', () => {
    expect(() => useEditorStore.getState().copySelected()).not.toThrow();
    expect(() => useEditorStore.getState().pasteFromClipboard()).not.toThrow();
    expect(useEditorStore.getState().document.objects).toHaveLength(0);
  });
});

describe('v2-S4-b 1-2 aspect lock', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', SucceedingMockImage);
    resetStore();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('newly added displays start with aspectLocked undefined/false', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const target = useEditorStore.getState().document.objects[0]! as DisplaySignageObject;
    expect(target.aspectLocked ?? false).toBe(false);
  });

  it('newly added portables start with aspectLocked = true (C19)', () => {
    addPhoto();
    useEditorStore.getState().addPortable();
    const target = useEditorStore.getState().document.objects[0]! as PortableSignageObject;
    expect(target.aspectLocked).toBe(true);
  });

  it('toggling aspectLocked goes through the normal commit path (Undo covers it, C14)', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const target = useEditorStore.getState().document.objects[0]! as DisplaySignageObject;
    const historyBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().commitObjectChange(target.id, { aspectLocked: true });
    expect(useEditorStore.getState().past.length).toBe(historyBefore + 1);
    const after = useEditorStore.getState().document.objects[0] as DisplaySignageObject;
    expect(after.aspectLocked).toBe(true);
    useEditorStore.getState().undo();
    const undone = useEditorStore.getState().document.objects[0] as DisplaySignageObject;
    expect(undone.aspectLocked ?? false).toBe(false);
  });
});

describe('v2-S4-b 1-3 space background fit', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', SucceedingMockImage);
    resetStore();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a freshly uploaded photo starts in Fit (contain) mode (ADR 0012 D-11)', () => {
    addPhoto();
    expect(useEditorStore.getState().document.spaceBackground!.fit).toBe('contain');
  });

  it('setSpaceBackgroundFit toggles mode, is Undo-able (C14), and keeps object coords (C22)', () => {
    addPhoto();
    useEditorStore.getState().addDisplay('led');
    const original = useEditorStore.getState().document.objects[0]! as DisplaySignageObject;
    const originalCoords = { x: original.x, y: original.y, w: original.width, h: original.height };
    useEditorStore.getState().setSpaceBackgroundFit('cover');
    const afterSwap = useEditorStore.getState();
    expect(afterSwap.document.spaceBackground!.fit).toBe('cover');
    const objAfterSwap = afterSwap.document.objects[0]! as DisplaySignageObject;
    expect({
      x: objAfterSwap.x,
      y: objAfterSwap.y,
      w: objAfterSwap.width,
      h: objAfterSwap.height,
    }).toEqual(originalCoords);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.spaceBackground!.fit).toBe('contain');
  });

  it('setSpaceBackgroundFit resets offsetY to 0 when switching to Fit', () => {
    addPhoto('tall', 1000, 3000);
    // Switch to cover first (precondition for a nonzero offsetY to be valid), then stuff a
    // nonzero offset directly via setState — the clamp inside `setSpaceBackgroundOffsetY`
    // requires a real decoded asset in the registry, which we don't have in jsdom.
    useEditorStore.getState().setSpaceBackgroundFit('cover');
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        spaceBackground: { ...state.document.spaceBackground!, offsetY: 50 },
      },
    }));
    expect(useEditorStore.getState().document.spaceBackground!.offsetY).toBe(50);
    useEditorStore.getState().setSpaceBackgroundFit('contain');
    expect(useEditorStore.getState().document.spaceBackground!.offsetY).toBe(0);
  });

  it('setSpaceBackgroundOffsetY is a no-op while in Fit mode (nothing to pan)', () => {
    addPhoto('tall', 1000, 3000);
    expect(useEditorStore.getState().document.spaceBackground!.fit).toBe('contain');
    useEditorStore.getState().setSpaceBackgroundOffsetY(999);
    expect(useEditorStore.getState().document.spaceBackground!.offsetY).toBe(0);
  });

  it('setSpaceBackgroundFit is a no-op when the mode is already the requested one', () => {
    addPhoto();
    const past = useEditorStore.getState().past.length;
    useEditorStore.getState().setSpaceBackgroundFit('contain');
    expect(useEditorStore.getState().past.length).toBe(past);
  });
});
