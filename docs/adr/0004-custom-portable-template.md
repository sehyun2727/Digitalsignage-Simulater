# ADR 0004: Custom portable product template for Sprint 3

## Status

Accepted — Sprint 3. Amended — Sprint 3.1 (direct pointer-driven move/resize; see the
region-definition and minimum-size clamp decisions below).

## Context

Sprint 3 lets a user upload their own product photo (a kiosk, tablet stand, vehicle, or
any other portable surface they own), mark a rectangular region on it as the "screen,"
and place the result on the canvas so Sprint 2's content/material system (fit, offset,
scale, Outdoor LED/LCD material) can render simulated signage content inside that region.
`CLAUDE.md` explicitly excludes perspective/4-point/polygon regions, multi-angle
generation, background removal, a product-photo crop editor, and multiple screen regions
from this sprint, and requires staying browser-local with no server storage. Several
implementation choices needed to be locked in before wiring the Toolbar, a new builder
modal, and the properties panel together.

## Decisions

- **The screen region is a single axis-aligned rectangle, normalized to the photo's own
  0-1 space**, not the object's bounding box space and not a polygon. `src/lib/portableRegion.ts`
  keeps `NormalizedRect` as a flat `{ x, y, width, height }` of primitives — consistent
  with the flat, one-level-deep shape `PortableSignageObject.screenRegion` needs to satisfy
  `hasObjectChange`'s shallow no-op comparison in `editorStore.ts` (the same constraint
  already documented on `DisplaySignageObject.materialSettings` in `src/types/editor.ts`).
  A `'polygon'` variant already exists on the unrelated `ScreenRegion` type for built-in
  display frames, reserved for a future photo-based template whose screen is not
  rectangular; this ADR does not extend that variant to portable objects.
