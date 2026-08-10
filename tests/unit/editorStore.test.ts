import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegisteredAsset, registerAsset } from '../../src/lib/assetRegistry';
import { selectCanRedo, selectCanUndo, selectSelectedObject, useEditorStore } from '../../src/store/editorStore';
import { createEmptyDocument, DEFAULT_MATERIAL_SETTINGS, DEFAULT_TEMPLATE_ID } from '../../src/types/editor';

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
  });
}

describe('editorStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with an empty document and no history', () => {
    const state = useEditorStore.getState();

    expect(state.document.objects).toHaveLength(0);
    expect(state.document.templateId).toBe(DEFAULT_TEMPLATE_ID);
    expect(selectCanUndo(state)).toBe(false);
    expect(selectCanRedo(state)).toBe(false);
  });

  it('adds a text object, selects it, and makes undo available', () => {
    useEditorStore.getState().addText();
    const state = useEditorStore.getState();

    expect(state.document.objects).toHaveLength(1);
    expect(state.document.objects[0]?.kind).toBe('text');
    expect(state.selectedId).toBe(state.document.objects[0]?.id);
    expect(selectCanUndo(state)).toBe(true);
  });

  it('adds an image object scaled to fit within the template', () => {
    useEditorStore.getState().addImage({ src: 'blob:mock', naturalWidth: 4000, naturalHeight: 2000 });
    const state = useEditorStore.getState();
    const image = state.document.objects[0];

    expect(image?.kind).toBe('image');
    if (image?.kind === 'image') {
      expect(image.width).toBeLessThan(4000);
      expect(image.width / image.height).toBeCloseTo(4000 / 2000);
    }
  });

  it('selects and deselects objects', () => {
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().selectObject(null);
    expect(useEditorStore.getState().selectedId).toBeNull();

    useEditorStore.getState().selectObject(id);
    expect(useEditorStore.getState().selectedId).toBe(id);
    expect(selectSelectedObject(useEditorStore.getState())?.id).toBe(id);
  });

  it('commits object changes to history and undo restores the previous state', () => {
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
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().updateObjectTransient(id, { x: 999 });

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
    expect(useEditorStore.getState().document.objects[0]?.x).toBe(999);
  });

  it('deletes the selected object and commits history', () => {
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

  it('switching templates clears objects and commits history', () => {
    useEditorStore.getState().addText();
    useEditorStore.getState().selectTemplate('stand-display');

    const state = useEditorStore.getState();
    expect(state.document.templateId).toBe('stand-display');
    expect(state.document.objects).toHaveLength(0);
    expect(selectCanUndo(state)).toBe(true);
  });

  it('undo after a template switch restores the previous template and its objects', () => {
    useEditorStore.getState().addText();
    const originalObjectId = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().selectTemplate('stand-display');

    useEditorStore.getState().undo();

    const state = useEditorStore.getState();
    expect(state.document.templateId).toBe('wall-led');
    expect(state.document.objects).toHaveLength(1);
    expect(state.document.objects[0]?.id).toBe(originalObjectId);
  });

  it('commits a resize change to history and undo/redo restore it', () => {
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().commitObjectChange(id, { width: 500, height: 200 });
    expect(useEditorStore.getState().document.objects[0]).toMatchObject({ width: 500, height: 200 });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.objects[0]?.width).not.toBe(500);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.objects[0]).toMatchObject({ width: 500, height: 200 });
  });

  it('commits a rotation change to history and undo/redo restore it', () => {
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
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;
    const { x, y } = useEditorStore.getState().document.objects[0]!;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().commitObjectChange(id, { x, y });

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
  });

  it('a new commit after undo clears the redo stack', () => {
    useEditorStore.getState().addText();
    const id = useEditorStore.getState().document.objects[0]!.id;
    useEditorStore.getState().commitObjectChange(id, { x: 500, y: 400 });

    useEditorStore.getState().undo();
    expect(selectCanRedo(useEditorStore.getState())).toBe(true);

    useEditorStore.getState().commitObjectChange(id, { x: 700, y: 300 });
    expect(selectCanRedo(useEditorStore.getState())).toBe(false);
  });

  it('adds a display object with the frame default material and no content', () => {
    useEditorStore.getState().addDisplay('wall-led');
    const state = useEditorStore.getState();
    const display = state.document.objects[0];

    expect(display?.kind).toBe('display');
    if (display?.kind === 'display') {
      expect(display.frameId).toBe('wall-led');
      expect(display.material).toBe('outdoor-led');
      expect(display.materialSettings).toEqual(DEFAULT_MATERIAL_SETTINGS);
      expect(display.content).toBeNull();
    }
    expect(state.selectedId).toBe(display?.id);
    expect(selectCanUndo(state)).toBe(true);
  });

  it('adds a stand-display object defaulting to the LCD material', () => {
    useEditorStore.getState().addDisplay('stand-display');
    const display = useEditorStore.getState().document.objects[0];

    expect(display?.kind).toBe('display');
    if (display?.kind === 'display') {
      expect(display.material).toBe('lcd');
    }
  });

  it('adds and removes a space background, both committing history', () => {
    useEditorStore.getState().addSpaceBackground({ sourceId: 'src-1', naturalWidth: 1000, naturalHeight: 500 });
    expect(useEditorStore.getState().document.spaceBackground).toEqual({
      sourceId: 'src-1',
      naturalWidth: 1000,
      naturalHeight: 500,
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

  it('switching templates also clears the space background', () => {
    useEditorStore.getState().addSpaceBackground({ sourceId: 'src-1', naturalWidth: 1000, naturalHeight: 500 });
    useEditorStore.getState().selectTemplate('stand-display');

    expect(useEditorStore.getState().document.spaceBackground).toBeNull();
  });

  it('commits a content patch on a display object and undo/redo restore it', () => {
    useEditorStore.getState().addDisplay('wall-led');
    const id = useEditorStore.getState().document.objects[0]!.id;

    useEditorStore.getState().commitObjectChange(id, {
      content: { kind: 'image', sourceId: 'src-1', fit: 'contain', offsetX: 0, offsetY: 0, scale: 1 },
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
    useEditorStore.getState().addDisplay('wall-led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().commitObjectChange(id, { materialSettings: { ...DEFAULT_MATERIAL_SETTINGS } });

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
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

  it('keeps a space background asset registered while it is reachable from the document', async () => {
    const asset = await registerAsset(createFile());
    useEditorStore.getState().addSpaceBackground(asset);

    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();
  });

  it('revokes a space background asset once it is removed and no longer reachable from history', async () => {
    const asset = await registerAsset(createFile());
    useEditorStore.getState().addSpaceBackground(asset);
    useEditorStore.getState().removeSpaceBackground();

    // The removal is still in `past`, so the asset stays reachable until that history is gone.
    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();

    resetStore();
    expect(getRegisteredAsset(asset.sourceId)).toBeUndefined();
  });

  it('keeps an asset reachable through undo history after it is removed from the live document', async () => {
    const asset = await registerAsset(createFile());
    useEditorStore.getState().addSpaceBackground(asset);
    useEditorStore.getState().removeSpaceBackground();

    expect(useEditorStore.getState().document.spaceBackground).toBeNull();
    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.spaceBackground?.sourceId).toBe(asset.sourceId);
  });

  it('revokes a display content asset once undo/redo history no longer references it', async () => {
    useEditorStore.getState().addDisplay('wall-led');
    const id = useEditorStore.getState().document.objects[0]!.id;
    // Register the asset right before attaching it, with no store mutation in between —
    // matching the real upload flow (registerAsset then immediate commit) — since the sweep
    // runs after every store change and would otherwise revoke an as-yet-unreferenced asset.
    const asset = await registerAsset(createFile());

    useEditorStore.getState().commitObjectChange(id, {
      content: { kind: 'image', sourceId: asset.sourceId, fit: 'contain', offsetX: 0, offsetY: 0, scale: 1 },
    });
    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();

    useEditorStore.getState().commitObjectChange(id, { content: null });
    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();

    useEditorStore.getState().deleteSelected();
    resetStore();
    expect(getRegisteredAsset(asset.sourceId)).toBeUndefined();
  });
});
