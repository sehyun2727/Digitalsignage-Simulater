import { beforeEach, describe, expect, it } from 'vitest';
import { selectCanRedo, selectCanUndo, selectSelectedObject, useEditorStore } from '../../src/store/editorStore';
import { createEmptyDocument, DEFAULT_TEMPLATE_ID } from '../../src/types/editor';

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
});
