import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegisteredAsset, registerAsset } from '../../src/lib/assetRegistry';
import {
  selectCanRedo,
  selectCanUndo,
  selectSelectedObject,
  useEditorStore,
} from '../../src/store/editorStore';
import { createEmptyDocument, DEFAULT_CURVATURE, DEFAULT_MATERIAL_SETTINGS } from '../../src/types/editor';

class SucceedingMockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 640;
  naturalHeight = 480;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function createFile(name = 'photo.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
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
  });
}

// Document/export size is derived entirely from the space background photo (see ADR 0007), so
// every object-adding action no-ops until one exists. Tests that need objects must call this
// first.
function addSpaceBackground(sourceId = 'src-1', width = 1000, height = 500) {
  useEditorStore.getState().setSpaceBackground({
    sourceId,
    naturalWidth: width,
    naturalHeight: height,
    width,
    height,
    downscaled: false,
  });
}

describe('editorStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with an empty document and no history', () => {
    const state = useEditorStore.getState();

    expect(state.document.objects).toHaveLength(0);
    expect(state.document.spaceBackground).toBeNull();
    expect(selectCanUndo(state)).toBe(false);
    expect(selectCanRedo(state)).toBe(false);
  });

  it('does not add objects before a space background exists', () => {
    useEditorStore.getState().addText();
    useEditorStore
      .getState()
      .addImage({ src: 'blob:mock', naturalWidth: 100, naturalHeight: 100 });
    useEditorStore.getState().addDisplay('led');
    useEditorStore.getState().addPortable({
      productSourceId: 'product-src-1',
      productIntrinsicWidth: 100,
      productIntrinsicHeight: 100,
      productHasAlpha: null,
      screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });

    const state = useEditorStore.getState();
    expect(state.document.objects).toHaveLength(0);
    expect(selectCanUndo(state)).toBe(false);
  });

  it('adds a text object, selects it, and makes undo available', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const state = useEditorStore.getState();

    expect(state.document.objects).toHaveLength(1);
    expect(state.document.objects[0]?.kind).toBe('text');
    expect(state.selectedId).toBe(state.document.objects[0]?.id);
    expect(selectCanUndo(state)).toBe(true);
  });

  it('adds an image object scaled to fit within the document', () => {
    addSpaceBackground();
    useEditorStore
      .getState()
      .addImage({ src: 'blob:mock', naturalWidth: 4000, naturalHeight: 2000 });
    const state = useEditorStore.getState();
    const image = state.document.objects[0];

    expect(image?.kind).toBe('image');
    if (image?.kind === 'image') {
      expect(image.width).toBeLessThan(4000);
      expect(image.width / image.height).toBeCloseTo(4000 / 2000);
    }
  });

  it('selects and deselects objects', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().selectObject(null);
    expect(useEditorStore.getState().selectedId).toBeNull();

    useEditorStore.getState().selectObject(id);
    expect(useEditorStore.getState().selectedId).toBe(id);
    expect(selectSelectedObject(useEditorStore.getState())?.id).toBe(id);
  });

  it('selects a different object without needing to deselect first, and never pushes history', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const firstId = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().addDisplay('led');
    const secondId = useEditorStore.getState().document.objects[1]!.id;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().selectObject(firstId);
    expect(useEditorStore.getState().selectedId).toBe(firstId);

    // Reselecting the second object directly (as a click on its rendered shape would, without
    // an intermediate blank-canvas deselect) must update selectedId in one step.
    useEditorStore.getState().selectObject(secondId);
    expect(useEditorStore.getState().selectedId).toBe(secondId);

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
  });

  it('clears the selection on undo and redo, so a subsequent click is a fresh reselection', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().commitObjectChange(id, { x: 500, y: 400 });
    useEditorStore.getState().selectObject(id);
    expect(useEditorStore.getState().selectedId).toBe(id);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().selectedId).toBeNull();

    useEditorStore.getState().selectObject(id);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  it('a drag-style position commit pushes exactly one history entry', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().commitObjectChange(id, { x: 123, y: 456 });

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);
  });

  it('commits object changes to history and undo restores the previous state', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().commitObjectChange(id, { x: 500, y: 400 });
    expect(useEditorStore.getState().document.objects[0]).toMatchObject({ x: 500, y: 400 });

    useEditorStore.getState().undo();
    const afterUndo = useEditorStore.getState().document.objects[0];
    expect(afterUndo?.x).not.toBe(500);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.objects[0]).toMatchObject({ x: 500, y: 400 });
  });

  it('updateObjectTransient does not push history entries', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().updateObjectTransient(id, { x: 999 });

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
    expect(useEditorStore.getState().document.objects[0]?.x).toBe(999);
  });

  it('deletes the selected object and commits history', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    useEditorStore.getState().deleteSelected();

    const state = useEditorStore.getState();
    expect(state.document.objects).toHaveLength(0);
    expect(state.selectedId).toBeNull();
    expect(selectCanUndo(state)).toBe(true);
  });

  it('undo/redo are no-ops when there is nothing to undo/redo', () => {
    useEditorStore.getState().undo();
    useEditorStore.getState().redo();

    expect(useEditorStore.getState().document.objects).toHaveLength(0);
  });

  it('commits a resize change to history and undo/redo restore it', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().commitObjectChange(id, { width: 500, height: 200 });
    expect(useEditorStore.getState().document.objects[0]).toMatchObject({
      width: 500,
      height: 200,
    });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.objects[0]?.width).not.toBe(500);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.objects[0]).toMatchObject({
      width: 500,
      height: 200,
    });
  });

  it('commits a rotation change to history and undo/redo restore it', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().commitObjectChange(id, { rotation: 45 });
    expect(useEditorStore.getState().document.objects[0]).toMatchObject({ rotation: 45 });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.objects[0]?.rotation).not.toBe(45);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.objects[0]).toMatchObject({ rotation: 45 });
  });

  it('committing a patch with no actual value change does not push a history entry', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;
    const { x, y } = useEditorStore.getState().document.objects[0]!;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().commitObjectChange(id, { x, y });

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
  });

  it('a new commit after undo clears the redo stack', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().commitObjectChange(id, { x: 500, y: 400 });

    useEditorStore.getState().undo();
    expect(selectCanRedo(useEditorStore.getState())).toBe(true);

    useEditorStore.getState().commitObjectChange(id, { x: 700, y: 300 });
    expect(selectCanRedo(useEditorStore.getState())).toBe(false);
  });

  it('adds a display object with the given material and no content', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const state = useEditorStore.getState();
    const display = state.document.objects[0];

    expect(display?.kind).toBe('display');
    if (display?.kind === 'display') {
      expect(display.frameId).toBe('wall-led');
      expect(display.material).toBe('led');
      expect(display.materialSettings).toEqual(DEFAULT_MATERIAL_SETTINGS);
      expect(display.curvature).toEqual(DEFAULT_CURVATURE);
      expect(display.content).toBeNull();
    }
    expect(state.selectedId).toBe(display?.id);
    expect(selectCanUndo(state)).toBe(true);
  });

  it('adds a display object defaulting to the LCD material', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('lcd');
    const display = useEditorStore.getState().document.objects[0];

    expect(display?.kind).toBe('display');
    if (display?.kind === 'display') {
      expect(display.material).toBe('lcd');
    }
  });

  it('adds and replaces a space background, both committing history', () => {
    addSpaceBackground('src-1', 1000, 500);
    expect(useEditorStore.getState().document.spaceBackground).toEqual({
      sourceId: 'src-1',
      naturalWidth: 1000,
      naturalHeight: 500,
      width: 1000,
      height: 500,
      downscaled: false,
    });
    expect(selectCanUndo(useEditorStore.getState())).toBe(true);

    useEditorStore.getState().removeSpaceBackground();
    expect(useEditorStore.getState().document.spaceBackground).toBeNull();
  });

  it('removeSpaceBackground is a no-op when there is no space background', () => {
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().removeSpaceBackground();

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
  });

  it('removeSpaceBackground clears objects too, and a single undo restores both', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    expect(useEditorStore.getState().document.objects).toHaveLength(1);

    useEditorStore.getState().removeSpaceBackground();
    const cleared = useEditorStore.getState();
    expect(cleared.document.spaceBackground).toBeNull();
    expect(cleared.document.objects).toHaveLength(0);

    useEditorStore.getState().undo();
    const restored = useEditorStore.getState();
    expect(restored.document.spaceBackground).not.toBeNull();
    expect(restored.document.objects).toHaveLength(1);
  });

  it('replacing a space background re-normalizes existing object geometry to the new size', () => {
    addSpaceBackground('src-1', 1000, 500);
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().commitObjectChange(id, { x: 100, y: 50, width: 200, height: 100 });

    useEditorStore.getState().setSpaceBackground({
      sourceId: 'src-2',
      naturalWidth: 2000,
      naturalHeight: 1000,
      width: 2000,
      height: 1000,
      downscaled: false,
    });

    const display = useEditorStore.getState().document.objects[0]!;
    // Original center fraction was (100+100)/1000 = 0.2 horizontally and (50+50)/500 = 0.2
    // vertically; that fraction (and the size fraction) must be preserved at the new size.
    expect((display.x + display.width / 2) / 2000).toBeCloseTo(0.2);
    expect((display.y + display.height / 2) / 1000).toBeCloseTo(0.2);
    expect(display.width / 2000).toBeCloseTo(200 / 1000);
    expect(display.height / 1000).toBeCloseTo(100 / 500);
  });

  it('replacing a space background leaves an applied perspective quad untouched', () => {
    addSpaceBackground('src-1', 1000, 500);
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().beginPerspectiveEdit(id);
    const draft = {
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.9, y: 0.15 },
      bottomRight: { x: 0.85, y: 0.9 },
      bottomLeft: { x: 0.15, y: 0.85 },
    };
    useEditorStore.getState().updatePerspectiveDraft(draft);
    useEditorStore.getState().applyPerspectiveEdit();

    // A different resolution and aspect ratio than the original photo: since the quad is stored
    // as fractions of the document (0-1), it must survive the swap byte-for-byte rather than
    // being remapped like x/y/width/height are.
    useEditorStore.getState().setSpaceBackground({
      sourceId: 'src-2',
      naturalWidth: 1600,
      naturalHeight: 2400,
      width: 1600,
      height: 2400,
      downscaled: false,
    });

    const display = useEditorStore.getState().document.objects[0]!;
    expect(display).toMatchObject({ placementMode: 'perspective', perspectiveQuad: draft });
  });

  it('commits a content patch on a display object and undo/redo restore it', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().commitObjectChange(id, {
      content: {
        kind: 'image',
        sourceId: 'src-1',
        fit: 'contain',
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      },
    });
    const display = useEditorStore.getState().document.objects[0];
    expect(display?.kind === 'display' && display.content?.sourceId).toBe('src-1');

    useEditorStore.getState().undo();
    const afterUndo = useEditorStore.getState().document.objects[0];
    expect(afterUndo?.kind === 'display' && afterUndo.content).toBeNull();

    useEditorStore.getState().redo();
    const afterRedo = useEditorStore.getState().document.objects[0];
    expect(afterRedo?.kind === 'display' && afterRedo.content?.sourceId).toBe('src-1');
  });

  it('committing an identical materialSettings patch does not push a history entry', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore
      .getState()
      .commitObjectChange(id, { materialSettings: { ...DEFAULT_MATERIAL_SETTINGS } });

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
  });

  it('adds a portable object centered in the document, defaulting to LCD and no content', () => {
    addSpaceBackground();
    useEditorStore.getState().addPortable({
      productSourceId: 'product-src-1',
      productIntrinsicWidth: 400,
      productIntrinsicHeight: 800,
      productHasAlpha: true,
      screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });
    const state = useEditorStore.getState();
    const portable = state.document.objects[0];

    expect(portable?.kind).toBe('portable');
    if (portable?.kind === 'portable') {
      expect(portable.productSourceId).toBe('product-src-1');
      expect(portable.productHasAlpha).toBe(true);
      expect(portable.screenRegion).toEqual({ x: 0.2, y: 0.2, width: 0.6, height: 0.6 });
      expect(portable.material).toBe('lcd');
      expect(portable.materialSettings).toEqual(DEFAULT_MATERIAL_SETTINGS);
      expect(portable.curvature).toEqual(DEFAULT_CURVATURE);
      expect(portable.content).toBeNull();
      expect(portable.width / portable.height).toBeCloseTo(400 / 800);
    }
    expect(state.selectedId).toBe(portable?.id);
    expect(selectCanUndo(state)).toBe(true);
  });

  it('undo/redo restores a deleted portable object', () => {
    addSpaceBackground();
    useEditorStore.getState().addPortable({
      productSourceId: 'product-src-1',
      productIntrinsicWidth: 400,
      productIntrinsicHeight: 800,
      productHasAlpha: null,
      screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });
    useEditorStore.getState().deleteSelected();
    expect(useEditorStore.getState().document.objects).toHaveLength(0);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.objects[0]?.kind).toBe('portable');
  });

  it('committing an identical screenRegion patch does not push a history entry', () => {
    addSpaceBackground();
    useEditorStore.getState().addPortable({
      productSourceId: 'product-src-1',
      productIntrinsicWidth: 400,
      productIntrinsicHeight: 800,
      productHasAlpha: null,
      screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });
    const id = useEditorStore.getState().document.objects[0]!.id;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore
      .getState()
      .commitObjectChange(id, { screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 } });

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
  });

  it('committing a changed screenRegion patch pushes history and undo/redo restore it', () => {
    addSpaceBackground();
    useEditorStore.getState().addPortable({
      productSourceId: 'product-src-1',
      productIntrinsicWidth: 400,
      productIntrinsicHeight: 800,
      productHasAlpha: null,
      screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore
      .getState()
      .commitObjectChange(id, { screenRegion: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 } });
    const portable = useEditorStore.getState().document.objects[0];
    expect(portable?.kind === 'portable' && portable.screenRegion).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.4,
    });

    useEditorStore.getState().undo();
    const afterUndo = useEditorStore.getState().document.objects[0];
    expect(afterUndo?.kind === 'portable' && afterUndo.screenRegion).toEqual({
      x: 0.2,
      y: 0.2,
      width: 0.6,
      height: 0.6,
    });

    useEditorStore.getState().redo();
    const afterRedo = useEditorStore.getState().document.objects[0];
    expect(afterRedo?.kind === 'portable' && afterRedo.screenRegion).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.4,
    });
  });
});

