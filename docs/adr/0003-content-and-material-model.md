# ADR 0003: Screen content and display material model for Sprint 2

## Status

Accepted — Sprint 2.

## Context

Sprint 2 adds placeable "display" objects (Wall LED panel, Stand Display kiosk) that sit
on an optional space-background photo, hold a single piece of uploaded screen content
clipped to a frame-specific screen region, and render a visual-only material preview
(Outdoor LED grid / LCD highlight, with an intensity and brightness control). `CLAUDE.md`
explicitly keeps video, OCR/AI, and product-accurate rendering out of scope, and requires
staying browser-local with no server uploads. Several implementation choices needed to be
locked in before wiring the Toolbar/PropertiesPanel/Canvas together.

## Decisions

- **Frame geometry is flat, hand-authored rectangles, not product-accurate art.** Each
  `DisplayFrameId` (`wall-led`, `stand-display`) has a `screenRegion` (a fraction-based
  rect relative to the object's own width/height) plus a small set of decoration rects
  (bezel, neck, foot) in `src/lib/displayFrame.ts`. This is a visual foundation for
  Sprint 2, not a simulation of any real HULL or third-party product — `CLAUDE.md` §1
  already forbids implying product accuracy or HULL affiliation, and a data-driven rect
  model is enough to prove out placement, clipping, and export at this stage.
- **Content fit reuses CSS `contain`/`cover` semantics**, computed as pure geometry in
  `src/lib/contentLayout.ts` (`computeContentLayout`), with an additional normalized
  `offsetX`/`offsetY` (fraction of the screen size, clamped to `[-1, 1]`) and `scale`
  (clamped to `[1, 3]`) applied on top. Reusing a well-known, testable model (verified in
  `tests/unit/contentLayout.test.ts` against an independent min/max scale-factor oracle)
  keeps the behavior predictable instead of inventing a bespoke fit algorithm.
- **Screen content is clipped with a Konva `Group` `clipFunc`**, not by constraining the
  image's own draw rect. This guarantees content can never visually spill onto the frame
  bezel regardless of fit/offset/scale values, including at PNG export time (verified by
  the pixel-sampling Playwright test in `e2e/content-material.spec.ts`).
- **Material presets (Outdoor LED, LCD) are visual-only overlays**, not simulated physical
  material or color-accurate response. `getLedPatternCanvas()`/`materialPatternOpacity()`/
  `getBrightnessOverlay()` in `src/lib/materialTexture.ts` render a small tiled dot-grid
  pattern (LED) or a diagonal highlight gradient (LCD) at an opacity driven by the
  `intensity` slider, plus a white/black wash driven by the `brightness` slider. The
  PropertiesPanel shows a fixed, translation-covered notice
  (`editorMaterialPreviewNotice`) stating this is a visual reference, not a guarantee of
  real product performance — required by `CLAUDE.md`'s no-HULL-endorsement and
  no-overclaiming stance.
- **A single runtime asset registry backs both screen content and the space background.**
  `src/lib/assetRegistry.ts` decodes an uploaded `File` once via `Image()`, stores the
  decoded `HTMLImageElement`, `objectUrl`, and natural dimensions keyed by a generated
  `sourceId`, and keeps Konva image nodes (`SignageDisplayView`, `SpaceBackgroundView`)
  looked up by that id rather than storing the `HTMLImageElement`/blob itself in Zustand
  state — consistent with `CLAUDE.md` §4's guidance to avoid mutable DOM/binary objects in
  the store and to keep document state serializable.
- **Unused assets are swept, not manually freed.** `editorStore.ts` subscribes to every
  store change and recomputes the set of `sourceId`s reachable from `document` plus the
  full undo (`past`) and redo (`future`) history, then calls `sweepUnusedAssets` to revoke
  and drop anything no longer reachable. This makes undo/redo safe (an asset stays alive as
  long as any history entry could bring it back) without hand-written reference counting at
  every mutation site, and keeps Object URL cleanup automatic per `CLAUDE.md` §4/§8.
  Callers must register a new asset immediately before the commit that references it, with
  no intervening store mutation, since the sweep runs after every state change and would
  otherwise revoke an as-yet-unreferenced asset (see the asset-lifecycle tests in
  `tests/unit/editorStore.test.ts`).
- **Material intensity/brightness sliders use a transient-preview + explicit-commit split**,
  not a single `onChange`-per-tick commit. `updateObjectTransient` (live preview while
  dragging, not pushed to undo history) fires on the native `input` event; `commitObjectChange`
  (the actual history entry) fires on `pointerup`/`blur`. A single continuous drag would
  otherwise create dozens of undo-history entries — one per intermediate value — which is
  not what "one user interaction, one undo step" should mean.

## Consequences

- Because frame/material rendering is intentionally simplified, any future request to make
  a specific frame or material "look like" a real product line is new scope, not a bug fix
  against this model — it should go through the normal sprint-approval process in
  `CLAUDE.md` §2, and would likely need real reference assets and explicit non-affiliation
  review.
- The asset registry's register-immediately-before-commit ordering is a sharp edge for
  future contributors adding new upload flows (e.g. a future multi-content feature) — the
  same pattern (`await registerAsset(file)` immediately followed by the commit, no store
  mutation in between) must be repeated, or the sweep will silently revoke the asset before
  it's ever attached.
- Content is limited to a single static image per display in Sprint 2. Multiple content
  slots, playlists, or video content are separate future scope, gated by `CLAUDE.md`'s
  video spike requirement for anything video-related.

## Review trigger

Revisit this ADR when: real product-accurate frame/material assets are approved, content
support expands beyond a single static image per display, or video content is approved
(which also requires completing the video spike in `CLAUDE.md` §3 first).
