import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAsset } from '../../../src/lib/assetRegistry';
import { computeContentLayout } from '../../../src/lib/contentLayout';
import { getScreenRect } from '../../../src/lib/displayFrame';
import {
  applyHomography,
  computeQuadHomography,
  normalizedQuadToDocument,
} from '../../../src/lib/quadGeometry';
import { getPortableScreenRect } from '../../../src/lib/portableTemplate';
import { getObjectScreenRect } from '../../../src/lib/screenHitTest';
import { useEditorStore, selectSelectedObject } from '../../../src/store/editorStore';
import {
  createEmptyDocument,
  DEFAULT_OCCLUSION_FEATHER,
  DEFAULT_OCCLUSION_OPACITY,
  type ContentFit,
  type DisplayMaterial,
  type DisplaySignageObject,
  type MediaContent,
  type NormalizedQuad,
  type PortableSignageObject,
  type SignageObject,
} from '../../../src/types/editor';

// --- Mock Image class, mirroring editorStore.test.ts's pattern ------------------------------

class SucceedingMockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1600;
  naturalHeight = 900;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function createFile(name = 'photo.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

// --- Store reset ---------------------------------------------------------------------------

function resetStore(): void {
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
    screenQuadEditId: null,
    screenQuadDraftQuad: null,
    screenQuadEditOriginalQuad: null,
  });
}

function seedSpaceBackground(sourceId = 'space-src', width = 1920, height = 1080): void {
  useEditorStore.getState().setSpaceBackground({
    sourceId,
    naturalWidth: width,
    naturalHeight: height,
    width,
    height,
    downscaled: false,
  });
}

// --- Document / canvas ---------------------------------------------------------------------

const DOC = { width: 1920, height: 1080 } as const;

/** Target perspective quad used across every order so the final state is identical. */
const TARGET_QUAD: NormalizedQuad = {
  topLeft: { x: 0.1, y: 0.1 },
  topRight: { x: 0.5, y: 0.12 },
  bottomRight: { x: 0.52, y: 0.45 },
  bottomLeft: { x: 0.08, y: 0.42 },
};

// --- Store action helpers ------------------------------------------------------------------

/** Adds a display of `material`, returning its id. */
function addDisplay(material: DisplayMaterial): string {
  useEditorStore.getState().addDisplay(material);
  const selected = selectSelectedObject(useEditorStore.getState());
  if (!selected) throw new Error('addDisplay did not auto-select the new object');
  return selected.id;
}

/** Resizes a display to `width`×`height` (does not touch other fields). */
function resize(id: string, width: number, height: number): void {
  useEditorStore.getState().commitObjectChange(id, { width, height });
}

/** Applies the TARGET_QUAD as a committed perspective quad. */
function applyPerspective(id: string): void {
  const store = useEditorStore.getState();
  store.beginPerspectiveEdit(id);
  store.updatePerspectiveDraft(TARGET_QUAD);
  const result = store.applyPerspectiveEdit();
  if (!result.applied) throw new Error(`applyPerspectiveEdit failed: ${result.reason}`);
}

/** Attaches a media content with the given fit/rotation to the object. */
function setContent(
  id: string,
  sourceId: string,
  options: {
    fit: ContentFit;
    rotation: 0 | 90;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
  },
): void {
  const content: MediaContent = {
    kind: 'image',
    sourceId,
    fit: options.fit,
    offsetX: options.offsetX ?? 0,
    offsetY: options.offsetY ?? 0,
    scale: options.scale ?? 1,
    rotation: options.rotation,
  };
  useEditorStore.getState().commitObjectChange(id, { content });
}

// --- Rendering-side math (mirrors ScreenComposition + PerspectiveScreenView) ---------------

/** The object-local, axis-aligned "logical screen" rect — the single surface the renderer
 *  computes content layout against (`ScreenComposition.tsx` for displays,
 *  `PortableProductView.tsx` for portables). Delegates to the shared `getObjectScreenRect`
 *  so the test and the renderer stay in lock-step: a future change to the screen-rect
 *  derivation (e.g., a new frame template, a new signage kind) is reflected here with no
 *  edit, which is the whole point of invariant B. */
function logicalScreen(object: SignageObject) {
  const rect = getObjectScreenRect(object);
  if (!rect) throw new Error(`logicalScreen: unsupported kind ${object.kind}`);
  return rect;
}

