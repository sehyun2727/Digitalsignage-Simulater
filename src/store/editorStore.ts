import { create } from 'zustand';
import { getRegisteredAsset, sweepUnusedAssets } from '../lib/assetRegistry';
import { resolveShadowMode, sampleAmbientColor } from '../lib/environmentIntegration';
import { normalizeObjectGeometry } from '../lib/geometryNormalization';
import { createId } from '../lib/id';
import {
  clampOcclusionSetting,
  clampPoint01 as clampOcclusionPoint01,
  validateOcclusionPolygon,
  type OcclusionInvalidReason,
} from '../lib/occlusion';
import { computeDefaultPortableSize } from '../lib/portableRegion';
import {
  clampQuad01,
  quadsEqual,
  rectTransformToQuad,
  validateQuad,
  type QuadInvalidReason,
} from '../lib/quadGeometry';
import {
  getPresetContactShadow,
  getPresetEnvironmentIntegration,
  getPresetMaterialSettings,
  resolvePresetPatch,
  type RenderingPresetId,
} from '../lib/renderingPresets';
import { getObjectScreenRect } from '../lib/screenHitTest';
import type {
  DisplayMaterial,
  DisplaySignageObject,
  EditorDocument,
  ElementId,
  ImageSignageObject,
  NormalizedPoint,
  NormalizedQuad,
  OcclusionMask,
  PortableSignageObject,
  SignageObject,
  SpaceBackground,
  TextSignageObject,
} from '../types/editor';
import {
  createEmptyDocument,
  DEFAULT_CURVATURE,
  DEFAULT_OCCLUSION_FEATHER,
  DEFAULT_OCCLUSION_OPACITY,
  DEFAULT_PLACEMENT_MODE,
  getDocumentSize,
  supportsPerspective,
} from '../types/editor';

const DEFAULT_RENDERING_PRESET: RenderingPresetId = 'natural';

const HISTORY_LIMIT = 50;

/** Result of `applyPerspectiveEdit`, so the perspective overlay UI can show why Apply did nothing. */
export interface ApplyPerspectiveEditResult {
  applied: boolean;
  reason?: QuadInvalidReason;
}

/** Result of `applyOcclusionEdit`, so the occlusion overlay UI can show why Apply did nothing. */
export interface ApplyOcclusionEditResult {
  applied: boolean;
  reason?: OcclusionInvalidReason;
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
  /** Id of the display/portable object currently editing a foreground occlusion mask, if any. */
  occlusionEditObjectId: ElementId | null;
  /** Id of the existing mask being edited, or null while drawing a brand-new mask. */
  occlusionEditMaskId: ElementId | null;
  /** Live in-progress polygon points while occlusion edit mode is open; not yet committed. */
  occlusionDraftPoints: NormalizedPoint[];
  occlusionDraftFeather: number;
  occlusionDraftOpacity: number;
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
  /**
   * Re-seeds a display/portable object's materialSettings/contactShadow/environmentIntegration
   * from a named rendering preset (Natural/Bright/Night), as a single history entry. No-op for
   * object kinds without those fields or an unknown id.
   */
  applyRenderingPreset: (id: ElementId, preset: RenderingPresetId) => void;
  /**
   * User-triggered "sample environment" action (sprint spec section 13/14): reads the current
   * space photo's decoded asset and stores its averaged ambient color on the object's
   * `environmentIntegration.sampledColor`, as a single history entry. No-op when there is no
   * space photo, the object kind doesn't support environment integration, or sampling fails
   * (e.g. no canvas 2D context available).
   */
  sampleEnvironmentColor: (id: ElementId) => void;
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
  /**
   * Enters foreground occlusion edit mode for `objectId`: seeds the draft polygon from an
   * existing mask when `maskId` is given (editing), or an empty point list when omitted (drawing
   * a brand-new mask). No-op for object kinds without occlusion support or before a space photo
   * exists.
   */
  beginOcclusionEdit: (objectId: ElementId, maskId?: ElementId) => void;
  /** Updates the live draft polygon points while editing (clamped to the document's 0-1 bounds). */
  updateOcclusionDraftPoints: (points: NormalizedPoint[]) => void;
  setOcclusionDraftFeather: (value: number) => void;
  setOcclusionDraftOpacity: (value: number) => void;
  /**
   * Validates and commits the draft mask as a single history entry, then exits edit mode. Does
   * nothing (zero history entries) when the draft is geometrically invalid, or identical to the
   * mask already stored (no-op re-apply).
   */
  applyOcclusionEdit: () => ApplyOcclusionEditResult;
  /** Exits edit mode without committing any change. Zero history entries. */
  cancelOcclusionEdit: () => void;
  /** Removes a mask outright, as a single history entry. */
  deleteOcclusionMask: (objectId: ElementId, maskId: ElementId) => void;
  setOcclusionMaskEnabled: (objectId: ElementId, maskId: ElementId, enabled: boolean) => void;
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
  occlusionEditObjectId: null,
  occlusionEditMaskId: null,
  occlusionDraftPoints: [],
  occlusionDraftFeather: DEFAULT_OCCLUSION_FEATHER,
  occlusionDraftOpacity: DEFAULT_OCCLUSION_OPACITY,

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
      materialSettings: getPresetMaterialSettings(material, DEFAULT_RENDERING_PRESET),
      curvature: { ...DEFAULT_CURVATURE },
      placementMode: DEFAULT_PLACEMENT_MODE,
      perspectiveQuad: null,
      contactShadow: getPresetContactShadow('display', material, DEFAULT_RENDERING_PRESET),
      environmentIntegration: getPresetEnvironmentIntegration(DEFAULT_RENDERING_PRESET),
      installationMode: resolveShadowMode('display', material),
      occlusionMasks: [],
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
      materialSettings: getPresetMaterialSettings('lcd', DEFAULT_RENDERING_PRESET),
      curvature: { ...DEFAULT_CURVATURE },
      placementMode: DEFAULT_PLACEMENT_MODE,
      perspectiveQuad: null,
      contactShadow: getPresetContactShadow('portable', 'lcd', DEFAULT_RENDERING_PRESET),
      environmentIntegration: getPresetEnvironmentIntegration(DEFAULT_RENDERING_PRESET),
      installationMode: resolveShadowMode('portable', 'lcd'),
      occlusionMasks: [],
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

