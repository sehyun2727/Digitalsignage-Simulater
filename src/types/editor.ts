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
  /**
   * Registered asset id (see src/lib/assetRegistry.ts), same lifecycle as space background /
   * display content — the decoded image and its object URL are managed there and swept when no
   * document/history snapshot still references this id. Replaces the earlier raw-object-URL
   * `src` field, which leaked one URL per Add-Image / Delete cycle because the reachability
   * sweep only tracks registry sourceIds.
   */
  sourceId: string;
  naturalWidth: number;
  naturalHeight: number;
}

/** How uploaded screen content is fit within a display's screen region. */
export type ContentFit = 'contain' | 'cover';

/** The kind of media a signage screen shows. Video was added in Sprint 4.3 (ADR 0008). */
export type ContentKind = 'image' | 'video';

/**
 * A user-supplied image or video shown inside a display object's screen region.
 * `sourceId` keys into the runtime asset registry (src/lib/assetRegistry.ts) rather than
 * embedding a Blob URL directly, so undo/redo history can hold plain, serializable state
 * while decoded image/video/Object URL resources are managed separately with their own
 * lifecycle. Video playback state (play/pause, current time, mute) is deliberately not part of
 * this type — it is transient runtime state, not document/history state (sprint spec section 26).
 */
export interface SignageContent {
  kind: ContentKind;
  sourceId: string;
  fit: ContentFit;
  /** Fraction of the screen width/height the content center is shifted, roughly -1..1. */
  offsetX: number;
  offsetY: number;
  /** Multiplier on top of the fit-derived base size. 1 = the fit baseline, no zoom. */
  scale: number;
  /**
   * Rotation applied to the content itself (independent of the display object's own rotation),
   * in 90-degree increments. Only 0 and 90 are supported — that is enough to solve the "portrait
   * photo dropped into a landscape screen leaves black bars" case, which is the actual user
   * complaint auto-rotation exists to fix. Default is computed at upload/drop time from the ratio
   * of the target screen vs. the content's own natural dimensions, so a mismatched-orientation
   * asset lands rotated by default; the user can still flip it back to 0 via the content controls.
   * Optional so existing history snapshots created before this field existed keep parsing (treated
   * as 0 = no rotation).
   */
  rotation?: 0 | 90;
}

export const MIN_CONTENT_SCALE = 1;
export const MAX_CONTENT_SCALE = 3;
export const MAX_CONTENT_OFFSET = 1;

/**
 * Visual-preview-only screen display technologies. These approximate how content reads on an
 * LED wall, an LCD panel, or a transparent LED mesh; they do not simulate real product
 * photometry (see ADR 0003, ADR 0007). `'outdoor-led'` is the Sprint 2-4.1 legacy value kept
 * only so `normalizeMaterial` (src/lib/materialTexture.ts) can migrate any in-memory state
 * created before Sprint 4.2 without crashing.
 */
export type DisplayMaterial = 'led' | 'lcd' | 'transparent-led' | 'outdoor-led';

/** The set of materials a freshly created object or the material <select> should offer. */
export const CURRENT_DISPLAY_MATERIALS: readonly Exclude<DisplayMaterial, 'outdoor-led'>[] = [
  'led',
  'lcd',
  'transparent-led',
];

export interface MaterialSettings {
  /** Strength of the material's texture/glow overlay, 0-100 (LED grid / LCD reflection base). */
  intensity: number;
  /** Screen brightness wash, 0-100; 50 is neutral (no wash applied). */
  brightness: number;
  /** Transparent LED only: how much the space photo shows through dark screen areas, 0-100. */
  transparency: number;
  /** Advanced: visual pixel/mesh grid density, 0-100 (LED, Transparent LED). */
  gridDensity: number;
  /** Advanced: glow/bloom impression around bright content, 0-100 (LED, Transparent LED). */
  glow: number;
  /** Advanced: mild contrast boost, 0-100; 50 is neutral. */
  contrast: number;
}

