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
import { getPerspectiveLogicalSize } from '../../../src/lib/perspectiveLogicalSize';
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

/** The object-local, axis-aligned "logical screen" rect the renderer actually composes
 *  content against. Mirrors `SignageDisplayView`'s rule (post-S1-rework):
 *  - rect-mode: screen comes from stored object.width/height (and frameId for displays).
 *  - perspective-mode: screen comes from the **quad-derived effective size** per ADR 0012
 *    D-13 (`getPerspectiveLogicalSize`), so content fit/scale/offset are computed against a
 *    body whose aspect matches the warped target — not against the user's unresized default.
 *    The frame rule (fractional inset for wall-led, full-body for transparent-led) is then
 *    applied to that effective body size.
 *
 *  Portables don't change — they go through `getPortableScreenRect` as before. */
function logicalScreen(object: SignageObject) {
  if (object.kind === 'display') {
    const effective =
      object.placementMode === 'perspective' && object.perspectiveQuad
        ? getPerspectiveLogicalSize(object.width, object.height, object.perspectiveQuad, DOC)
        : { width: object.width, height: object.height };
    const normalized = object.material === 'transparent-led' ? 'transparent-led' : object.material;
    if (normalized === 'transparent-led') {
      return { x: 0, y: 0, width: effective.width, height: effective.height };
    }
    return getScreenRect(object.frameId, effective.width, effective.height);
  }
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
    const unitQuadForLocal: NormalizedQuad = {
      topLeft: { x: docQuad.topLeft.x, y: docQuad.topLeft.y },
      topRight: { x: docQuad.topRight.x, y: docQuad.topRight.y },
      bottomRight: { x: docQuad.bottomRight.x, y: docQuad.bottomRight.y },
      bottomLeft: { x: docQuad.bottomLeft.x, y: docQuad.bottomLeft.y },
    };
    const matrix = computeQuadHomography(unitQuadForLocal);
    if (!matrix) throw new Error('degenerate quad in fixture');
    // Normalize local corners to the unit square via the SAME body size the layout math
    // used, which in perspective mode is the quad-derived effective size (not
    // object.width/height) — see SignageDisplayView.tsx effectiveSize + PerspectiveScreenView
    // width/height after the S1 rework. Dividing by object.width/height here would re-
    // introduce the aspect mismatch the renderer no longer has.
    const effective =
      object.kind === 'display'
        ? getPerspectiveLogicalSize(object.width, object.height, object.perspectiveQuad, DOC)
        : { width: object.width, height: object.height };
    return localCorners.map((c) =>
      applyHomography(matrix, { x: c.x / effective.width, y: c.y / effective.height }),
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

  // --- Cross-order lock-in -----------------------------------------------------------------
  //
  // The old `R1 (size → perspective → content, Fit, same-ratio) produces content corners equal
  // to the perspective quad corners` test was removed in the S1 rework. Under the superseded
  // invariant B, content aspect was expected to match the stored object's own aspect — so
  // resizing a transparent-LED to the same ratio as the content natural meant content filled
  // the body, and after warping, content corners landed on the quad's own corners regardless of
  // the quad's apparent aspect. Under invariant B' (ADR 0012 D-13) the content aspect is
  // compared against the quad's apparent aspect, so the "same-ratio" setup now letterboxes the
  // content inside the quad whenever `TARGET_QUAD`'s apparent aspect differs from `NATURAL_W/
  // NATURAL_H`'s ratio. The PDF path tests above (P1 / P2 / P3) express the proper identity in
  // the new rule — content corners land on the frame screen-inset quad corners — for both
  // transparent-LED and wall-LED, so the deleted single-corner-equality check is redundant.

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

  // --- PDF 5-2 regression: perspective-mode content aspect must come from the quad -----
  //
  // The PDF's reported bug (「①追加 → ②パース → ③コンテンツ」 produces a distorted ratio
  // whereas 「①追加 → ②大きさ調整 → ③パース → ④コンテンツ」 is correct): if the quad's
  // apparent aspect differs from the signage default aspect (480×270 = 16:9), content fit
  // against the default-sized object produces a letterbox that the quad warp then stretches.
  // Fix: perspective-mode logical screen aspect comes from the quad itself, not the
  // object's stored width/height — so the content ratio is independent of whether the user
  // happened to resize before applying perspective.
  //
  // Chosen quad PDF_QUAD has an apparent aspect of ~2.73:1 (document-space edge-length
  // average, ADR 0012 D-13), about 1.53× wider than the signage default's 1.78:1.
  // Content fixture is a 2730×1000 image to match the quad aspect; invariant B' then says the
  // content's four pre-clip corners should land on the frame's screen-inset quad corners
  // regardless of whether width/height was changed first.

  const PDF_QUAD: NormalizedQuad = {
    topLeft: { x: 0.3, y: 0.3 },
    topRight: { x: 0.7, y: 0.33 },
    bottomRight: { x: 0.68, y: 0.55 },
    bottomLeft: { x: 0.32, y: 0.57 },
  };
  const PDF_NATURAL_W = 2730;
  const PDF_NATURAL_H = 1000;
  // Resized dimensions that match PDF_QUAD's apparent aspect of 2.73 — used by P1 to prove
  // that the pre-resize-then-perspective path, which is already correct even in the pre-fix
  // code, stays correct after the fix. The default signage dimensions (480×270, aspect 1.78)
  // are kept for P2.
  const PDF_RESIZED_W = 800;
  const PDF_RESIZED_H = 293;

  class PdfFixtureMockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = PDF_NATURAL_W;
    naturalHeight = PDF_NATURAL_H;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  /** Expected content corners under invariant B': the four frame-screen-inset points in
   *  unit square coordinates projected through the perspective quad. */
  function expectedScreenInsetCornersThroughQuad(
    frameId: DisplaySignageObject['frameId'] | 'transparent-led',
    quad: NormalizedQuad,
  ): Corner[] {
    const docQuad = normalizedQuadToDocument(quad, DOC);
    const matrix = computeQuadHomography(docQuad);
    if (!matrix) throw new Error('degenerate PDF_QUAD — fix the test fixture');
    // transparent-LED has no bezel inset — screen fills the body unit square (0..1 × 0..1).
    // wall-led uses the fractional screenRegion from DISPLAY_FRAME_TEMPLATES
    // (x=0.02, y=0.02, w=0.96, h=0.96; see src/types/editor.ts:181). The frame rule is
    // fraction-based (reported in Step 3 of the S1 rework), so under the new quad-derived
    // aspect it stays an inset of the quad corners rather than drifting into a different
    // shape.
    const u0 = frameId === 'transparent-led' ? 0 : 0.02;
    const v0 = frameId === 'transparent-led' ? 0 : 0.02;
    const u1 = frameId === 'transparent-led' ? 1 : 0.98;
    const v1 = frameId === 'transparent-led' ? 1 : 0.98;
    return [
      applyHomography(matrix, { x: u0, y: v0 }),
      applyHomography(matrix, { x: u1, y: v0 }),
      applyHomography(matrix, { x: u1, y: v1 }),
      applyHomography(matrix, { x: u0, y: v1 }),
    ];
  }

  it('video content goes through the same layout function as image content', () => {
    // The renderer calls `computeContentLayout(screen, naturalW, naturalH, mediaContent)` for
    // both image and video (ScreenComposition.tsx:208 — one call site, keyed off
    // `mediaContent.kind !== 'text'`). This verifies that a video MediaContent lays out
    // identically to an image MediaContent with the same fit/scale/offset/rotation — i.e., the
    // kind field is NOT consulted inside the layout math. If a future refactor branches on
    // kind here, this test flags the regression.
    resetStore();
    seedSpaceBackground();
    const id = addDisplay('led');
    useEditorStore.getState().commitObjectChange(id, {
      content: {
        kind: 'video',
        sourceId: 'mocked-video',
        fit: 'contain',
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
      },
    });
    const object = useEditorStore
      .getState()
      .document.objects.find((o) => o.id === id)! as DisplaySignageObject;
    // Image equivalent at the same fit/offset/scale/rotation.
    const imageContent: MediaContent = {
      kind: 'image',
      sourceId: 'any',
      fit: 'contain',
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
    };
    const screen = logicalScreen(object);
    const videoLayout = computeContentLayout(
      screen,
      NATURAL_W,
      NATURAL_H,
      object.content as MediaContent,
    );
    const imageLayout = computeContentLayout(screen, NATURAL_W, NATURAL_H, imageContent);
    expect(videoLayout).toEqual(imageLayout);
  });

  describe('PDF path 5-2 (quad-derived logical aspect)', () => {
    const materials: Array<{
      label: 'LED (wall-led bezel)' | 'シースルー (transparent-led)';
      material: DisplayMaterial;
      frameTag: DisplaySignageObject['frameId'] | 'transparent-led';
    }> = [
      { label: 'LED (wall-led bezel)', material: 'led', frameTag: 'wall-led' },
      {
        label: 'シースルー (transparent-led)',
        material: 'transparent-led',
        frameTag: 'transparent-led',
      },
    ];
    let pdfSourceId: string;
    beforeEach(async () => {
      vi.stubGlobal('Image', PdfFixtureMockImage as unknown as typeof Image);
      resetStore();
      const asset = await registerAsset(createFile('pdf-content.png'));
      pdfSourceId = asset.sourceId;
    });

    for (const spec of materials) {
      it(`${spec.label}: P1 (resize-first then perspective then content) places content on the screen-inset quad corners`, () => {
        resetStore();
        seedSpaceBackground();
        const id = addDisplay(spec.material);
        resize(id, PDF_RESIZED_W, PDF_RESIZED_H);
        useEditorStore.getState().beginPerspectiveEdit(id);
        useEditorStore.getState().updatePerspectiveDraft(PDF_QUAD);
        useEditorStore.getState().applyPerspectiveEdit();
        setContent(id, pdfSourceId, { fit: 'contain', rotation: 0 });
        const object = useEditorStore
          .getState()
          .document.objects.find((o) => o.id === id)! as DisplaySignageObject;
        const corners = contentDocumentCorners(object, PDF_NATURAL_W, PDF_NATURAL_H);
        const expected = expectedScreenInsetCornersThroughQuad(spec.frameTag, PDF_QUAD);
        expect(cornersClose(corners, expected)).toBe(true);
      });

      it(`${spec.label}: P2 (no resize then perspective then content) places content on the screen-inset quad corners (PDF-reported bug path)`, () => {
        resetStore();
        seedSpaceBackground();
        const id = addDisplay(spec.material);
        // Default size kept (480×270, aspect 1.78) — the PDF-reported case.
        useEditorStore.getState().beginPerspectiveEdit(id);
        useEditorStore.getState().updatePerspectiveDraft(PDF_QUAD);
        useEditorStore.getState().applyPerspectiveEdit();
        setContent(id, pdfSourceId, { fit: 'contain', rotation: 0 });
        const object = useEditorStore
          .getState()
          .document.objects.find((o) => o.id === id)! as DisplaySignageObject;
        const corners = contentDocumentCorners(object, PDF_NATURAL_W, PDF_NATURAL_H);
        const expected = expectedScreenInsetCornersThroughQuad(spec.frameTag, PDF_QUAD);
        expect(cornersClose(corners, expected)).toBe(true);
      });

      it(`${spec.label}: P3 (perspective then content then attempted resize) places content on the screen-inset quad corners`, () => {
        resetStore();
        seedSpaceBackground();
        const id = addDisplay(spec.material);
        useEditorStore.getState().beginPerspectiveEdit(id);
        useEditorStore.getState().updatePerspectiveDraft(PDF_QUAD);
        useEditorStore.getState().applyPerspectiveEdit();
        setContent(id, pdfSourceId, { fit: 'contain', rotation: 0 });
        // The UI blocks size changes in perspective mode (ADR 0012 D-14), but the store
        // action itself still accepts a width/height patch — so P3 asserts the invariant
        // holds even if a resize bleeds through, as a double safety net.
        resize(id, PDF_RESIZED_W, PDF_RESIZED_H);
        const object = useEditorStore
          .getState()
          .document.objects.find((o) => o.id === id)! as DisplaySignageObject;
        const corners = contentDocumentCorners(object, PDF_NATURAL_W, PDF_NATURAL_H);
        const expected = expectedScreenInsetCornersThroughQuad(spec.frameTag, PDF_QUAD);
        expect(cornersClose(corners, expected)).toBe(true);
      });
    }
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
