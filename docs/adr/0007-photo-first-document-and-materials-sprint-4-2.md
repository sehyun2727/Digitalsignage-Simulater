# ADR 0007: Photo-first document model, expanded materials, and curvature for Sprint 4.2

## Status

Accepted — Sprint 4.2.

## Context

Sprints 1–4.1 required picking a document template up front (`wall-led` 1920×1080 or
`stand-display` 1080×1920), which fixed the export resolution before any content
existed. A space-background photo, if uploaded, was composited inside that fixed
document regardless of its own resolution or aspect ratio — a mismatch for the
project's actual use case, which is a salesperson photographing a real installation
site and simulating signage on top of _that specific photo_.

Sprint 4.2's approved scope turns Signage Canvas into a **photo-first sales
simulation tool**: the uploaded space photo defines the document, not the other way
around. `CLAUDE.md`'s constraints are unchanged throughout — no accounts, no server
persistence, no video, no broad redesign beyond the approved acceptance criteria.
ADR 0006's unified six-section toolbar shape is also unchanged; this ADR only changes
what a few of those sections contain and do.

## Decisions

- **Document size is derived solely from `SpaceBackground`, never selected.**
  `getDocumentSize(document)` returns `null` until a space photo exists, and every
  object-creation store action (`addText`, `addImage`, `addDisplay`, `addPortable`)
  gates on that with `if (!size) return`. There is no template picker anywhere in the
  UI or the document type — `EditorDocument` no longer has a `template` field.
- **The space photo's own orientation-corrected resolution becomes the export
  resolution**, with no stretch or crop applied to fit a preset size. A **deterministic
  decoded-pixel safety limit** (`MAX_DECODED_PIXELS = 40_000_000` in
  `src/lib/imageSafety.ts`) protects against pathological uploads: when a decoded
  photo would exceed that pixel count, both dimensions are scaled down by the same
  `sqrt(maxPixels / pixels)` factor, preserving aspect ratio exactly rather than
  cropping or distorting.
- **Replace and Remove are each a single history entry.** Replacing the space photo
  re-maps every existing object's position and size through
  `src/lib/geometryNormalization.ts`, which expresses each object as a fraction of the
  _old_ document's dimensions and re-applies that fraction to the _new_ dimensions —
  so a display centered at 50%/50% of a 1920×1080 photo stays centered at 50%/50% of a
  replacement 1080×1920 photo instead of landing off-canvas or at a stale pixel
  coordinate.
- **Four signage families replace the old two-template display model**: LED, LCD,
  Transparent LED (three values of `DisplayMaterial` — `'led' | 'lcd' |
'transparent-led'`), and the existing custom portable product. Every "add" button in
  the toolbar's Add-signage section is disabled until a space photo exists, guiding
  the user to upload a photo first rather than failing silently. The legacy
  `'outdoor-led'` material value (from Sprint 2/3) is migrated to `'led'` by
  `normalizeMaterial()` in `src/lib/materialTexture.ts`, which also falls back
  unrecognized values to `'led'` instead of throwing, so any in-memory state built
  before this sprint doesn't crash the app.
- **`MaterialSettings` grew from two sliders to six**: `intensity`, `brightness`,
  `transparency`, `gridDensity`, `glow`, `contrast` (all 0–100). Not every material
  uses every slider — `transparency` only applies to Transparent LED, and LCD exposes
  no grid/glow controls, only `intensity`/`brightness`/`contrast` for its highlight
  gradient. The Appearance toolbar section only shows the controls relevant to the
  selected object's material.
- **Curvature (`mode: 'flat' | 'concave' | 'convex'`, `amount: 0–100`) is available
  for LED and Transparent LED only** (`isCurvatureSupported()` in
  `src/lib/curvature.ts` returns `false` for LCD and portable-with-LCD-material).
  **This is a 2D visual approximation, not a true 3D/perspective simulation.** The
  screen region is divided into `CURVATURE_SLICE_COUNT` (20) vertical strips, and each
  strip's Konva `<Group>` gets a `y`/`scaleY` transform following a parabola that is
  zero at the screen's edges and maximal at its center (`MAX_CURVE_DEPTH_RATIO = 0.18`
  of screen height) — convex bulges the center outward, concave recesses it inward.
  Content and material rendering inside each strip is the same flat rendering reused
  unmodified; only its vertical placement is warped. No horizontal/lens distortion,
  perspective, or lighting simulation is attempted.