export const DEFAULT_MATERIAL_SETTINGS: MaterialSettings = {
  intensity: 50,
  brightness: 50,
  transparency: 60,
  gridDensity: 50,
  glow: 40,
  contrast: 50,
};
export const MIN_MATERIAL_SETTING = 0;
export const MAX_MATERIAL_SETTING = 100;

/**
 * The clipping region for a display's screen, expressed as a fraction of the display
 * object's own bounding box so it scales/rotates with the object. Only 'rect' is used so far;
 * the 'polygon' variant is reserved for future photo-based templates whose screens are not
 * axis-aligned rectangles.
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

/**
 * Object *form* (mounting/frame shape) — deliberately independent of `DisplayMaterial` (display
 * technology). A wall-mounted rectangle can be LED, LCD, or Transparent LED; this sprint's Add
 * Signage buttons always create the plain wall form (see editorStore.addDisplay), but the stand
 * form and its rendering remain available for the object-form axis described in ADR 0007.
 */
export type DisplayFrameId = 'wall-led' | 'stand-display';

export interface DisplayFrameTemplate {
  id: DisplayFrameId;
  screenRegion: ScreenRegion;
  defaultWidth: number;
  defaultHeight: number;
}

export const DISPLAY_FRAME_TEMPLATES: Record<DisplayFrameId, DisplayFrameTemplate> = {
  'wall-led': {
    id: 'wall-led',
    screenRegion: { shape: 'rect', x: 0.02, y: 0.02, width: 0.96, height: 0.96 },
    defaultWidth: 480,
    defaultHeight: 270,
  },
  'stand-display': {
    id: 'stand-display',
    screenRegion: { shape: 'rect', x: 0.08, y: 0.04, width: 0.84, height: 0.72 },
    defaultWidth: 220,
    defaultHeight: 420,
  },
};

export type CurvatureMode = 'flat' | 'concave' | 'convex';

/** A visual-only 2D curvature approximation, not true 3D/perspective (see ADR 0007). */
export interface Curvature {
  mode: CurvatureMode;
  /** 0-100; meaningless (and ignored) while mode is 'flat'. */
  amount: number;
}

export const DEFAULT_CURVATURE: Curvature = { mode: 'flat', amount: 0 };
export const MIN_CURVATURE_AMOUNT = 0;
export const MAX_CURVATURE_AMOUNT = 100;

/** A single normalized (0-1, fraction of the current document) point. */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/**
 * A four-point perspective quad fitting signage to a photographed installation plane (ADR 0008).
 * Coordinates are normalized (0-1) fractions of the current photo-first document, not preview
 * CSS pixels or export pixels, so the quad survives space-photo replacement and canvas resizing
 * unchanged (see src/lib/quadGeometry.ts documentQuadToNormalized/normalizedQuadToDocument).
 * Corner order is always fixed — top-left, top-right, bottom-right, bottom-left — and is never
 * reassigned by validation or editing code (src/lib/quadGeometry.ts validateQuad).
 */
export interface NormalizedQuad {
  topLeft: NormalizedPoint;
  topRight: NormalizedPoint;
  bottomRight: NormalizedPoint;
  bottomLeft: NormalizedPoint;
}

/**
 * 'rect' is the existing axis-aligned/rotated bounding-box placement (x/y/width/height/rotation).
 * 'perspective' additionally warps the screen composition into `perspectiveQuad` (ADR 0008).
 * `perspectiveQuad` is populated as soon as the user has ever applied "Fit to space" once, and is
 * kept (not deleted) if they later switch back to 'rect', so re-entering perspective mode restores
 * their last quad instead of re-deriving a fresh one from the current rectangle.
 */
export type PlacementMode = 'rect' | 'perspective';

export const DEFAULT_PLACEMENT_MODE: PlacementMode = 'rect';

/**
 * A soft shadow cast by the signage silhouette onto the space photo, to help it read as sitting
 * on/against the photographed surface (sprint spec section 9). Visual-only, not a physically
 * based light/occlusion simulation.
 */