describe('editorStore asset lifecycle', () => {
  beforeEach(() => {
    resetStore();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${Math.random()}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('Image', SucceedingMockImage as unknown as typeof Image);
  });

  afterEach(() => {
    resetStore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function attachAsSpaceBackground(asset: {
    sourceId: string;
    naturalWidth: number;
    naturalHeight: number;
  }) {
    useEditorStore.getState().setSpaceBackground({
      ...asset,
      width: asset.naturalWidth,
      height: asset.naturalHeight,
      downscaled: false,
    });
  }

  it('keeps a space background asset registered while it is reachable from the document', async () => {
    const asset = await registerAsset(createFile());
    attachAsSpaceBackground(asset);

    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();
  });

  it('revokes a space background asset once it is removed and no longer reachable from history', async () => {
    const asset = await registerAsset(createFile());
    attachAsSpaceBackground(asset);
    useEditorStore.getState().removeSpaceBackground();

    // The removal is still in `past`, so the asset stays reachable until that history is gone.
    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();

    resetStore();
    expect(getRegisteredAsset(asset.sourceId)).toBeUndefined();
  });

  it('keeps an asset reachable through undo history after it is removed from the live document', async () => {
    const asset = await registerAsset(createFile());
    attachAsSpaceBackground(asset);
    useEditorStore.getState().removeSpaceBackground();

    expect(useEditorStore.getState().document.spaceBackground).toBeNull();
    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.spaceBackground?.sourceId).toBe(asset.sourceId);
  });

  it('revokes a display content asset once undo/redo history no longer references it', async () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    // Register the asset right before attaching it, with no store mutation in between —
    // matching the real upload flow (registerAsset then immediate commit) — since the sweep
    // runs after every store change and would otherwise revoke an as-yet-unreferenced asset.
    const asset = await registerAsset(createFile());

    useEditorStore.getState().commitObjectChange(id, {
      content: {
        kind: 'image',
        sourceId: asset.sourceId,
        fit: 'contain',
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      },
    });
    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();

    useEditorStore.getState().commitObjectChange(id, { content: null });
    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();

    useEditorStore.getState().deleteSelected();
    resetStore();
    expect(getRegisteredAsset(asset.sourceId)).toBeUndefined();
  });

  it("keeps a portable object's product asset registered while it is reachable from the document", async () => {
    addSpaceBackground();
    const productAsset = await registerAsset(createFile('product.png'));

    useEditorStore.getState().addPortable({
      productSourceId: productAsset.sourceId,
      productIntrinsicWidth: productAsset.naturalWidth,
      productIntrinsicHeight: productAsset.naturalHeight,
      productHasAlpha: null,
      screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });

    expect(getRegisteredAsset(productAsset.sourceId)).toBeDefined();
  });

  it("keeps a portable object's content asset registered alongside its product asset", async () => {
    addSpaceBackground();
    const productAsset = await registerAsset(createFile('product.png'));
    useEditorStore.getState().addPortable({
      productSourceId: productAsset.sourceId,
      productIntrinsicWidth: productAsset.naturalWidth,
      productIntrinsicHeight: productAsset.naturalHeight,
      productHasAlpha: null,
      screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });
    const id = useEditorStore.getState().document.objects[0]!.id;
    const contentAsset = await registerAsset(createFile('content.png'));

    useEditorStore.getState().commitObjectChange(id, {
      content: {
        kind: 'image',
        sourceId: contentAsset.sourceId,
        fit: 'contain',
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      },
    });

    expect(getRegisteredAsset(productAsset.sourceId)).toBeDefined();
    expect(getRegisteredAsset(contentAsset.sourceId)).toBeDefined();
  });

  it("revokes a portable object's product and content assets once undo/redo history no longer references them", async () => {
    addSpaceBackground();
    const productAsset = await registerAsset(createFile('product.png'));
    useEditorStore.getState().addPortable({
      productSourceId: productAsset.sourceId,
      productIntrinsicWidth: productAsset.naturalWidth,
      productIntrinsicHeight: productAsset.naturalHeight,
      productHasAlpha: null,
      screenRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });
    const id = useEditorStore.getState().document.objects[0]!.id;
    const contentAsset = await registerAsset(createFile('content.png'));
    useEditorStore.getState().commitObjectChange(id, {
      content: {
        kind: 'image',
        sourceId: contentAsset.sourceId,
        fit: 'contain',
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      },
    });

    useEditorStore.getState().deleteSelected();
    expect(getRegisteredAsset(productAsset.sourceId)).toBeDefined();
    expect(getRegisteredAsset(contentAsset.sourceId)).toBeDefined();

    resetStore();
    expect(getRegisteredAsset(productAsset.sourceId)).toBeUndefined();
    expect(getRegisteredAsset(contentAsset.sourceId)).toBeUndefined();
  });
});

