import { create } from 'zustand';
import { sweepUnusedAssets } from '../lib/assetRegistry';
import { createId } from '../lib/id';
import type {
  DisplayFrameId,
  DisplaySignageObject,
  EditorDocument,
  ElementId,
  ImageSignageObject,
  SignageObject,
  SpaceBackground,
  TemplateId,
  TextSignageObject,
} from '../types/editor';
import { createEmptyDocument, DEFAULT_MATERIAL_SETTINGS, DISPLAY_FRAME_TEMPLATES, TEMPLATES } from '../types/editor';

const HISTORY_LIMIT = 50;

export interface EditorState {
  document: EditorDocument;
  selectedId: ElementId | null;
  past: EditorDocument[];
  future: EditorDocument[];
  selectTemplate: (templateId: TemplateId) => void;
  setBackgroundColor: (color: string) => void;
  addText: () => void;
  addImage: (payload: { src: string; naturalWidth: number; naturalHeight: number }) => void;
  addDisplay: (frameId: DisplayFrameId) => void;
  addSpaceBackground: (payload: { sourceId: string; naturalWidth: number; naturalHeight: number }) => void;
  removeSpaceBackground: () => void;
  selectObject: (id: ElementId | null) => void;
  updateObjectTransient: (id: ElementId, patch: Partial<SignageObject>) => void;
  commitObjectChange: (id: ElementId, patch: Partial<SignageObject>) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
}

function pushHistory(past: EditorDocument[], current: EditorDocument): EditorDocument[] {
  const next = [...past, current];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

function patchObjects(objects: SignageObject[], id: ElementId, patch: Partial<SignageObject>): SignageObject[] {
  return objects.map((object) => (object.id === id ? ({ ...object, ...patch } as SignageObject) : object));
}

function shallowValueEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => aRecord[key] === bRecord[key]);
}

// A one-level-deep comparison is enough here: patch values are either primitives (x, y,
// text, material...) or flat objects of primitives (content, materialSettings), never
// deeply nested structures.
function hasObjectChange(target: SignageObject, patch: Partial<SignageObject>): boolean {
  return (Object.keys(patch) as (keyof SignageObject)[]).some(
    (key) => !shallowValueEqual(target[key], patch[key]),
  );
}

/** Every asset sourceId reachable from a document (space background + display content). */
function collectAssetSourceIds(document: EditorDocument, into: Set<string>): void {
  if (document.spaceBackground) into.add(document.spaceBackground.sourceId);
  for (const object of document.objects) {
    if (object.kind === 'display' && object.content) into.add(object.content.sourceId);
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createEmptyDocument(),
  selectedId: null,
  past: [],
  future: [],

  selectTemplate: (templateId) => {
    const { document } = get();
    if (document.templateId === templateId) return;
    set({
      document: { templateId, backgroundColor: document.backgroundColor, spaceBackground: null, objects: [] },
      selectedId: null,
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  setBackgroundColor: (color) => {
    const { document } = get();
    set({
      document: { ...document, backgroundColor: color },
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  addText: () => {
    const { document } = get();
    const template = TEMPLATES[document.templateId];
    const newObject: TextSignageObject = {
      id: createId(),
      kind: 'text',
      x: template.width / 2 - 150,
      y: template.height / 2 - 30,
      width: 300,
      height: 60,
      rotation: 0,
      text: '',
      fontSize: 48,
      color: '#ffffff',
      align: 'center',
    };
    set({
      document: { ...document, objects: [...document.objects, newObject] },
      selectedId: newObject.id,
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  addImage: ({ src, naturalWidth, naturalHeight }) => {
    const { document } = get();
    const template = TEMPLATES[document.templateId];
    const maxWidth = template.width * 0.6;
    const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    const newObject: ImageSignageObject = {
      id: createId(),
      kind: 'image',
      x: template.width / 2 - width / 2,
      y: template.height / 2 - height / 2,
      width,
      height,
      rotation: 0,
      src,
      naturalWidth,
      naturalHeight,
    };
    set({
      document: { ...document, objects: [...document.objects, newObject] },
      selectedId: newObject.id,
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  addDisplay: (frameId) => {
    const { document } = get();
    const template = TEMPLATES[document.templateId];
    const frame = DISPLAY_FRAME_TEMPLATES[frameId];
    const width = Math.min(frame.defaultWidth, template.width * 0.9);
    const height = Math.min(frame.defaultHeight, template.height * 0.9);
    const newObject: DisplaySignageObject = {
      id: createId(),
      kind: 'display',
      x: template.width / 2 - width / 2,
      y: template.height / 2 - height / 2,
      width,
      height,
      rotation: 0,
      frameId,
      content: null,
      material: frame.defaultMaterial,
      materialSettings: { ...DEFAULT_MATERIAL_SETTINGS },
    };
    set({
      document: { ...document, objects: [...document.objects, newObject] },
      selectedId: newObject.id,
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  addSpaceBackground: ({ sourceId, naturalWidth, naturalHeight }) => {
    const { document } = get();
    const spaceBackground: SpaceBackground = { sourceId, naturalWidth, naturalHeight };
    set({
      document: { ...document, spaceBackground },
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  removeSpaceBackground: () => {
    const { document } = get();
    if (!document.spaceBackground) return;
    set({
      document: { ...document, spaceBackground: null },
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  selectObject: (id) => set({ selectedId: id }),

  updateObjectTransient: (id, patch) => {
    const { document } = get();
    set({ document: { ...document, objects: patchObjects(document.objects, id, patch) } });
  },

  commitObjectChange: (id, patch) => {
    const { document, past } = get();
    const target = document.objects.find((object) => object.id === id);
    if (!target || !hasObjectChange(target, patch)) return;

    const nextDocument: EditorDocument = {
      ...document,
      objects: patchObjects(document.objects, id, patch),
    };
    set({
      document: nextDocument,
      past: pushHistory(past, document),
      future: [],
    });
  },

  deleteSelected: () => {
    const { document, selectedId, past } = get();
    if (!selectedId) return;
    set({
      document: { ...document, objects: document.objects.filter((object) => object.id !== selectedId) },
      selectedId: null,
      past: pushHistory(past, document),
      future: [],
    });
  },

  undo: () => {
    const { past, document, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1]!;
    set({
      document: previous,
      past: past.slice(0, -1),
      future: [document, ...future],
      selectedId: null,
    });
  },

  redo: () => {
    const { future, document, past } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    set({
      document: next,
      future: future.slice(1),
      past: [...past, document],
      selectedId: null,
    });
  },
}));

// An asset (space background photo or display content image) must stay decoded for as long
// as it's reachable from the current document *or* from undo/redo history, otherwise Undo
// could restore a document pointing at a revoked Object URL. Recomputing the reachable set
// from scratch on every change (instead of manual retain/release calls scattered through the
// actions above) sidesteps refcount bugs entirely at the cost of a cheap re-scan.
useEditorStore.subscribe((state, previousState) => {
  if (
    state.document === previousState.document &&
    state.past === previousState.past &&
    state.future === previousState.future
  ) {
    return;
  }
  const used = new Set<string>();
  collectAssetSourceIds(state.document, used);
  for (const snapshot of state.past) collectAssetSourceIds(snapshot, used);
  for (const snapshot of state.future) collectAssetSourceIds(snapshot, used);
  sweepUnusedAssets(used);
});

export function selectCanUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function selectCanRedo(state: EditorState): boolean {
  return state.future.length > 0;
}

export function selectSelectedObject(state: EditorState): SignageObject | null {
  return state.document.objects.find((object) => object.id === state.selectedId) ?? null;
}
