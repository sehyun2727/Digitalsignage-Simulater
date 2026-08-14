import { create } from 'zustand';
import { sweepUnusedAssets } from '../lib/assetRegistry';
import { normalizeObjectGeometry } from '../lib/geometryNormalization';
import { createId } from '../lib/id';
import { computeDefaultPortableSize } from '../lib/portableRegion';
import {
  clampQuad01,
  quadsEqual,
  rectTransformToQuad,
  validateQuad,
  type QuadInvalidReason,
} from '../lib/quadGeometry';
import { getObjectScreenRect } from '../lib/screenHitTest';
import type {
  DisplayMaterial,
  DisplaySignageObject,
  EditorDocument,
  ElementId,
  ImageSignageObject,
  NormalizedQuad,
  PortableSignageObject,
  SignageObject,
  SpaceBackground,
  TextSignageObject,
} from '../types/editor';
import {
  createEmptyDocument,
  DEFAULT_CONTACT_SHADOW,
  DEFAULT_CURVATURE,
  DEFAULT_ENVIRONMENT_INTEGRATION,
  DEFAULT_MATERIAL_SETTINGS,
  DEFAULT_PLACEMENT_MODE,
  getDocumentSize,
  supportsPerspective,
} from '../types/editor';

const HISTORY_LIMIT = 50;

/** Result of `applyPerspectiveEdit`, so the perspective overlay UI can show why Apply did nothing. */
export interface ApplyPerspectiveEditResult {
  applied: boolean;
  reason?: QuadInvalidReason;
}

export interface EditorState {
  document: EditorDocument;
  selectedId: ElementId | null;
  past: EditorDocument[];
  future: EditorDocument[];
  /** Id of the display/portable object currently in "Fit to space" perspective edit mode, if any. */
  perspectiveEditId: ElementId | null;
  /** Live in-progress quad while perspective edit mode is open; not yet committed to the document. */
  perspectiveDraftQuad: NormalizedQuad | null;
  /** The quad `perspectiveDraftQuad` started from, restored by `resetPerspectiveEdit`. */
  perspectiveEditOriginalQuad: NormalizedQuad | null;
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
  /**
   * Enters "Fit to space" perspective edit mode for `id`: seeds the draft quad from the object's
   * existing `perspectiveQuad` if it has one (so re-entering restores the last-applied quad), or
   * derives a starting quad from its current rect so the object doesn't visibly jump. No-op for
   * object kinds that don't support perspective or before a space photo exists.
   */
  beginPerspectiveEdit: (id: ElementId) => void;
  /** Updates the live draft quad while editing (clamped to the document's 0-1 bounds). No history. */
  updatePerspectiveDraft: (quad: NormalizedQuad) => void;
  /**
   * Validates and commits the draft quad as a single history entry, then exits edit mode. Does
   * nothing (zero history entries) when the draft is geometrically invalid, or when it is
   * identical to the object's already-applied quad (no-op re-apply).
   */
  applyPerspectiveEdit: () => ApplyPerspectiveEditResult;
  /** Exits edit mode without committing any change. Zero history entries. */
  cancelPerspectiveEdit: () => void;
  /** Restores the draft quad to what it was when edit mode began. Stays in edit mode, no history. */
  resetPerspectiveEdit: () => void;
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
  perspectiveEditId: null,
  perspectiveDraftQuad: null,
  perspectiveEditOriginalQuad: null,

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
      placementMode: DEFAULT_PLACEMENT_MODE,
      perspectiveQuad: null,
      contactShadow: { ...DEFAULT_CONTACT_SHADOW },
      environmentIntegration: { ...DEFAULT_ENVIRONMENT_INTEGRATION },
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
      placementMode: DEFAULT_PLACEMENT_MODE,
      perspectiveQuad: null,
      contactShadow: { ...DEFAULT_CONTACT_SHADOW },
      environmentIntegration: { ...DEFAULT_ENVIRONMENT_INTEGRATION },
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
      perspectiveEditId: null,
      perspectiveDraftQuad: null,
      perspectiveEditOriginalQuad: null,
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
      perspectiveEditId: null,
      perspectiveDraftQuad: null,
      perspectiveEditOriginalQuad: null,
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
      perspectiveEditId: null,
      perspectiveDraftQuad: null,
      perspectiveEditOriginalQuad: null,
    });
  },

  beginPerspectiveEdit: (id) => {
    const { document } = get();
    const target = document.objects.find((object) => object.id === id);
    if (!target || !supportsPerspective(target)) return;
    const documentSize = getDocumentSize(document);
    if (!documentSize) return;

    let initialQuad: NormalizedQuad | null = target.perspectiveQuad;
    if (!initialQuad) {
      const localScreenRect = getObjectScreenRect(target);
      if (!localScreenRect) return;
      initialQuad = rectTransformToQuad(localScreenRect, target, documentSize);
    }

    set({
      perspectiveEditId: id,
      perspectiveDraftQuad: initialQuad,
      perspectiveEditOriginalQuad: initialQuad,
    });
  },

  updatePerspectiveDraft: (quad) => {
    const { perspectiveEditId } = get();
    if (!perspectiveEditId) return;
    set({ perspectiveDraftQuad: clampQuad01(quad) });
  },

  applyPerspectiveEdit: () => {
    const { perspectiveEditId, perspectiveDraftQuad, document, past } = get();
    if (!perspectiveEditId || !perspectiveDraftQuad) return { applied: false };

    const target = document.objects.find((object) => object.id === perspectiveEditId);
    if (!target || !supportsPerspective(target)) {
      set({
        perspectiveEditId: null,
        perspectiveDraftQuad: null,
        perspectiveEditOriginalQuad: null,
      });
      return { applied: false };
    }

    const validation = validateQuad(perspectiveDraftQuad);
    if (!validation.valid) return { applied: false, reason: validation.reason };

    const isNoop =
      target.placementMode === 'perspective' &&
      target.perspectiveQuad !== null &&
      quadsEqual(target.perspectiveQuad, perspectiveDraftQuad);

    if (isNoop) {
      set({
        perspectiveEditId: null,
        perspectiveDraftQuad: null,
        perspectiveEditOriginalQuad: null,
      });
      return { applied: true };
    }

    const nextDocument: EditorDocument = {
      ...document,
      objects: patchObjects(document.objects, perspectiveEditId, {
        placementMode: 'perspective',
        perspectiveQuad: perspectiveDraftQuad,
      }),
    };
    set({
      document: nextDocument,
      past: pushHistory(past, document),
      future: [],
      perspectiveEditId: null,
      perspectiveDraftQuad: null,
      perspectiveEditOriginalQuad: null,
    });
    return { applied: true };
  },

  cancelPerspectiveEdit: () => {
    set({ perspectiveEditId: null, perspectiveDraftQuad: null, perspectiveEditOriginalQuad: null });
  },

  resetPerspectiveEdit: () => {
    const { perspectiveEditId, perspectiveEditOriginalQuad } = get();
    if (!perspectiveEditId || !perspectiveEditOriginalQuad) return;
    set({ perspectiveDraftQuad: perspectiveEditOriginalQuad });
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
