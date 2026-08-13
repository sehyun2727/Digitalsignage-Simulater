import { create } from 'zustand';
import { sweepUnusedAssets } from '../lib/assetRegistry';
import { normalizeObjectGeometry } from '../lib/geometryNormalization';
import { createId } from '../lib/id';
import { computeDefaultPortableSize } from '../lib/portableRegion';
import type {
  DisplayMaterial,
  DisplaySignageObject,
  EditorDocument,
  ElementId,
  ImageSignageObject,
  PortableSignageObject,
  SignageObject,
  SpaceBackground,
  TextSignageObject,
} from '../types/editor';
import { createEmptyDocument, DEFAULT_CURVATURE, DEFAULT_MATERIAL_SETTINGS, getDocumentSize } from '../types/editor';

const HISTORY_LIMIT = 50;

export interface EditorState {
  document: EditorDocument;
  selectedId: ElementId | null;
  past: EditorDocument[];
  future: EditorDocument[];
  addText: () => void;
  addImage: (payload: { src: string; naturalWidth: number; naturalHeight: number }) => void;
  addDisplay: (material: DisplayMaterial) => void;
  addPortable: (payload: {
    productSourceId: string;
    productIntrinsicWidth: number;
    productIntrinsicHeight: number;
    productHasAlpha: boolean | null;
    screenRegion: { x: number; y: number; width: number; height: number };
  }) => void;
  setSpaceBackground: (payload: {
    sourceId: string;
    naturalWidth: number;
    naturalHeight: number;
    width: number;
    height: number;
    downscaled: boolean;
  }) => void;
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

function patchObjects(
  objects: SignageObject[],
  id: ElementId,
  patch: Partial<SignageObject>,
): SignageObject[] {
  return objects.map((object) =>
    object.id === id ? ({ ...object, ...patch } as SignageObject) : object,
  );
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
// text, material...) or flat objects of primitives (content, materialSettings, curvature),
// never deeply nested structures.
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
    if (object.kind === 'portable') {
      into.add(object.productSourceId);
      if (object.content) into.add(object.content.sourceId);
    }
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createEmptyDocument(),
  selectedId: null,
  past: [],
  future: [],

  addText: () => {
    const { document } = get();
    const size = getDocumentSize(document);
    if (!size) return;
    const newObject: TextSignageObject = {
      id: createId(),
      kind: 'text',
      x: size.width / 2 - 150,
      y: size.height / 2 - 30,
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
    const size = getDocumentSize(document);
    if (!size) return;
    const maxWidth = size.width * 0.6;
    const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    const newObject: ImageSignageObject = {
      id: createId(),
      kind: 'image',
      x: size.width / 2 - width / 2,
      y: size.height / 2 - height / 2,
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

  addDisplay: (material) => {
    const { document } = get();
    const size = getDocumentSize(document);
    if (!size) return;
    const width = Math.min(480, size.width * 0.9);
    const height = Math.min(270, size.height * 0.9);
    const newObject: DisplaySignageObject = {
      id: createId(),
      kind: 'display',
      x: size.width / 2 - width / 2,
      y: size.height / 2 - height / 2,
      width,
      height,
      rotation: 0,
      frameId: 'wall-led',
      content: null,
      material,
      materialSettings: { ...DEFAULT_MATERIAL_SETTINGS },
      curvature: { ...DEFAULT_CURVATURE },
    };
    set({
      document: { ...document, objects: [...document.objects, newObject] },
      selectedId: newObject.id,
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  addPortable: ({
    productSourceId,
    productIntrinsicWidth,
    productIntrinsicHeight,
    productHasAlpha,
    screenRegion,
  }) => {
    const { document } = get();
    const size = getDocumentSize(document);
    if (!size) return;
    const { width, height } = computeDefaultPortableSize(
      { width: productIntrinsicWidth, height: productIntrinsicHeight },
      size,
    );
    const newObject: PortableSignageObject = {
      id: createId(),
      kind: 'portable',
      x: size.width / 2 - width / 2,
      y: size.height / 2 - height / 2,
      width,
      height,
      rotation: 0,
      productSourceId,
      productIntrinsicWidth,
      productIntrinsicHeight,
      productHasAlpha,
      screenRegion,
      content: null,
      material: 'lcd',
      materialSettings: { ...DEFAULT_MATERIAL_SETTINGS },
      curvature: { ...DEFAULT_CURVATURE },
    };
    set({
      document: { ...document, objects: [...document.objects, newObject] },
      selectedId: newObject.id,
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  // Handles both the first space-photo upload and a later replace in one action: when a
  // background already exists, every object's geometry is re-mapped to the new document size
  // (preserving normalized center/size, see geometryNormalization.ts) in the *same* history
  // entry as the background swap, so a single Undo restores both the old photo and the old
  // object positions together instead of requiring two separate undo steps.
  setSpaceBackground: ({ sourceId, naturalWidth, naturalHeight, width, height, downscaled }) => {
    const { document } = get();
    const spaceBackground: SpaceBackground = {
      sourceId,
      naturalWidth,
      naturalHeight,
      width,
      height,
      downscaled,
    };
    const oldSize = getDocumentSize(document);
    const newSize = { width, height };
    const objects = oldSize
      ? document.objects.map((object) => ({
          ...object,
          ...normalizeObjectGeometry(object, oldSize, newSize),
        }))
      : document.objects;

    set({
      document: { ...document, spaceBackground, objects },
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  // Returning to the empty state (rather than only clearing spaceBackground) avoids leaving
  // signage objects positioned against a document size that no longer exists — there is no
  // valid canvas without a space photo. A single history entry means Undo restores the photo
  // and every object together.
  removeSpaceBackground: () => {
    const { document } = get();
    if (!document.spaceBackground) return;
    set({
      document: createEmptyDocument(),
      selectedId: null,
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
      document: {
        ...document,
        objects: document.objects.filter((object) => object.id !== selectedId),
      },
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