export interface ContactShadowSettings {
  enabled: boolean;
  /** 0-100 opacity/darkness of the shadow. */
  strength: number;
  /** 0-100 blur radius. */
  blur: number;
  /** Fraction of the signage silhouette size the shadow is offset, roughly -1..1. */
  offsetX: number;
  offsetY: number;
  /** 0-200 horizontal spread multiplier; 100 is neutral (matches the pre-4.5 fixed ratio). */
  spread: number;
  /** 0-200 vertical depth multiplier; 100 is neutral (mainly useful for freestanding ground shadows). */
  depth: number;
  /** -100 (cool/blue) .. 100 (warm/amber) shadow tint; 0 is neutral black. */
  tint: number;
}

export const DEFAULT_CONTACT_SHADOW: ContactShadowSettings = {
  enabled: false,
  strength: 50,
  blur: 50,
  offsetX: 0,
  offsetY: 0.2,
  spread: 100,
  depth: 100,
  tint: 0,
};
export const MIN_CONTACT_SHADOW_SETTING = 0;
export const MAX_CONTACT_SHADOW_SETTING = 100;
export const MIN_CONTACT_SHADOW_SPREAD = 0;
export const MAX_CONTACT_SHADOW_SPREAD = 200;
export const MIN_CONTACT_SHADOW_TINT = -100;
export const MAX_CONTACT_SHADOW_TINT = 100;

/**
 * A single bounded control blending the rendered signage toward the space photo's tone (reduced
 * saturation/contrast/highlight strength at higher settings) so it reads as more naturally
 * installed. Never modifies the source space photo itself (sprint spec section 9).
 */
export interface EnvironmentIntegrationSettings {
  /** 0-100; 0 disables all blending. */
  strength: number;
  /** Hex color sampled from the space photo by a user-triggered "sample environment" action
   * (sprint spec section 13/14), used as the blend wash tone in place of the fixed neutral gray.
   * Null until sampled, or after a reset/preset re-seed. */
  sampledColor: string | null;
}

export const DEFAULT_ENVIRONMENT_INTEGRATION: EnvironmentIntegrationSettings = {
  strength: 0,
  sampledColor: null,
};
export const MIN_ENVIRONMENT_INTEGRATION = 0;
export const MAX_ENVIRONMENT_INTEGRATION = 100;

/**
 * Which physical plane an object is installed against — a wall-mounted panel, a see-through
 * transparent-LED "window", or a freestanding portable device (sprint spec section 10). Drives
 * default/available contact-shadow behavior (see src/lib/environmentIntegration.ts
 * resolveShadowMode/SHADOW_MODE_BASE, whose `ShadowMode` type aliases this one). User-overridable
 * after creation; falls back to the material/kind-derived default for documents saved before this
 * field existed (see resolveInstallationMode in editorStore.ts).
 */
export type InstallationMode = 'wall' | 'window' | 'freestanding';

/**
 * A user-drawn polygon marking a foreground obstruction (e.g. a pillar, plant, or person standing
 * in front of the installed signage in the space photo) so the original photo pixels show through
 * instead of the rendered signage there (sprint spec section 7). Points are normalized (0-1)
 * fractions of the *whole document*, matching `NormalizedQuad` — they survive space-photo
 * replacement and canvas resizing unchanged, and are independent of the owning object's own
 * position/rotation/transform. Never modifies the source space photo; purely an extra render/clip
 * step (see src/lib/occlusion.ts, ScreenComposition-adjacent mask rendering).
 */
export interface OcclusionMask {
  id: ElementId;
  kind: 'polygon';
  points: NormalizedPoint[];
  /** 0-100 edge softness. */
  feather: number;
  /** 0-100 how fully the original photo replaces the rendered signage inside the mask. */
  opacity: number;
  enabled: boolean;
}

export const MIN_OCCLUSION_POINTS = 3;
export const MAX_OCCLUSION_POINTS = 24;
export const DEFAULT_OCCLUSION_FEATHER = 30;
export const DEFAULT_OCCLUSION_OPACITY = 100;
export const MIN_OCCLUSION_SETTING = 0;
export const MAX_OCCLUSION_SETTING = 100;