- **The object's own bounding box is always kept at the product photo's native aspect
  ratio**, enforced by restricting the Konva `Transformer` to corner-only anchors with
  `keepRatio(true)` (see `CanvasObjectView.tsx`), plus a redundant `scaleY = scaleX` force
  in `handleTransformEnd` as a second line of defense against drift. Because of this,
  `screenRegion` (a fraction of the _photo's_ pixel dimensions) can be resolved directly
  against the object's current width/height by `resolveScreenRegionRect` — no separate
  "photo space vs. object space" conversion is needed at render time. This is also why
  there is no product-photo crop/reframe editor in this sprint: allowing the object to
  distort away from the photo's aspect ratio would break that direct mapping.
- **The builder is a three-step-capable, two-mode modal (`PortableBuilderModal.tsx`)**:
  `mode="create"` walks photo-select → define-region → add; `mode="edit-region"` (opened
  from the properties panel's "画面領域を編集" button) re-enters directly on the
  define-region step against an existing object, skipping the photo step and hiding the
  Back button, since replacing the photo itself is out of scope (see the next decision).
  This is the first modal/dialog in the app, so focus trap, Esc-to-close,
  focus-restore-on-close, and background-scroll lock are all built from scratch
  (`role="dialog"`, `aria-modal`, `aria-labelledby` via `useId()`) rather than reused from
  an existing pattern.
- **There is no way to replace a portable object's photo after creation.** `CLAUDE.md`
  explicitly excludes a product-photo crop editor from this sprint, and allowing photo
  replacement in place would reopen exactly that problem (a new photo's screen region and
  aspect ratio have no defined relationship to the old one). The properties panel instead
  shows `portableReplacePhotoHint`, telling the user to delete the object and add a new
  portable product if they want a different photo.
- **Region definition supports drag-to-draw on empty preview space
  (`normalizedRectFromPoints`), dragging inside the existing region box to move it
  (`moveNormalizedRect`), dragging one of its four corner handles to resize it
  (`resizeNormalizedRectClamped`, opposite corner fixed), and direct numeric
  x/y/width/height entry**, all sharing one `NormalizedRect` state value and all driven
  through the W3C Pointer Events API (`onPointerDown`/`onPointerMove`/`onPointerUp` plus
  `setPointerCapture`) so the same handlers serve mouse, touch, and pen input without
  device-specific branches (Sprint 3.1). Pointer coordinates are mapped through
  `computeContainRect` before being normalized, because `.portable-region-preview` renders
  the photo with `background-size: contain`: a photo whose aspect ratio doesn't match the
  4:3 preview box is letterboxed/pillarboxed, and drawing/moving/resizing against the raw
  container instead of the photo's own rendered sub-rect would misplace the region on any
  non-4:3 photo.
- **Resizing past the opposite corner clamps at `MIN_SCREEN_REGION_FRACTION` (5%) live,
  during the drag, instead of letting the box shrink further and only rejecting it on
  release** (`resizeNormalizedRectClamped`, Sprint 3.1). The dragged corner's distance from
  the fixed opposite corner is clamped to the minimum on each axis independently, so the
  box tracks the pointer smoothly right up to the boundary and can never invert even if the
  pointer crosses over the fixed corner. This was chosen over "stop at the last valid
  position," which would require remembering and reverting to a stale rect mid-drag.
  Direct numeric entry keeps the separate, non-clamping behavior below.
- **A region below `MIN_SCREEN_REGION_FRACTION` (5% of the photo on either axis) entered
  through the numeric fields — or left in that state after a pointer interaction, which
  `resizeNormalizedRectClamped`'s live clamp otherwise prevents — is rejected with an
  accessible `role="alert"` error on Save/Add**, not silently clamped up to the minimum.
  Silently resizing a user's explicit numeric entry to a different value than what they
  specified would be more surprising than asking them to try again.
- **A freshly uploaded photo gets `defaultScreenRegion()` — a centered 60%×60% region —
  as its starting region**, rather than an empty/zero-size region. This gives the user a
  large, immediately valid region to adjust from instead of an error state on first open.
- **`productHasAlpha` (best-effort transparency detection via `detectHasAlpha`, reused
  unchanged from Sprint 2's asset registry) is stored on the object and surfaced only as
  UI copy** (`portableBackgroundNotice`), not used to change rendering. Sprint 3 does not
  attempt background removal or masking — `CLAUDE.md` explicitly excludes both — so the
  detection result is informational only, telling the user a transparent PNG/WebP will
  compose more naturally than an opaque JPG with its own background still visible.
- **A new portable object defaults to LCD material and no content**, matching Sprint 2's
  Stand Display default (a portable product is conceptually closer to a handheld/kiosk
  surface than an outdoor wall panel) and reusing `DisplayPropertiesFields` unchanged for
  its content/material section — a portable object's content/material shape
  (`content`/`material`/`materialSettings`) is identical to a display object's, so no new
  content or material code was needed, only a type union widened to include
  `PortableSignageObject` (see the doc comment on `DisplayPropertiesFields` in
  `PropertiesPanel.tsx`).
- **Default placement size (`computeDefaultPortableSize`) scales the photo to fit within
  half the template's width and half its height, preserving aspect ratio exactly.** This
  mirrors the existing built-in display frames' default sizing intent (large enough to
  work with immediately, small enough not to fill the whole canvas) without hard-coding a
  pixel size that would look wrong for a portrait vs. landscape product photo.

## Consequences

- Because the screen region is locked to an axis-aligned rectangle in the photo's own
  space, any future request for perspective-correct or polygon screen regions (e.g. a
  product photographed at an angle) is new scope, not a bug fix against this model — per
  `CLAUDE.md`'s explicit exclusion, it needs separate approval and would likely require
  reusing the polygon variant already reserved on the built-in `ScreenRegion` type.
- The aspect-ratio lock means a user cannot stretch a portable object independently on
  each axis, unlike text/image elements. This is intentional (it keeps the screen-region
  mapping correct) but is a real interaction difference future contributors should not
  "fix" without revisiting this ADR.
- Move and resize (like drag-to-draw and the numeric fields before them) mutate only the
  modal's local draft state; no undo/redo history entry is created until Save/Add commits
  the draft via `commitObjectChange`/`addPortable`, and `hasObjectChange`'s shallow
  comparison means committing an unchanged region creates no entry either. Cancelling at
  any point, including mid-drag, discards the draft entirely.
- No photo-replacement path exists yet; a future request to support it will need to define
  what happens to an existing screen region, content, and material settings when the
  underlying photo's dimensions/aspect ratio change.

## Review trigger

Revisit this ADR when: perspective/polygon screen regions are approved, a product-photo
crop/replace editor is approved, or multiple screen regions per portable object are
approved.
