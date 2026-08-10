export type ElementId = string;

export interface BaseSignageObject {
  id: ElementId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface TextSignageObject extends BaseSignageObject {
  kind: 'text';
  text: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface ImageSignageObject extends BaseSignageObject {
  kind: 'image';
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

/** How uploaded screen content is fit within a display's screen region. */
export type ContentFit = 'contain' | 'cover';

/**
 * A user-supplied image shown inside a display object's screen region.
 * `sourceId` keys into the runtime asset registry (src/lib/assetRegistry.ts) rather than
 * embedding a Blob URL directly, so undo/redo history can hold plain, serializable state
 * while decoded image/Object URL resources are managed separately with their own lifecycle.
 */
export interface SignageContent {
  kind: 'image';
  sourceId: string;
  fit: ContentFit;
  /** Fraction of the screen width/height the content center is shifted, roughly -1..1. */
  offsetX: number;
  offsetY: number;
  /** Multiplier on top of the fit-derived base size. 1 = the fit baseline, no zoom. */
  scale: number;
}

export const MIN_CONTENT_SCALE = 1;
export const MAX_CONTENT_SCALE = 3;
export const MAX_CONTENT_OFFSET = 1;

/**
 * Visual-preview-only screen materials. These approximate how content reads on an
 * outdoor LED wall vs. an LCD panel; they do not simulate real product photometry
 * (see ADR 0003).
 */
export type DisplayMaterial = 'outdoor-led' | 'lcd';

export interface MaterialSettings {
  /** Strength of the material's texture/glow overlay, 0-100. */
  intensity: number;
  /** Screen brightness wash, 0-100; 50 is neutral (no wash applied). */
  brightness: number;
}

export const DEFAULT_MATERIAL_SETTINGS: MaterialSettings = { intensity: 50, brightness: 50 };
export const MIN_MATERIAL_SETTING = 0;
export const MAX_MATERIAL_SETTING = 100;

/**
 * The clipping region for a display's screen, expressed as a fraction of the display
 * object's own bounding box so it scales/rotates with the object. Only 'rect' is used in
 * Sprint 2; the 'polygon' variant is reserved for future photo-based templates (e.g.
 * DokoDemo) whose screens are not axis-aligned rectangles.
 */
export type ScreenRegion =
  | {
      shape: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      shape: 'polygon';
      points: number[];
    };

export type DisplayFrameId = 'wall-led' | 'stand-display';

export interface DisplayFrameTemplate {
  id: DisplayFrameId;
  screenRegion: ScreenRegion;
  defaultMaterial: DisplayMaterial;
  defaultWidth: number;
  defaultHeight: number;
}

export const DISPLAY_FRAME_TEMPLATES: Record<DisplayFrameId, DisplayFrameTemplate> = {
  'wall-led': {
    id: 'wall-led',
    screenRegion: { shape: 'rect', x: 0.02, y: 0.02, width: 0.96, height: 0.96 },
    defaultMaterial: 'outdoor-led',
    defaultWidth: 480,
    defaultHeight: 270,
  },
  'stand-display': {
    id: 'stand-display',
    screenRegion: { shape: 'rect', x: 0.08, y: 0.04, width: 0.84, height: 0.72 },
    defaultMaterial: 'lcd',
    defaultWidth: 220,
    defaultHeight: 420,
  },
};

/**
 * A placeable signage display (a physical Wall LED panel or Stand Display kiosk) whose
 * screen region clips user content and renders a material preview. Distinct from the
 * document-level `TemplateId`, which still controls the overall canvas/export resolution
 * from Sprint 1 — a display object is something placed *within* that canvas, optionally
 * over a space background photo (see EditorDocument.spaceBackground).
 */
export interface DisplaySignageObject extends BaseSignageObject {
  kind: 'display';
  frameId: DisplayFrameId;
  content: SignageContent | null;
  material: DisplayMaterial;
  materialSettings: MaterialSettings;
}

/**
 * A user's own portable product photo (e.g. a photo of a kiosk, tablet stand, or vehicle they
 * own) with a rectangular screen region marked on it, so Sprint 2's content/material system can
 * render simulated signage content inside that region. `screenRegion` is fraction-based
 * (0-1, relative to the *photo's own* pixel dimensions) rather than relative to the object's
 * bounding box like `DisplayFrameTemplate.screenRegion` — the two coincide in practice because
 * the object is always kept at the photo's own aspect ratio (see the transform aspect-lock in
 * CanvasObjectView.tsx), so `resolveScreenRegionRect` can consume this value unchanged.
 *
 * Deliberately flat (no nested `product: {...}` object) so every field stays exactly one level
 * deep, matching the shallow no-op comparison `hasObjectChange` in editorStore.ts performs
 * before committing a change — a nested screenRegion-only edit would otherwise always be
 * reported as "changed" even when no value actually differs.
 */
export interface PortableSignageObject extends BaseSignageObject {
  kind: 'portable';
  productSourceId: string;
  productIntrinsicWidth: number;
  productIntrinsicHeight: number;
  /** Whether the source photo has transparency; null when detection could not run. */
  productHasAlpha: boolean | null;
  screenRegion: { x: number; y: number; width: number; height: number };
  content: SignageContent | null;
  material: DisplayMaterial;
  materialSettings: MaterialSettings;
}

export type SignageObject =
  TextSignageObject | ImageSignageObject | DisplaySignageObject | PortableSignageObject;

export type TemplateId = 'wall-led' | 'stand-display';

export interface SignageTemplate {
  id: TemplateId;
  width: number;
  height: number;
}

export const TEMPLATES: Record<TemplateId, SignageTemplate> = {
  'wall-led': { id: 'wall-led', width: 1920, height: 1080 },
  'stand-display': { id: 'stand-display', width: 1080, height: 1920 },
};

export const DEFAULT_TEMPLATE_ID: TemplateId = 'wall-led';

/**
 * An optional space/site photo shown behind all objects, in place of the flat
 * `backgroundColor`, so signage display objects can be composed into a real environment.
 * `sourceId` keys into the same runtime asset registry as display content.
 */
export interface SpaceBackground {
  sourceId: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface EditorDocument {
  templateId: TemplateId;
  backgroundColor: string;
  spaceBackground: SpaceBackground | null;
  objects: SignageObject[];
}

export const DEFAULT_BACKGROUND_COLOR = '#0b1120';

export function createEmptyDocument(templateId: TemplateId = DEFAULT_TEMPLATE_ID): EditorDocument {
  return {
    templateId,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    spaceBackground: null,
    objects: [],
  };
}