/**
 * A placeable signage display whose screen region clips user content and renders a material +
 * curvature preview. Document/export resolution is derived entirely from the space background
 * photo (see EditorDocument) — this object only describes where/how signage sits within it.
 */
export interface DisplaySignageObject extends BaseSignageObject {
  kind: 'display';
  frameId: DisplayFrameId;
  content: SignageContent | null;
  material: DisplayMaterial;
  materialSettings: MaterialSettings;
  curvature: Curvature;
  placementMode: PlacementMode;
  perspectiveQuad: NormalizedQuad | null;
  contactShadow: ContactShadowSettings;
  environmentIntegration: EnvironmentIntegrationSettings;
  installationMode: InstallationMode;
  occlusionMasks: OcclusionMask[];
}

/**
 * A user's own portable product photo (e.g. a photo of a kiosk, tablet stand, or vehicle they
 * own) with a rectangular screen region marked on it, so the content/material system can
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
  curvature: Curvature;
  placementMode: PlacementMode;
  perspectiveQuad: NormalizedQuad | null;
  contactShadow: ContactShadowSettings;
  environmentIntegration: EnvironmentIntegrationSettings;
  installationMode: InstallationMode;
  occlusionMasks: OcclusionMask[];
}

export type SignageObject =
  TextSignageObject | ImageSignageObject | DisplaySignageObject | PortableSignageObject;

/** The signage object kinds that have a screen and can be fit to a perspective quad. */
export type PerspectiveCapableObject = DisplaySignageObject | PortableSignageObject;

export function supportsPerspective(object: SignageObject): object is PerspectiveCapableObject {
  return object.kind === 'display' || object.kind === 'portable';
}

/**
 * The uploaded space/site photo shown behind all objects. `sourceId` keys into the same runtime
 * asset registry as display content.
 *
 * `naturalWidth`/`naturalHeight` are the photo's own decoded pixel size. `width`/`height` are the
 * *effective* decoded dimensions — identical to natural size unless the decoded pixel count
 * exceeded `MAX_DECODED_PIXELS` (src/lib/imageSafety.ts), in which case they are a deterministically
 * downscaled, aspect-ratio-preserving fallback. Since the canvas/export frame is now a fixed
 * `canvasPreset` (see ADR 0011) rather than following the photo, this is purely informational photo
 * metadata — the photo itself is cover-fit into the frame via `computeCoverFit`, independent of
 * these dimensions.
 */
export interface SpaceBackground {
  sourceId: string;
  naturalWidth: number;
  naturalHeight: number;
  width: number;
  height: number;
  downscaled: boolean;
}

/**
 * A fixed document/export frame size the user picks explicitly, independent of any uploaded space
 * photo (ADR 0011 — replaces the Sprint 4.2/ADR 0007 approach of deriving document size from the
 * photo's own pixel dimensions, which made the canvas awkwardly resize to whatever ratio the
 * uploaded photo happened to have).
 */
export type CanvasPresetId = 'landscape-16-9' | 'portrait-9-16';

export const CANVAS_PRESET_IDS: readonly CanvasPresetId[] = ['landscape-16-9', 'portrait-9-16'];

export const CANVAS_PRESET_SIZES: Record<CanvasPresetId, { width: number; height: number }> = {
  'landscape-16-9': { width: 1920, height: 1080 },
  'portrait-9-16': { width: 1080, height: 1920 },
};

export const DEFAULT_CANVAS_PRESET: CanvasPresetId = 'landscape-16-9';

export interface EditorDocument {
  spaceBackground: SpaceBackground | null;
  canvasPreset: CanvasPresetId;
  objects: SignageObject[];
}

export function createEmptyDocument(): EditorDocument {
  return {
    spaceBackground: null,
    canvasPreset: DEFAULT_CANVAS_PRESET,
    objects: [],
  };
}

/** The document/export size in effect right now — a fixed frame chosen via `canvasPreset`,
 *  independent of whether a space photo has been uploaded (see ADR 0011). */
export function getDocumentSize(document: EditorDocument): { width: number; height: number } {
  return CANVAS_PRESET_SIZES[document.canvasPreset];
}
