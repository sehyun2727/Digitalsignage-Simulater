# Architecture overview

## Status

Sprint 4.3 complete. The editor is **photo-first**: the uploaded space-background
photo alone defines the document's export resolution (orientation-corrected, never
stretched or cropped, downscaled deterministically past a decoded-pixel safety limit)
— there is no document/template picker. Four signage families are placeable once a
photo exists: LED, LCD, and Transparent LED displays (three `DisplayMaterial` values
sharing one object kind), plus the Sprint 3 custom portable product. LED and
Transparent LED additionally support a 2D-approximation curvature control
(flat/concave/convex). See [ADR 0007](../adr/0007-photo-first-document-and-materials-sprint-4-2.md).
Displays and portable products can additionally be fit to a four-point perspective
quad matching a photographed surface, gain an opt-in contact shadow and
environment-tone blend, and their screen content can be a video (autoplay/loop/muted)
in addition to a static image, exportable in-browser to WebM alongside the existing
PNG export — see [ADR 0008](../adr/0008-perspective-environment-and-video-sprint-4-3.md).
Sprint 4.1's unified six-section toolbar shape (Space, Add signage, Selected signage,
Content, Appearance, Export) is unchanged; see
[ADR 0006](../adr/0006-guided-editor-sprint-4-1.md). Sprint 3's portable product wizard
(photo → screen-region → add) and Sprint 3.2's canvas reselection hotfix are both
still in place — see [ADR 0004](../adr/0004-custom-portable-template.md) and
[ADR 0005](../adr/0005-canvas-object-reselection-hotfix.md).

## Runtime shape

The app is a single-page, browser-only React application. There is no backend, database,
or server-side persistence in the MVP. All processing (image decoding, canvas composition,
export) runs entirely client-side.

```
Browser
 └── React app (Vite build, static assets)
      ├── i18n (ja default, ko, en) — localStorage preference only
      ├── App shell + editor layout (header + unified six-section Toolbar +
      │    EditorCanvas + status bar, PortableBuilderModal, OnboardingOverlay)
      ├── Zustand store (photo-first document state, undo/redo history,
      │    asset-sweep subscription)
      ├── Konva canvas (text/image elements, LED/LCD/Transparent-LED display objects,
      │    portable products, curvature warp, PNG export)
      └── Runtime asset registry (decoded Image + Object URL, keyed by sourceId)
```

## Directory layout

Flat `src/` layout, per `CLAUDE.md` §4 (chosen over a monorepo `apps/` tree — see
[ADR 0001](../adr/0001-frontend-foundation.md)):

- `src/app/` — application root (`App.tsx`).
- `src/components/` — reusable presentational components (`LanguageSelector`, `HullCta`).
- `src/features/editor/` — editor UI: `Toolbar` (Space / Add signage / Selected
  signage / Content / Appearance / Export — see
  [ADR 0006](../adr/0006-guided-editor-sprint-4-1.md)), `EditorLayout`, `EditorCanvas`,
  `CanvasObjectView`, `SignageDisplayView`, `SpaceBackgroundView`,
  `PortableBuilderModal` (photo → screen-region → add wizard, the app's first modal
  dialog), `PortableProductView`, `ScreenComposition` (the shared clipped-screen-region
  content + material + curvature renderer used by both `SignageDisplayView` and
  `PortableProductView`), `PerspectiveEditOverlay` (the HTML/pointer-event "Fit to
  space" draft editor), `PerspectiveScreenView` (renders the warped visual composition
  for objects in perspective placement mode), `useVideoPlaybackRedraw` (drives a
  `Konva.Animation` loop so video content and the video-export capture both see live
  frames), `OnboardingOverlay` — see
  [ADR 0008](../adr/0008-perspective-environment-and-video-sprint-4-3.md).