  applyRenderingPreset: (id, preset) => {
    const { document } = get();
    const target = document.objects.find((object) => object.id === id);
    if (!target || (target.kind !== 'display' && target.kind !== 'portable')) return;
    const patch = resolvePresetPatch(target.kind, target.material, preset);
    // A preset changes blend strength/shadow/material starting points, but a user-sampled
    // environment color (section 13/14) describes the actual space photo, not the lighting
    // mood — switching presets should not silently discard it. Only the explicit "reset" action
    // clears it.
    get().commitObjectChange(id, {
      ...patch,
      environmentIntegration: {
        ...patch.environmentIntegration,
        sampledColor: target.environmentIntegration.sampledColor,
      },
    });
  },

  sampleEnvironmentColor: (id) => {
    const { document } = get();
    const target = document.objects.find((object) => object.id === id);
    if (!target || (target.kind !== 'display' && target.kind !== 'portable')) return;
    const { spaceBackground } = document;
    if (!spaceBackground) return;
    const asset = getRegisteredAsset(spaceBackground.sourceId);
    if (!asset) return;
    const sampledColor = sampleAmbientColor(asset.image);
    if (!sampledColor) return;
    get().commitObjectChange(id, {
      environmentIntegration: { ...target.environmentIntegration, sampledColor },
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
      occlusionEditObjectId: null,
      occlusionEditMaskId: null,
      occlusionDraftPoints: [],
      occlusionDraftFeather: DEFAULT_OCCLUSION_FEATHER,
      occlusionDraftOpacity: DEFAULT_OCCLUSION_OPACITY,
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
      occlusionEditObjectId: null,
      occlusionEditMaskId: null,
      occlusionDraftPoints: [],
      occlusionDraftFeather: DEFAULT_OCCLUSION_FEATHER,
      occlusionDraftOpacity: DEFAULT_OCCLUSION_OPACITY,
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
      occlusionEditObjectId: null,
      occlusionEditMaskId: null,
      occlusionDraftPoints: [],
      occlusionDraftFeather: DEFAULT_OCCLUSION_FEATHER,
      occlusionDraftOpacity: DEFAULT_OCCLUSION_OPACITY,
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

  beginOcclusionEdit: (objectId, maskId) => {
    const { document } = get();
    const target = document.objects.find((object) => object.id === objectId);
    if (!target || (target.kind !== 'display' && target.kind !== 'portable')) return;
    if (!document.spaceBackground) return;

    const existingMask = maskId ? target.occlusionMasks.find((mask) => mask.id === maskId) : null;
    set({
      occlusionEditObjectId: objectId,
      occlusionEditMaskId: existingMask ? existingMask.id : null,
      occlusionDraftPoints: existingMask ? existingMask.points : [],
      occlusionDraftFeather: existingMask ? existingMask.feather : DEFAULT_OCCLUSION_FEATHER,
      occlusionDraftOpacity: existingMask ? existingMask.opacity : DEFAULT_OCCLUSION_OPACITY,
    });
  },

  updateOcclusionDraftPoints: (points) => {
    const { occlusionEditObjectId } = get();
    if (!occlusionEditObjectId) return;
    set({ occlusionDraftPoints: points.map(clampOcclusionPoint01) });
  },

  setOcclusionDraftFeather: (value) => {
    const { occlusionEditObjectId } = get();
    if (!occlusionEditObjectId) return;
    set({ occlusionDraftFeather: clampOcclusionSetting(value) });
  },

  setOcclusionDraftOpacity: (value) => {
    const { occlusionEditObjectId } = get();
    if (!occlusionEditObjectId) return;
    set({ occlusionDraftOpacity: clampOcclusionSetting(value) });
  },

  applyOcclusionEdit: () => {
    const {
      occlusionEditObjectId,
      occlusionEditMaskId,
      occlusionDraftPoints,
      occlusionDraftFeather,
      occlusionDraftOpacity,
      document,
      past,
    } = get();
    if (!occlusionEditObjectId) return { applied: false };

    const resetState = {
      occlusionEditObjectId: null,
      occlusionEditMaskId: null,
      occlusionDraftPoints: [],
      occlusionDraftFeather: DEFAULT_OCCLUSION_FEATHER,
      occlusionDraftOpacity: DEFAULT_OCCLUSION_OPACITY,
    };

    const target = document.objects.find((object) => object.id === occlusionEditObjectId);
    if (!target || (target.kind !== 'display' && target.kind !== 'portable')) {
      set(resetState);
      return { applied: false };
    }

    const validation = validateOcclusionPolygon(occlusionDraftPoints);
    if (!validation.valid) return { applied: false, reason: validation.reason };

    const existingMask = occlusionEditMaskId
      ? target.occlusionMasks.find((mask) => mask.id === occlusionEditMaskId)
      : null;
    const isNoop =
      existingMask != null &&
      existingMask.feather === occlusionDraftFeather &&
      existingMask.opacity === occlusionDraftOpacity &&
      existingMask.points.length === occlusionDraftPoints.length &&
      existingMask.points.every(
        (point, index) =>
          point.x === occlusionDraftPoints[index]!.x && point.y === occlusionDraftPoints[index]!.y,
      );

    if (isNoop) {
      set(resetState);
      return { applied: true };
    }

    const nextMask: OcclusionMask = existingMask
      ? {
          ...existingMask,
          points: occlusionDraftPoints,
          feather: occlusionDraftFeather,
          opacity: occlusionDraftOpacity,
        }
      : {
          id: createId(),
          kind: 'polygon',
          points: occlusionDraftPoints,
          feather: occlusionDraftFeather,
          opacity: occlusionDraftOpacity,
          enabled: true,
        };
    const nextMasks = existingMask
      ? target.occlusionMasks.map((mask) => (mask.id === nextMask.id ? nextMask : mask))
      : [...target.occlusionMasks, nextMask];

    const nextDocument: EditorDocument = {
      ...document,
      objects: patchObjects(document.objects, occlusionEditObjectId, {
        occlusionMasks: nextMasks,
      } as Partial<SignageObject>),
    };
    set({
      document: nextDocument,
      past: pushHistory(past, document),
      future: [],
      ...resetState,
    });
    return { applied: true };
  },

  cancelOcclusionEdit: () => {
    set({
      occlusionEditObjectId: null,
      occlusionEditMaskId: null,
      occlusionDraftPoints: [],
      occlusionDraftFeather: DEFAULT_OCCLUSION_FEATHER,
      occlusionDraftOpacity: DEFAULT_OCCLUSION_OPACITY,
    });
  },

  deleteOcclusionMask: (objectId, maskId) => {
    const { document, past } = get();
    const target = document.objects.find((object) => object.id === objectId);
    if (!target || (target.kind !== 'display' && target.kind !== 'portable')) return;
    if (!target.occlusionMasks.some((mask) => mask.id === maskId)) return;

    const nextDocument: EditorDocument = {
      ...document,
      objects: patchObjects(document.objects, objectId, {
        occlusionMasks: target.occlusionMasks.filter((mask) => mask.id !== maskId),
      } as Partial<SignageObject>),
    };
    set({ document: nextDocument, past: pushHistory(past, document), future: [] });
  },

  setOcclusionMaskEnabled: (objectId, maskId, enabled) => {
    const { document, past } = get();
    const target = document.objects.find((object) => object.id === objectId);
    if (!target || (target.kind !== 'display' && target.kind !== 'portable')) return;
    const existing = target.occlusionMasks.find((mask) => mask.id === maskId);
    if (!existing || existing.enabled === enabled) return;

    const nextDocument: EditorDocument = {
      ...document,
      objects: patchObjects(document.objects, objectId, {
        occlusionMasks: target.occlusionMasks.map((mask) =>
          mask.id === maskId ? { ...mask, enabled } : mask,
        ),
      } as Partial<SignageObject>),
    };
    set({ document: nextDocument, past: pushHistory(past, document), future: [] });
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
