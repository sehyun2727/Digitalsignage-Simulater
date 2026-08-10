# Architecture overview

## Status

Sprint 3 complete: Sprint 2's Konva-based editor (text/image elements, PNG export,
placeable Wall LED / Stand Display objects, space-background photo, clipped screen
content, visual-only material presets), plus a user-uploaded custom portable product
template — a photo the user marks a rectangular screen region on, placed on the canvas
with Sprint 2's content/material system rendering into that region. See
[ADR 0004](../adr/0004-custom-portable-template.md).

## Runtime shape

The app is a single-page, browser-only React application. There is no backend, database,
or server-side persistence in the MVP. All processing (image decoding, canvas composition,
export) runs entirely client-side.

```
Browser
 └── React app (Vite build, static assets)
      ├── i18n (ja default, ko, en) — localStorage preference only
      ├── App shell + editor layout (Toolbar, EditorCanvas, PropertiesPanel,
      │    PortableBuilderModal)
      ├── Zustand store (document state, undo/redo history, asset-sweep subscription)
      ├── Konva canvas (text/image elements, display objects, portable products, PNG export)
      └── Runtime asset registry (decoded Image + Object URL, keyed by sourceId)
```

## Directory layout

Flat `src/` layout, per `CLAUDE.md` §4 (chosen over a monorepo `apps/` tree — see
[ADR 0001](../adr/0001-frontend-foundation.md)):

- `src/app/` — application root (`App.tsx`).
- `src/components/` — reusable presentational components (`LanguageSelector`, `HullCta`).
- `src/features/editor/` — editor UI: `Toolbar`, `EditorLayout`, `EditorCanvas`,
  `PropertiesPanel`, `CanvasObjectView`, `SignageDisplayView`, `SpaceBackgroundView`,
  `PortableBuilderModal` (photo → screen-region → add wizard, the app's first modal
  dialog), `PortableProductView`.
- `src/i18n/` — locale resources, detection, persistence, React context.
- `src/lib/` — framework-agnostic constants/utilities: file validation, filename
  generation, the HULL contact URL, the runtime `assetRegistry`, the pure-geometry
  `contentLayout`/`displayFrame`/`materialTexture` modules used by the display objects,
  and `portableRegion` (normalized-rectangle geometry for the portable screen region —
  see [ADR 0004](../adr/0004-custom-portable-template.md)).
- `src/store/` — the Zustand editor store (`editorStore.ts`): document state, selection,
  undo/redo history, and the reachability-based asset-sweep subscription.
- `src/styles/` — global stylesheet.
- `src/types/` — shared domain types (i18n `Locale`/`Messages`, editor document/object
  types including `DisplaySignageObject`, `PortableSignageObject`, `SignageContent`,
  `MaterialSettings`).
- `src/test/` — Vitest environment setup.
- `tests/unit/` — Vitest + React Testing Library unit/component tests.
- `e2e/` — Playwright tests against a real Chromium build (smoke, editor, image upload,
  space-background/display content/material, portable product builder, mobile viewport).
- `docs/` — architecture notes, ADRs, runbooks.

## State management

`src/store/editorStore.ts` (Zustand) holds the editor document (template, elements,
display objects, space background), selection, and a linear undo/redo history (`past`/
`future`). Only genuinely-changed commits (`hasObjectChange`) are pushed to history, so
no-op edits don't create empty undo steps. A store subscription recomputes the set of
asset `sourceId`s reachable from the document plus the full undo/redo history after every
change and sweeps (revokes + drops) anything no longer reachable — see
[ADR 0003](../adr/0003-content-and-material-model.md).

## Canvas rendering

Konva/`react-konva` render the `<Stage>`: text/image elements, display objects (frame
decorations + a clipped screen region + material overlay), portable products (the
user's uploaded photo at its native aspect ratio + a clipped screen region rendering
the same content/material system as display objects), and an optional space background,
all composited together for both on-screen editing and PNG export at the template's
native resolution. A portable object's bounding box is locked to its photo's aspect
ratio (corner-only resize handles), which lets `screenRegion` — a fraction of the
photo's own dimensions — be resolved directly against the object's current size with no
separate photo-space/object-space conversion; see
[ADR 0004](../adr/0004-custom-portable-template.md). See the video gate in `CLAUDE.md`
§3 for the separate spike required before any video-related canvas work.

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
