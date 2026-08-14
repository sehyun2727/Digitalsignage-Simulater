# ADR 0008: Four-point perspective placement, environment integration, and video for Sprint 4.3

## Status

Accepted — Sprint 4.3.

## Context

Sprint 4.2 (ADR 0007) made the uploaded space photo the document itself, added four
signage families, and gave LED/Transparent LED a 2D curvature approximation — but every
object still had to sit in an axis-aligned (optionally rotated) rectangle, static
images were the only screen content, and there was no way to make placed signage read
as sitting _in_ the photographed scene beyond curvature. Sprint 4.3's approved scope
adds three related capabilities on top of that unchanged photo-first foundation: fitting
a display or portable product to an arbitrary quadrilateral on the photo (matching a
photographed wall/surface that isn't square-on to the camera), a bounded contact-shadow
and tone-blend control for the same "reads as installed" goal, and video screen content
with in-browser MediaRecorder export. `CLAUDE.md`'s constraints are unchanged — no
accounts, no server persistence, no watermark; video was explicitly gated behind a
technical spike (§3) before this sprint began.

## Decisions

- **Perspective placement is an additive `placementMode`, not a replacement for the
  rectangle model.** `DisplaySignageObject`/`PortableSignageObject` gained
  `placementMode: 'rect' | 'perspective'`, `perspectiveQuad: NormalizedQuad | null`,
  `contactShadow: ContactShadowSettings`, and `environmentIntegration:
EnvironmentIntegrationSettings` (`src/types/editor.ts`). The object's own
  `x/y/width/height/rotation` are never deleted or overwritten by perspective mode —
  they remain the authoritative bounds for selection, dragging, and hit-testing even
  while `placementMode === 'perspective'`. Only `PerspectiveCapableObject` (display or
  portable) supports it; text/image objects do not.
- **The quad is stored normalized (0-1), not in preview or export pixels.**
  `src/lib/quadGeometry.ts` (`NormalizedQuad`, `documentToNormalized`/
  `normalizedToDocument`, `documentToPreviewPoint`/`previewToDocumentPoint`,
  `validateQuad`) keeps every corner as a fraction of the current photo-first document,
  so a quad drawn against one space photo's resolution survives a later photo
  replacement or window resize unchanged, the same normalization strategy ADR 0007
  used for object positions during `geometryNormalization`.
- **A quad is only ever edited through an explicit "Fit to space" mode with its own
  draft/apply/cancel/reset lifecycle**, not by freeform dragging the live object.
  `editorStore.ts` adds `beginPerspectiveEdit`/`updatePerspectiveDraft`/
  `applyPerspectiveEdit`/`cancelPerspectiveEdit`/`resetPerspectiveEdit`: entering edit
  mode seeds a draft quad (from the existing `perspectiveQuad` if one exists, otherwise
  derived from the object's current rectangle), all corner drags/keyboard nudges/numeric
  field edits mutate only that draft, and only Apply commits it to history as a single
  entry. Cancel discards the draft with no history entry; Reset restores the draft to
  what it was when edit mode was entered (not to the rectangle). `validateQuad` rejects
  self-intersecting, concave, out-of-bounds, and below-minimum-area/edge quads — Apply
  stays disabled and an accessible inline error explains which rule failed
  (`editorPerspectiveError*` message keys) until the draft is valid again.
- **The corner-drag surface is a plain HTML/pointer-event overlay
  (`PerspectiveEditOverlay.tsx`), not Konva shapes**, matching the precedent
  `PortableBuilderModal.tsx` already set for its screen-region editor. It relies on the
  Stage always filling its box at one uniform scale with no letterboxing
  (`EditorCanvas.tsx`), so a single scalar conversion (`documentToPreviewPoint`/
  `previewToDocumentPoint`) maps between pointer coordinates and document space. Each
  corner also has a numeric X/Y fallback (two `<input type="number">` per corner) for
  keyboard/assistive-technology users and for precise mobile-viewport input where a
  several-pixel-wide drag handle is impractical (see the mobile E2E coverage in
  `e2e/mobile.spec.ts`, which drives the numeric fields rather than a drag gesture).
- **Perspective rendering warps only the visual composition, never the hit-test
  bounds.** `PerspectiveScreenView.tsx` composes the screen content/material/curvature
  into an offscreen render and maps it onto `perspectiveQuad` for display; the
  interactive `Group` (drag handle, Transformer target, selection hit-area `Rect` from
  ADR 0005) stays positioned at the object's flat `x/y/width/height/rotation`
  regardless of placement mode. Clicking inside the warped visual quad but outside the
  flat rectangle does _not_ select the object, and clicking inside the flat rectangle
  does select it even where the warped visual body doesn't visually cover that point —
  a deliberate simplification recorded here rather than an oversight, since true
  quad-shaped hit-testing would need to reconcile with Transformer's own rectangular
  selection UI. PNG export renders the same warped composition, unaffected by the
  screen-vs-editor hit-test distinction.
- **Contact shadow and environment-integration blend are both visual-only, bounded,
  opt-in controls**, not physically based lighting/occlusion simulation.
  `ContactShadowSettings` (`enabled`, `strength`, `blur`, `offsetX`, `offsetY`, all
  0-100 except the roughly -1..1 offsets) draws a soft shadow shape beneath the signage
  silhouette; `EnvironmentIntegrationSettings` (`strength`, 0-100) reduces
  saturation/contrast/highlight strength on the rendered signage as strength increases,
  making it read as more naturally lit by the surrounding photo. Neither ever modifies
  the space photo itself — only the signage object's own rendered layer.
- **Video is a `ContentKind` alongside `image`, not a separate object type.**
  `SignageContent.kind: 'image' | 'video'` reuses the exact same `sourceId`/`fit`/
  `offsetX`/`offsetY`/`scale` placement model images already had; `src/lib/
videoValidation.ts` gates accepted MIME types and file size the same way image
  upload validation already did (`CLAUDE.md` §4 file-handling rules). Playback state
  (play/pause/current time/mute) is deliberately excluded from `SignageContent` and
  kept as transient runtime state, not document/undo-redo history state — a video's
  play position is not something a user would expect Undo to restore.
- **Video always plays autoplay/loop/muted, with no user-facing playback controls.**
  This sidesteps browser autoplay-with-sound restrictions entirely and matches the
  product's use case (an always-on preview of a signage loop) rather than a media
  player. The toolbar surfaces this as a fixed hint string
  (`editorContentVideoAutoplayHint`) rather than exposing controls that would imply
  the user can pause/seek.
- **Video export records the canvas's own live pixels via `captureStream` +
  `MediaRecorder`, entirely in-browser.** `src/lib/videoExportCapability.ts` probes
  `HTMLCanvasElement.prototype.captureStream` and `MediaRecorder.isTypeSupported`
  against `video/webm;codecs=vp9` / `vp8` / plain `video/webm` (Chrome/Firefox/Edge
  support at least one; Safari, as of this sprint, supports neither) and the resulting
  `isVideoExportSupported()` gates whether the "Export video" button renders at all —
  there is no disabled-button state, only present-and-working or absent-with-an-
  explicit-unsupported-browser hint (`editorExportVideoUnsupportedHint`), per the video
  gate's required fallback-experience criterion (`CLAUDE.md` §3). `src/lib/
videoExport.ts`'s `resolveVideoExportDurationMs` records one full loop of the
  longest video content on the canvas (capped at 15s so a long source clip can't
  produce an unexpectedly huge export), or a fixed 6s default when the canvas has no
  video content at all — a still composition with only curvature/material effects is
  still exportable as a short clip. Recording keeps the canvas animating for the whole
  duration via a `Konva.Animation` loop (`useVideoPlaybackRedraw.ts`), since
  `captureStream` only emits new frames when the canvas surface actually repaints.
- **Video export produces a separate `.webm` download from PNG export, not a combined
  flow.** `buildVideoExportFilename()` mirrors `buildExportFilename()`'s
  `signage-canvas_{yyyyMMdd-HHmmss}` timestamp pattern with a `.webm` extension instead
  of `.png`. PNG export is unaffected by video content or export capability — a display
  showing video content still exports a PNG snapshot of the canvas's current frame the
  same way a static image would.

## Consequences

- **The video-gate spike's conclusion is recorded here rather than in a separate
  spike document**: `captureStream`/`MediaRecorder` against WebM/VP8/VP9 is sufficient
  for this sprint's scope (short, muted, autoplay-loop clips), Konva's own canvas is
  captured directly with no separate render pass needed, and Safari's lack of support
  is handled as an explicit unsupported-browser UI state rather than a silent failure
  or a polyfill/transcoding dependency (which `CLAUDE.md` §3 explicitly rules out
  without a further approved scope change).
- **Perspective's flat-rect-only hit-testing is a known, deliberate limitation** —
  a very obliquely warped quad can visually extend well outside the flat rectangle
  (or leave much of the rectangle visually empty), and clicks follow the rectangle,
  not the visible warped shape. `e2e/perspective-video.spec.ts` documents and asserts
  this exact behavior (clicking inside the flat rect selects the object even where the
  warped body isn't drawn there; clicking inside the warped body but outside the flat
  rect does not select it) so a future change to this behavior is a visible, reviewed
  diff rather than an accidental regression.
- **A real CSS layout bug was found and fixed while writing this sprint's E2E
  coverage**: `PerspectiveEditOverlay.tsx`'s top-docked hint text and its
  bottom-docked action buttons overlapped at some viewport sizes because the buttons
  weren't in their own positioned container, silently eating real pointer clicks on
  Apply/Cancel/Reset. This was invisible to jsdom-based component tests (no real CSS
  layout engine) and was only caught by a real-Chromium Playwright test — a concrete
  example of why this project keeps both test types rather than treating either as
  sufficient on its own.
- **Contact shadow, environment-integration blend, and curvature (ADR 0007) are three
  independent, stackable visual controls with no interaction validation between
  them** — e.g. a strong contact shadow under a heavily curved, heavily blended
  perspective-warped display was not specifically tested for visual coherence, only
  for each control's own isolated correctness. This mirrors ADR 0007's curvature
  disclaimer: these are approximations for a sales-simulation tool, not a
  physically-based renderer.
- **The full Playwright suite grew to 69 tests across 12 spec files** (`e2e/
perspective-video.spec.ts` new, covering perspective placement/hit-testing/undo-redo,
  transparent-LED blending, and video preview/export/unsupported-fallback on desktop;
  `e2e/mobile.spec.ts` extended with transparent-LED and perspective-via-numeric-fields
  coverage at the existing 390×844 touch viewport).

## Review trigger

Revisit this ADR when: true quad-shaped (rather than flat-rect) hit-testing is
proposed, video gains user-facing playback controls or multiple content slots per
display, video export duration/quality/audio policy changes, or Safari ships
`captureStream`/`MediaRecorder` support broad enough to reconsider the unsupported-
browser fallback path.