describe('editorStore perspective edit', () => {
  beforeEach(() => {
    resetStore();
  });

  it('derives a starting quad from the object rect and does not touch history or the document', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().beginPerspectiveEdit(id);

    const state = useEditorStore.getState();
    expect(state.perspectiveEditId).toBe(id);
    expect(state.perspectiveDraftQuad).not.toBeNull();
    expect(state.perspectiveEditOriginalQuad).toEqual(state.perspectiveDraftQuad);
    expect(state.past.length).toBe(pastLengthBefore);
    expect(state.document.objects[0]).toMatchObject({ placementMode: 'rect', perspectiveQuad: null });
  });

  it('seeds the draft from an already-applied quad instead of re-deriving one from the rect', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().beginPerspectiveEdit(id);
    const firstDraft = useEditorStore.getState().perspectiveDraftQuad!;
    const movedQuad = {
      ...firstDraft,
      topLeft: { x: firstDraft.topLeft.x + 0.05, y: firstDraft.topLeft.y },
    };
    useEditorStore.getState().updatePerspectiveDraft(movedQuad);
    useEditorStore.getState().applyPerspectiveEdit();

    useEditorStore.getState().beginPerspectiveEdit(id);
    expect(useEditorStore.getState().perspectiveDraftQuad).toEqual(movedQuad);
  });

  it('is a no-op for object kinds that do not support perspective', () => {
    addSpaceBackground();
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().beginPerspectiveEdit(id);

    expect(useEditorStore.getState().perspectiveEditId).toBeNull();
  });

  it('updatePerspectiveDraft is a no-op when not in edit mode', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');

    useEditorStore
      .getState()
      .updatePerspectiveDraft({
        topLeft: { x: 0, y: 0 },
        topRight: { x: 1, y: 0 },
        bottomRight: { x: 1, y: 1 },
        bottomLeft: { x: 0, y: 1 },
      });

    expect(useEditorStore.getState().perspectiveDraftQuad).toBeNull();
  });

  it('clamps out-of-bounds draft points to the document 0-1 range', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().beginPerspectiveEdit(id);

    useEditorStore.getState().updatePerspectiveDraft({
      topLeft: { x: -0.5, y: -0.2 },
      topRight: { x: 1.5, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 0, y: 1 },
    });

    expect(useEditorStore.getState().perspectiveDraftQuad).toEqual({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 0, y: 1 },
    });
  });

  it('applies a valid draft as a single history entry, switching placementMode to perspective', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().beginPerspectiveEdit(id);
    const pastLengthBefore = useEditorStore.getState().past.length;
    const draft = {
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.9, y: 0.15 },
      bottomRight: { x: 0.85, y: 0.9 },
      bottomLeft: { x: 0.15, y: 0.85 },
    };
    useEditorStore.getState().updatePerspectiveDraft(draft);

    const result = useEditorStore.getState().applyPerspectiveEdit();

    expect(result).toEqual({ applied: true });
    const state = useEditorStore.getState();
    expect(state.past.length).toBe(pastLengthBefore + 1);
    expect(state.perspectiveEditId).toBeNull();
    expect(state.perspectiveDraftQuad).toBeNull();
    expect(state.document.objects[0]).toMatchObject({
      placementMode: 'perspective',
      perspectiveQuad: draft,
    });
  });

  it('rejects an invalid draft, applying nothing and pushing no history entry', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().beginPerspectiveEdit(id);
    const pastLengthBefore = useEditorStore.getState().past.length;
    // Self-intersecting ("bowtie") quad: the top-right/bottom-right corners are swapped, so the
    // top and bottom edges cross like an hourglass instead of forming a simple polygon.
    const bowtie = {
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.9, y: 0.9 },
      bottomRight: { x: 0.9, y: 0.1 },
      bottomLeft: { x: 0.1, y: 0.9 },
    };
    useEditorStore.getState().updatePerspectiveDraft(bowtie);

    const result = useEditorStore.getState().applyPerspectiveEdit();

    expect(result.applied).toBe(false);
    expect(result.reason).toBeDefined();
    const state = useEditorStore.getState();
    expect(state.past.length).toBe(pastLengthBefore);
    expect(state.perspectiveEditId).toBe(id);
    expect(state.document.objects[0]).toMatchObject({ placementMode: 'rect', perspectiveQuad: null });
  });

  it('re-applying an unchanged quad is a no-op that still exits edit mode without new history', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().beginPerspectiveEdit(id);
    const draft = useEditorStore.getState().perspectiveDraftQuad!;
    useEditorStore.getState().updatePerspectiveDraft(draft);
    useEditorStore.getState().applyPerspectiveEdit();

    useEditorStore.getState().beginPerspectiveEdit(id);
    const pastLengthBefore = useEditorStore.getState().past.length;
    const result = useEditorStore.getState().applyPerspectiveEdit();

    expect(result).toEqual({ applied: true });
    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
    expect(useEditorStore.getState().perspectiveEditId).toBeNull();
  });

  it('cancelPerspectiveEdit discards the draft without touching the document or history', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().beginPerspectiveEdit(id);
    useEditorStore.getState().updatePerspectiveDraft({
      topLeft: { x: 0.05, y: 0.05 },
      topRight: { x: 0.95, y: 0.05 },
      bottomRight: { x: 0.95, y: 0.95 },
      bottomLeft: { x: 0.05, y: 0.95 },
    });
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().cancelPerspectiveEdit();

    const state = useEditorStore.getState();
    expect(state.perspectiveEditId).toBeNull();
    expect(state.perspectiveDraftQuad).toBeNull();
    expect(state.past.length).toBe(pastLengthBefore);
    expect(state.document.objects[0]).toMatchObject({ placementMode: 'rect', perspectiveQuad: null });
  });

  it('resetPerspectiveEdit restores the original draft and stays in edit mode, with no history', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().beginPerspectiveEdit(id);
    const original = useEditorStore.getState().perspectiveDraftQuad!;
    useEditorStore.getState().updatePerspectiveDraft({
      topLeft: { x: 0.3, y: 0.3 },
      topRight: { x: 0.7, y: 0.3 },
      bottomRight: { x: 0.7, y: 0.7 },
      bottomLeft: { x: 0.3, y: 0.7 },
    });
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().resetPerspectiveEdit();

    const state = useEditorStore.getState();
    expect(state.perspectiveEditId).toBe(id);
    expect(state.perspectiveDraftQuad).toEqual(original);
    expect(state.past.length).toBe(pastLengthBefore);
  });

  it('undo, redo, and deleteSelected all exit an in-progress perspective edit', () => {
    addSpaceBackground();
    useEditorStore.getState().addDisplay('led');
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().beginPerspectiveEdit(id);
    expect(useEditorStore.getState().perspectiveEditId).toBe(id);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().perspectiveEditId).toBeNull();

    useEditorStore.getState().beginPerspectiveEdit(id);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().perspectiveEditId).toBeNull();

    useEditorStore.getState().selectObject(id);
    useEditorStore.getState().beginPerspectiveEdit(id);
    useEditorStore.getState().deleteSelected();
    expect(useEditorStore.getState().perspectiveEditId).toBeNull();
  });
});