- **Export filename dropped its template-id segment**, since there is no template id
  any more: `buildExportFilename()` now produces
  `signage-canvas_{yyyyMMdd-HHmmss}.png` (previously
  `signage-canvas_{templateId}_{yyyyMMdd-HHmmss}.png`).
- **The HULL CTA URL changed from `https://hull-inc.jp/contact` to
  `https://hull-inc.jp/`**, with new three-language button text
  (`hullCtaLabel`: ja `サイネージ設置はこちら` / ko `사이니지 설치는 이쪽으로` / en
  `Install signage with HULL`). Its fixed bottom-right green-button positioning and
  mechanism are unchanged from ADR 0006 — only the destination and copy changed.
- **`DisplaySignageObject.frameId` (`'wall-led' | 'stand-display'`) survives as an
  internal bezel/stand decoration style, fully decoupled from document size.**
  `addDisplay()` always creates objects with `frameId: 'wall-led'` regardless of the
  chosen material; the field no longer implies or constrains the document's export
  resolution the way the old template selection did.

## Consequences

- **No document-persistence migration path was needed.** `localStorage` only ever
  stored the language preference (see `CLAUDE.md` §8 and the README's privacy
  section); editor documents are never persisted across reloads, so the
  `normalizeMaterial()` fallback only has to protect a single in-memory session's
  history, not saved files from a previous app version.
- **The full Playwright suite (60 tests across 10 spec files) was rewritten** for the
  new button set and gating, plus a new shared `e2e/support/spaceBackground.ts` helper
  that every spec now calls before any signage-related interaction (since
  `canAddSignage` requires a space photo first). Tests whose entire premise depended
  on the removed template shapes (e.g., a distinct 220×420 "Stand Display" size) were
  redesigned around material identity instead, since every display is now uniformly
  sized (480×270 by default) regardless of material.
- **Two hint strings are intentionally identical text rendered in two different DOM
  locations for two different conditions**: `editorCanvasNoSignageHint` (canvas
  overlay, hides once _any_ object exists) and `statusBarHintNoSignage` (status bar,
  hides only once a _signage-kind_ — display or portable — object exists). Adding a
  text or image object hides the canvas overlay hint but leaves the status bar hint
  visible, which is correct but means `getByText()` on that string needs `.first()`
  or, better, scoping to `.editor-empty-hint` when a test's intent is specifically
  "did any object get added." A future third occurrence of this exact string would
  need the same care.
- **The LED add-signage button label (`LEDディスプレイを追加`) is a literal substring
  of the Transparent LED button's label (`透過LEDディスプレイを追加`)**, and the plain
  `削除` (Delete) button label is a substring of `空間写真を削除` (Remove space
  background) — both now always present together once a space photo exists. This is
  the same class of Playwright substring-matching hazard ADR 0006 documented for the
  header/toolbar comparison-toggle pair; every affected e2e locator needed
  `exact: true`.
- **Curvature's 2D-approximation limitation should be stated in-product if this ever
  ships to sales staff**, since a real curved LED wall's actual optical behavior
  (viewing-angle-dependent brightness, real perspective) is not simulated — this ADR
  records that as a known, deliberate simplification rather than an oversight.

## Review trigger

Revisit this ADR when: real 3D/perspective curvature is proposed (treat as new scope,
not an extension of the current strip-warp approach), document persistence beyond a
single session is added (the `normalizeMaterial()` fallback would then need to cover
actually-saved documents, not just in-memory state), or a new toolbar/status-bar
string pair is introduced that could repeat the identical-hint-text collision
described above.