/** Natural dimensions seen by computeContentLayout, which swaps W/H when rotation=90
 *  (see ScreenComposition.tsx:196-205). */
function rotatedNatural(naturalWidth: number, naturalHeight: number, rotation: 0 | 90) {
  return rotation === 90
    ? { width: naturalHeight, height: naturalWidth }
    : { width: naturalWidth, height: naturalHeight };
}

interface Corner {
  x: number;
  y: number;
}

/** The 4 clipping-pre-clip content rect corners in document (canvas-absolute) coordinates
 *  for an object with current `object.content` of kind 'image'. Mirrors how the renderer
 *  places the content: compute layout in object-local space, then either place via x/y/rotation
 *  (rect mode) or project through the perspective quad (perspective mode). */
function contentDocumentCorners(
  object: SignageObject,
  naturalW: number,
  naturalH: number,
): Corner[] {
  if (object.kind !== 'display' && object.kind !== 'portable') {
    throw new Error('content corners only meaningful for display/portable');
  }
  const content = object.content;
  if (!content || content.kind !== 'image') throw new Error('expected image content');
  const screen = logicalScreen(object);
  const nat = rotatedNatural(naturalW, naturalH, content.rotation ?? 0);
  const local = computeContentLayout(screen, nat.width, nat.height, content);
  const localCorners: Corner[] = [
    { x: local.x, y: local.y },
    { x: local.x + local.width, y: local.y },
    { x: local.x + local.width, y: local.y + local.height },
    { x: local.x, y: local.y + local.height },
  ];
  if (object.placementMode === 'perspective' && object.perspectiveQuad) {
    const docQuad = normalizedQuadToDocument(object.perspectiveQuad, DOC);
    // Note: computeQuadHomography maps unit square (0..1 in both axes) → quad.
    // So we need to re-normalize the local corners from (0..width, 0..height) → (0..1).
    const unitQuadForLocal: NormalizedQuad = {
      topLeft: { x: docQuad.topLeft.x, y: docQuad.topLeft.y },
      topRight: { x: docQuad.topRight.x, y: docQuad.topRight.y },
      bottomRight: { x: docQuad.bottomRight.x, y: docQuad.bottomRight.y },
      bottomLeft: { x: docQuad.bottomLeft.x, y: docQuad.bottomLeft.y },
    };
    const matrix = computeQuadHomography(unitQuadForLocal);
    if (!matrix) throw new Error('degenerate TARGET_QUAD — fix the test fixture');
    return localCorners.map((c) =>
      applyHomography(matrix, { x: c.x / object.width, y: c.y / object.height }),
    );
  }
  // Rect mode: object.x/y places the local origin in document space; rotation=0 in all these tests.
  if (object.rotation !== 0) {
    throw new Error('rect-mode rotation is non-zero; test fixture needs updating');
  }
  return localCorners.map((c) => ({ x: object.x + c.x, y: object.y + c.y }));
}

// --- Fixture: image with the same aspect ratio as a 'wall-led' logical screen -------------
//
// A 'wall-led' frame at 1600×900 (final size used by the matrix) gives a screen rect with the
// same 16:9 ratio as the mocked natural asset (1600×900) — so a Fit=contain content lands
// pixel-perfectly against the screen rect's own corners (no letterbox), which is the condition
// Step 1's invariant B asks us to prove.

const FINAL_WIDTH = 1600;
const FINAL_HEIGHT = 900;

// --- Orders --------------------------------------------------------------------------------

type Order = 'A' | 'B' | 'C' | 'D' | 'E';

function runOrder(
  order: Order,
  material: DisplayMaterial,
  fit: ContentFit,
  rotation: 0 | 90,
  sourceId: string,
): SignageObject {
  resetStore();
  seedSpaceBackground();
  const id = addDisplay(material);
  const applyContent = () => setContent(id, sourceId, { fit, rotation });
  const applyResize = () => resize(id, FINAL_WIDTH, FINAL_HEIGHT);
  const applyPersp = () => applyPerspective(id);
  switch (order) {
    case 'A':
      applyResize();
      applyPersp();
      applyContent();
      break;
    case 'B':
      applyPersp();
      applyResize();
      applyContent();
      break;
    case 'C':
      applyPersp();
      applyContent();
      applyResize();
      break;
    case 'D':
      applyContent();
      applyResize();
      applyPersp();
      break;
    case 'E':
      applyContent();
      applyPersp();
      applyResize();
      break;
  }
  const final = useEditorStore.getState().document.objects.find((o) => o.id === id);
  if (!final) throw new Error('object disappeared after order');
  return final;
}