- `src/i18n/` — locale resources, detection, persistence, React context.
- `src/lib/` — framework-agnostic constants/utilities: file validation, filename
  generation, the HULL contact URL, the runtime `assetRegistry`, the pure-geometry
  `contentLayout`/`displayFrame`/`materialTexture` modules used by the display objects,
  `curvature` (2D concave/convex strip-warp approximation — see
  [ADR 0007](../adr/0007-photo-first-document-and-materials-sprint-4-2.md)),
  `imageSafety` (decoded-pixel downscaling limit for the space photo),
  `geometryNormalization` (re-maps object positions/sizes when the space photo is
  replaced with a different resolution), `portableRegion` (normalized-rectangle
  geometry for the portable screen region — see
  [ADR 0004](../adr/0004-custom-portable-template.md)), `quadGeometry` (normalized
  four-point quad math and validation), `videoValidation` (video file type/size
  gating), `videoExportCapability` (`captureStream`/`MediaRecorder` support
  detection), and `videoExport` (the in-browser canvas-to-WebM recording pipeline) —
  see [ADR 0008](../adr/0008-perspective-environment-and-video-sprint-4-3.md).
- `src/store/` — the Zustand editor store (`editorStore.ts`): photo-first document
  state (`getDocumentSize` derives width/height solely from the uploaded space photo),
  selection, undo/redo history, the reachability-based asset-sweep subscription, and
  the perspective draft/apply/cancel/reset lifecycle.
- `src/styles/` — global stylesheet.
- `src/types/` — shared domain types (i18n `Locale`/`Messages`, editor document/object
  types including `DisplaySignageObject`, `PortableSignageObject`, `SignageContent`
  (now `image` or `video`), `MaterialSettings`, `Curvature`, `NormalizedQuad`,
  `PlacementMode`, `ContactShadowSettings`, `EnvironmentIntegrationSettings`).
- `src/test/` — Vitest environment setup.
- `tests/unit/` — Vitest + React Testing Library unit/component tests.
- `e2e/` — Playwright tests against a real Chromium build (smoke, editor, image upload,
  space-background/display content/material, portable product builder, perspective
  placement/transparent-LED/video flows, mobile viewport, onboarding, comparison
  toggle, canvas reselection, drag-and-drop), plus `e2e/support/spaceBackground.ts`
  (shared helper every spec uses to upload a space photo before exercising signage
  controls) and `e2e/support/video.ts` (generates a small in-browser video fixture for
  video-content specs).
- `docs/` — architecture notes, ADRs, runbooks.

## State management

`src/store/editorStore.ts` (Zustand) holds the editor document (space background,
signage/text/image objects — no template selection), selection, and a linear undo/redo
history (`past`/`future`). `getDocumentSize(document)` returns `null` until a space
photo is uploaded, and every object-creation action gates on that. Only
genuinely-changed commits (`hasObjectChange`) are pushed to history, so no-op edits
don't create empty undo steps. A store subscription recomputes the set of asset
`sourceId`s reachable from the document plus the full undo/redo history after every
change and sweeps (revokes + drops) anything no longer reachable — see
[ADR 0003](../adr/0003-content-and-material-model.md). Replacing the space photo
re-maps every object's position/size through `geometryNormalization` so objects stay
proportionally placed across a resolution/aspect-ratio change; both replace and remove
are single history entries.

Perspective placement has its own draft lifecycle layered on top of the same history
model: `beginPerspectiveEdit`/`updatePerspectiveDraft`/`applyPerspectiveEdit`/
`cancelPerspectiveEdit`/`resetPerspectiveEdit` keep an in-progress `NormalizedQuad`
edit entirely outside undo/redo history until Apply commits it as one entry; Cancel
discards it with no history entry at all. See
[ADR 0008](../adr/0008-perspective-environment-and-video-sprint-4-3.md).

## Canvas rendering

