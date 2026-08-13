# Architecture overview

## Status

Sprint 4.2 complete. The editor is **photo-first**: the uploaded space-background
photo alone defines the document's export resolution (orientation-corrected, never
stretched or cropped, downscaled deterministically past a decoded-pixel safety limit)
— there is no document/template picker. Four signage families are placeable once a
photo exists: LED, LCD, and Transparent LED displays (three `DisplayMaterial` values
sharing one object kind), plus the Sprint 3 custom portable product. LED and
Transparent LED additionally support a 2D-approximation curvature control
(flat/concave/convex). See [ADR 0007](../adr/0007-photo-first-document-and-materials-sprint-4-2.md).
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
  `PortableProductView`), `OnboardingOverlay`.
- `src/i18n/` — locale resources, detection, persistence, React context.
- `src/lib/` — framework-agnostic constants/utilities: file validation, filename
  generation, the HULL contact URL, the runtime `assetRegistry`, the pure-geometry
  `contentLayout`/`displayFrame`/`materialTexture` modules used by the display objects,
  `curvature` (2D concave/convex strip-warp approximation — see
  [ADR 0007](../adr/0007-photo-first-document-and-materials-sprint-4-2.md)),
  `imageSafety` (decoded-pixel downscaling limit for the space photo),
  `geometryNormalization` (re-maps object positions/sizes when the space photo is
  replaced with a different resolution), and `portableRegion` (normalized-rectangle
  geometry for the portable screen region — see
  [ADR 0004](../adr/0004-custom-portable-template.md)).
- `src/store/` — the Zustand editor store (`editorStore.ts`): photo-first document
  state (`getDocumentSize` derives width/height solely from the uploaded space photo),
  selection, undo/redo history, and the reachability-based asset-sweep subscription.
- `src/styles/` — global stylesheet.
- `src/types/` — shared domain types (i18n `Locale`/`Messages`, editor document/object
  types including `DisplaySignageObject`, `PortableSignageObject`, `SignageContent`,
  `MaterialSettings`, `Curvature`).
- `src/test/` — Vitest environment setup.
- `tests/unit/` — Vitest + React Testing Library unit/component tests.
- `e2e/` — Playwright tests against a real Chromium build (smoke, editor, image upload,
  space-background/display content/material, portable product builder, mobile viewport,
  onboarding, comparison toggle, canvas reselection, drag-and-drop), plus
  `e2e/support/spaceBackground.ts`, a shared helper every spec uses to upload a space
  photo before exercising signage controls (every "add signage" action is gated on a
  photo existing).
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