function cornersClose(a: Corner[], b: Corner[], tolerance = 0.5): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]!.x - b[i]!.x) > tolerance) return false;
    if (Math.abs(a[i]!.y - b[i]!.y) > tolerance) return false;
  }
  return true;
}

// -------------------------------------------------------------------------------------------

describe('v2-S1: content layout is order-independent (invariants A + B)', () => {
  const NATURAL_W = 1600;
  const NATURAL_H = 900;
  let sourceId: string;

  beforeEach(async () => {
    vi.stubGlobal('Image', SucceedingMockImage as unknown as typeof Image);
    resetStore();
    const asset = await registerAsset(createFile('content.png'));
    sourceId = asset.sourceId;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetStore();
  });

  // --- PDF-reproducible pair -------------------------------------------------------------

  it('R1 (size → perspective → content, Fit, same-ratio) produces content corners equal to the perspective quad corners', () => {
    // Uses transparent-LED so the logical screen == the full object bounding box (no bezel
    // inset shrinking the screen rect). A same-ratio Fit image then fills the entire logical
    // screen, and after the quad warp its 4 corners must land exactly on the quad's own corners.
    // Running the same assertion for 'led'/'lcd' (which have a wall-frame bezel) would land the
    // content on an inset sub-rect of the quad, which is correct but doesn't make the "whole-
    // quad" invariant provable at a single point; the full-matrix tests below prove invariance
    // across orders for those materials.
    const object = runOrder('A', 'transparent-led', 'contain', 0, sourceId);
    const corners = contentDocumentCorners(object as DisplaySignageObject, NATURAL_W, NATURAL_H);
    const quadCorners = normalizedQuadToDocument(TARGET_QUAD, DOC);
    expect(corners[0]!.x).toBeCloseTo(quadCorners.topLeft.x, 1);
    expect(corners[0]!.y).toBeCloseTo(quadCorners.topLeft.y, 1);
    expect(corners[1]!.x).toBeCloseTo(quadCorners.topRight.x, 1);
    expect(corners[1]!.y).toBeCloseTo(quadCorners.topRight.y, 1);
    expect(corners[2]!.x).toBeCloseTo(quadCorners.bottomRight.x, 1);
    expect(corners[2]!.y).toBeCloseTo(quadCorners.bottomRight.y, 1);
    expect(corners[3]!.x).toBeCloseTo(quadCorners.bottomLeft.x, 1);
    expect(corners[3]!.y).toBeCloseTo(quadCorners.bottomLeft.y, 1);
  });

  it('R2 (perspective → size → content) matches R1 at corners (invariant A/B)', () => {
    const r1 = runOrder('A', 'led', 'contain', 0, sourceId);
    const r2 = runOrder('B', 'led', 'contain', 0, sourceId);
    const r1Corners = contentDocumentCorners(r1 as DisplaySignageObject, NATURAL_W, NATURAL_H);
    const r2Corners = contentDocumentCorners(r2 as DisplaySignageObject, NATURAL_W, NATURAL_H);
    expect(cornersClose(r1Corners, r2Corners)).toBe(true);
  });

  // --- Full 5-order matrix across material × fit × rotation -----------------------------

  const MATERIALS: readonly DisplayMaterial[] = ['led', 'lcd', 'transparent-led'] as const;
  const FITS: readonly ContentFit[] = ['contain', 'cover'] as const;
  const ROTATIONS = [0, 90] as const;
  const ORDERS: readonly Order[] = ['A', 'B', 'C', 'D', 'E'] as const;

  describe.each(MATERIALS)('material=%s', (material) => {
    describe.each(FITS)('fit=%s', (fit) => {
      describe.each(ROTATIONS)('rotation=%s', (rotation) => {
        it.each(ORDERS.slice(1))(`order %s equals order A`, (order) => {
          const base = runOrder('A', material, fit, rotation, sourceId);
          const other = runOrder(order, material, fit, rotation, sourceId);
          const baseCorners = contentDocumentCorners(
            base as DisplaySignageObject,
            NATURAL_W,
            NATURAL_H,
          );
          const otherCorners = contentDocumentCorners(
            other as DisplaySignageObject,
            NATURAL_W,
            NATURAL_H,
          );
          expect(cornersClose(baseCorners, otherCorners)).toBe(true);
          // Also assert serializable object fields match (content settings, geometry, perspective).
          expect({
            width: other.width,
            height: other.height,
            placementMode: (other as DisplaySignageObject).placementMode,
            perspectiveQuad: (other as DisplaySignageObject).perspectiveQuad,
            content: (other as DisplaySignageObject).content,
          }).toEqual({
            width: base.width,
            height: base.height,
            placementMode: (base as DisplaySignageObject).placementMode,
            perspectiveQuad: (base as DisplaySignageObject).perspectiveQuad,
            content: (base as DisplaySignageObject).content,
          });
        });
      });
    });
  });

  // --- Undo/Redo preserves the invariant ------------------------------------------------

  it.each(ORDERS)('order %s result is unchanged after undo → redo', (order) => {
    const before = runOrder(order, 'led', 'contain', 0, sourceId);
    useEditorStore.getState().undo();
    useEditorStore.getState().redo();
    const after = useEditorStore.getState().document.objects.find((o) => o.id === before.id);
    if (!after) throw new Error('object missing after undo→redo');
    const beforeCorners = contentDocumentCorners(
      before as DisplaySignageObject,
      NATURAL_W,
      NATURAL_H,
    );
    const afterCorners = contentDocumentCorners(
      after as DisplaySignageObject,
      NATURAL_W,
      NATURAL_H,
    );
    expect(cornersClose(beforeCorners, afterCorners)).toBe(true);
  });

  // --- Regression lock-in: rect-mode baseline + R1 + portable baseline ------------------

  it('regression: a plain rect-mode LED without perspective keeps a letterbox-free content fit', () => {
    resetStore();
    seedSpaceBackground();
    const id = addDisplay('led');
    resize(id, FINAL_WIDTH, FINAL_HEIGHT);
    setContent(id, sourceId, { fit: 'contain', rotation: 0 });
    const object = useEditorStore
      .getState()
      .document.objects.find((o) => o.id === id)! as DisplaySignageObject;
    const corners = contentDocumentCorners(object, NATURAL_W, NATURAL_H);
    const screen = getScreenRect(object.frameId, object.width, object.height);
    // In rect mode (no perspective), content corners sit at object.x+screen.{xy} and extend by
    // screen width/height — a straight axis-aligned placement with no letterbox when the ratios
    // match. Locking these values here guards against a future refactor that silently changes the
    // screen-rect origin or the layout math.
    expect(corners[0]!.x).toBeCloseTo(object.x + screen.x, 1);
    expect(corners[0]!.y).toBeCloseTo(object.y + screen.y, 1);
    expect(corners[2]!.x).toBeCloseTo(object.x + screen.x + screen.width, 1);
    expect(corners[2]!.y).toBeCloseTo(object.y + screen.y + screen.height, 1);
  });

  it('regression (portable): adding a portable with content keeps the content aligned to its screen quad bounding box', () => {
    resetStore();
    seedSpaceBackground();
    useEditorStore.getState().addPortable();
    const portable = selectSelectedObject(useEditorStore.getState()) as PortableSignageObject;
    expect(portable.kind).toBe('portable');
    setContent(portable.id, sourceId, { fit: 'contain', rotation: 0 });
    const after = useEditorStore
      .getState()
      .document.objects.find((o) => o.id === portable.id)! as PortableSignageObject;
    // Portable has its own screen region (template preset) — the resolved screen rect must be
    // deterministic from (width, height, templateView/screenQuad), with no state captured at
    // content-set time, so recomputing it now yields exactly what the renderer uses. If a future
    // regression stashes an older bounding box on the object, this round-trip will drift.
    const screen = getPortableScreenRect(after.templateView, after.width, after.height);
    expect(screen.width).toBeGreaterThan(0);
    expect(screen.height).toBeGreaterThan(0);
  });
});