Konva/`react-konva` render the `<Stage>`: text/image elements, display objects (frame
decorations + a clipped screen region + material overlay, material being one of
`led`/`lcd`/`transparent-led`), portable products (the user's uploaded photo at its
native aspect ratio + a clipped screen region rendering the same content/material
system as display objects), and the space background photo, all composited together
for both on-screen editing and PNG export at the photo's own native resolution (see
[ADR 0007](../adr/0007-photo-first-document-and-materials-sprint-4-2.md) for the
photo-first sizing model and its decoded-pixel safety limit). A portable object's
bounding box is locked to its photo's aspect ratio (corner-only resize handles), which
lets `screenRegion` — a fraction of the photo's own dimensions — be resolved directly
against the object's current size with no separate photo-space/object-space
conversion; see [ADR 0004](../adr/0004-custom-portable-template.md). LED and
Transparent LED materials additionally support a curvature control
(flat/concave/convex): `src/lib/curvature.ts` divides the screen region into vertical
strips and displaces each strip's Konva `<Group>` `y`/`scaleY` along a parabola — a 2D
visual approximation, not true 3D/perspective rendering (see ADR 0007's Consequences).
See the video gate in `CLAUDE.md` §3 for the separate spike required before any
video-related canvas work.

Display and portable objects render as a Konva `<Group>` whose descendant shapes are
all `listening={false}`; each carries its own invisible, full-bounds, `listening` hit-
area `Rect` as the first child so the object as a whole stays clickable/tappable for
reselection after being deselected, with hit-testing always against the object's
rectangular bounds rather than a product photo's alpha channel — see
[ADR 0005](../adr/0005-canvas-object-reselection-hotfix.md).

An object whose `placementMode` is `'perspective'` keeps that same interactive Group
(and therefore the same rectangular hit-testing and Transformer selection UI) at its
flat `x/y/width/height/rotation`; only the _visual_ screen composition is warped, by a
sibling `PerspectiveScreenView` mapping the composed content onto the object's
`perspectiveQuad` (normalized 0-1 corners — `src/lib/quadGeometry.ts`). Clicking inside
the warped visual shape but outside the flat rectangle does not select the object, and
vice versa — a deliberate, documented simplification (see ADR 0008's Consequences).
Screen content can be a static image or an autoplay/loop/muted video
(`SignageContent.kind`); video frames redraw the canvas continuously via a
`Konva.Animation` loop (`useVideoPlaybackRedraw.ts`) so both on-screen playback and
`captureStream`-based video export see live pixels. An opt-in contact shadow
(silhouette-shaped, strength/blur/offset) and an opt-in environment-tone blend
(desaturates/reduces contrast/highlight strength on the rendered signage layer only,
never the space photo) can be layered onto any display or portable object regardless
of placement mode or curvature — see
[ADR 0008](../adr/0008-perspective-environment-and-video-sprint-4-3.md).

## Video export

`src/lib/videoExportCapability.ts` detects whether the browser can encode video at all
(`HTMLCanvasElement.prototype.captureStream` + at least one WebM `MediaRecorder`
codec); the "Export video" button in `EditorLayout.tsx` only renders when that check
passes, showing an explicit unsupported-browser hint otherwise (Safari, as of this
sprint). When supported, `src/lib/videoExport.ts` records the canvas's own live pixels
for one full loop of the longest video content on screen (capped at 15s, or a fixed 6s
default with no video content) and resolves a WebM Blob, entirely client-side with no
upload — see [ADR 0008](../adr/0008-perspective-environment-and-video-sprint-4-3.md).
PNG export is unaffected by video content: it always captures the canvas's current
frame, the same as it would for a static image.

## Deployment shape

- Static build (`vite build`) served as static files.
- Primary target: Render Static Site (see
  [runbooks/render-static-site.md](../runbooks/render-static-site.md)).
- Docker image (Nginx serving the static build with SPA fallback) provided as a
  reproducible local/alternative-hosting baseline, not as the primary Render deployment
  method.

## Privacy boundary

No network calls are made to any application-controlled backend, because there is no
backend. The only outbound link is the explicit HULL contact CTA, opened by the user in
a new tab.
