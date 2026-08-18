# ADR 0010: Scene integration, occlusion, and sales-quality visual QA for Sprint 4.5

## Status

Accepted — Sprint 4.5.

## Context

Sprint 4.4 (ADR 0009) closed the seven baseline-confirmed rendering defects and explicitly deferred
two items: a golden-image/screenshot-diff pipeline, and any deeper scene-integration work beyond
what the seven fixes covered. Sprint 4.5's approved scope picks up from there with a set of
sales-facing gaps: a signage object always renders fully in front of everything in the space photo,
even when part of it should logically sit behind a real foreground obstruction (a pillar, a plant,
a doorway); the environment-tone blend always uses one fixed neutral gray rather than each scene's
actual ambient color; there was no way to present a finished composition to a client without the
editing chrome and risk of an accidental drag/delete; a first-time user had no in-context guidance
for the increasingly dense Appearance panel (rendering presets, contact shadow, environment
sampling, occlusion, all added across Sprints 4.3-4.5); the glow slider had no visible effect at
all due to a clipping bug; and there was still no automated way to catch a whole-scene visual
regression short of manually eyeballing the canvas. `CLAUDE.md`'s constraints (no accounts, no
server persistence/upload, no watermark, no AI generation) remain unchanged.

## Decisions

- **Foreground occlusion masks let a user manually restore the original space photo over part of a
  signage object**, modeling a real obstruction the camera would have captured in front of the
  display. `src/lib/occlusion.ts` defines the `OcclusionMask` data model (a normalized-coordinate
  N-gon polygon, `MIN_OCCLUSION_POINTS = 3`) and pure geometry/validation helpers; the store
  (`editorStore.ts`) adds a begin/update/apply/cancel draft-edit action set mirroring the existing
  perspective-edit pattern (`beginOcclusionEdit`/`updateOcclusionEditDraft`/`applyOcclusionEdit`/
  `cancelOcclusionEdit`), so a mask is only committed to the object — and only creates one undo/redo
  history entry — on explicit Apply. `OcclusionEditOverlay.tsx` is the HTML editing surface
  (click-to-add-point, drag or arrow-key nudge, Delete/Backspace to remove a point, feather/opacity
  sliders, Escape-cancels), wired into `EditorCanvas.tsx` alongside `PerspectiveEditOverlay` with
  the two geometry-editing modes mutually exclusive. `OcclusionMaskLayer.tsx` renders each enabled
  mask as a feathered, clip-masked cutout that redraws the original space-photo pixels over the
  composited signage object, in both the live preview and the export path, sharing a
  `computeCoverFit` helper (`spaceBackgroundFit.ts`) with `SpaceBackgroundView` so the live
  background and the mask restoration always agree on pixel alignment.
- **`installationMode` (`wall` | `window` | `freestanding`) is now an explicit, persisted per-object
  field**, seeded at creation via the existing `resolveShadowMode` heuristic (unifying the prior
  `ShadowMode` type as an alias of the new persisted one) and user-editable afterward via a Toolbar
  selector. It gates which installation-specific defaults and effects apply: `window` is the only
  mode that implies a glass surface and therefore the only mode that renders `ScreenReflection`
  (see below); `resolveShadowMode`'s wall/window/freestanding base shadow geometry (from ADR 0009)
  now reads from this field directly instead of being re-derived from material/object-kind alone.
- **User-triggered environment sampling replaces the fixed neutral-gray blend with each scene's own
  ambient tone.** `sampleAmbientColor` (`environmentIntegration.ts`) downscales the space photo to
  16x16 and averages RGB, entirely client-side; a new "空間写真からサンプリング" action
  (`sampleEnvironmentColor` in `editorStore.ts`) stores the result on
  `object.environmentIntegration.sampledColor`, and `SignageDisplayView`/`PortableProductView`'s
  blend `Rect` uses `sampledColor ?? ENVIRONMENT_BLEND_COLOR` so an object with no sample yet still
  gets the prior neutral-gray fallback. The sampled color survives rendering-preset switches
  (`applyRenderingPreset` only touches `strength`, never `sampledColor`); only the explicit
  "なじませをリセット" action clears it back to the fallback.
- **Contact shadows became perspective-aware and gained spread/depth/tint controls.**
  `ContactShadowView.tsx` now accepts either a flat object rect or a `perspective`-quad-anchored
  variant (mirroring the existing perspective/flat split already used for the object body itself in
  `SignageDisplayView.tsx`/`PortableProductView.tsx`), so a perspective-placed object keeps a
  plausible ground shadow instead of losing it entirely once `placementMode === 'perspective'`.
  Advanced-panel `spread`/`depth`/`tint` sliders were added on top of the existing
  strength/blur/offset fields so wall vs. freestanding installations can read as visually distinct
  attachment types rather than the same generic ellipse at different opacities.
- **The glow halo is rendered as a separate, unclipped layer, fixing a bug where it had zero visible
  effect at any slider value.** The glow shadow had been attached directly to the screen content
  image inside a `Group` clipped to the screen's exact rect, so Konva's blur could never render past
  that clip boundary. `ScreenComposition.tsx` now renders glow as its own halo shape using the same
  `.cache()` + `Konva.Filters.Blur` technique `ContactShadowView` already uses for its ground
  shadow, letting the blur bleed past the screen edge as intended. `e2e/glow-halo.spec.ts` samples
  exported pixels just outside the screen edge with the slider on vs. off, and the fix was verified
  by first confirming the test fails without it.
- **A faint glass reflection renders beneath window-mounted displays.** `ScreenReflection.tsx`
  reuses `ScreenComposition` to render a mirrored, lowered-opacity duplicate of the screen
  composition anchored to the screen's own bottom edge, gated strictly on
  `installationMode === 'window'` — the only mode that implies a glass surface — so wall/freestanding
  objects are unaffected. `e2e/screen-reflection.spec.ts` samples a point below the display and
  compares brightness with the setting off vs. on.
- **A distraction-free sales review mode lets a salesperson hand the composed scene to a client
  without editing risk.** A new transient `uiStore` field (`salesReviewMode`, not document state) is
  toggled from the header; while active, the toolbar, undo/redo, and keyboard shortcuts are hidden
  and the canvas becomes unclickable via CSS `pointer-events`, while the before/after comparison
  toggle and PNG export remain reachable. Nothing about the underlying document changes, so leaving
  review mode restores full editing exactly as it was.
- **A first-use guide card orients a user to the now-dense Appearance panel.**
  `RealismGuideCard.tsx` is a small, dismissible card shown inline above `AppearanceFields` the
  first time a display or portable object is selected, pointing out rendering presets, installation/
  contact shadow, environment sampling, and occlusion in the order they appear in the panel. It
  mirrors `OnboardingOverlay`'s established non-blocking-card-plus-`localStorage`-dismissal pattern
  (a new `realismGuideStorage.ts`, parallel to the existing onboarding-dismissal storage key) rather
  than introducing a new UI pattern for a one-off need.
- **A golden-image visual QA pipeline catches whole-scene regressions that sampled-pixel assertions
  can miss.** `e2e/visual-qa.spec.ts` (`npm run qa:visual`) renders three canonical, deterministic
  scenes (wall-mounted LED on the Natural preset, freestanding portable with a ground shadow, a
  four-point perspective-placed display) and diffs them against committed baselines via Playwright's
  `toHaveScreenshot`, deliberately separate from both the behavioral `test:e2e` flows and the
  targeted pixel-sampling specs elsewhere in `e2e/`. Baselines are Linux-specific (Playwright
  suffixes snapshot files with the OS/browser they were captured on, `*-chromium-linux.png`) and are
  committed to the repo; they must be regenerated in the same environment that will later compare
  against them (documented in the new `docs/quality-runbook.md`) since local development happens on
  Windows while CI runs `ubuntu-latest` — running `qa:visual` directly on Windows will show diffs
  from font/anti-aliasing differences even when nothing regressed. This closes the gap Sprint 4.4
  explicitly deferred (ADR 0009's Review trigger).
- **CI now runs the full Playwright suite, including golden-image visual QA, on every PR and push to
  an active sprint branch.** `.github/workflows/ci.yml`'s `quality` job installs Chromium
  (`npx playwright install --with-deps chromium`) and runs `npm run test:e2e` after the production
  build step, uploading the Playwright HTML report as an artifact on failure. This was previously
  entirely absent from CI — only `format:check`/`lint`/`typecheck`/`test:run`/`build` ran — so a
  behavioral or visual regression could previously only be caught by a contributor remembering to
  run `npm run test:e2e` locally.

## Consequences

- **Occlusion masks and installation mode are new persisted per-object fields**
  (`object.occlusionMasks: OcclusionMask[]`, `object.installationMode`), seeded with sensible
  defaults (`occlusionMasks: []`, `installationMode` from `resolveShadowMode`) wherever a display or
  portable object is created (`addDisplay`/`addPortable`), so every existing object-creation path
  stays internally consistent without a separate runtime migration step — this project still has no
  server or `localStorage` document persistence (unchanged since Sprint 1), so there is no
  previously-saved document shape to migrate from disk; "migration" here means every code path that
  constructs an object agrees on the new fields' defaults, not a data-format upgrade.
  `environmentIntegration.sampledColor` is optional and additive to the existing
  `EnvironmentIntegrationSettings` shape for the same reason.
  - The mask-restoration and background-fit logic depends on `OcclusionMaskLayer` and
    `SpaceBackgroundView` sharing one `computeCoverFit` helper; if either is changed independently in
    a future sprint without the other, a mask could visibly drift from the space photo underneath it.
- **The full Playwright suite grew to 84 tests across 17 files** (from Sprint 4.4's stated count of
  71): `occlusion-mask.spec.ts` and `environment-sampling.spec.ts` are new dedicated specs, plus a
  new mobile-viewport occlusion-editing case appended to `mobile.spec.ts`, plus `glow-halo.spec.ts`,
  `screen-reflection.spec.ts`, `sales-review.spec.ts`, and the three-scene `visual-qa.spec.ts`.
  Vitest's unit/component suite passed 483/483 at the time of this ADR.
- **A genuine mobile-UX finding came out of writing the mobile occlusion-editing test, not out of a
  design review**: `OcclusionEditOverlay`'s own hint text plus its feather/opacity/apply/cancel panel
  can together cover nearly the entire canvas box on a short, heavily letterboxed landscape document
  at a narrow mobile viewport (e.g. a 1920x1080 document fitted into 390px width produces only a
  ~207px-tall canvas), leaving no free area to tap a mask point. This was left unfixed at the time
  the finding was first recorded here (the mobile test instead used a portrait document, matching
  the realistic orientation for that viewport, to work around it) but was subsequently addressed
  within the same sprint: the hint bar and panel now pin to the viewport (`position: fixed`, mirroring
  the existing `.onboarding-card`/`.hull-cta` mobile pattern) instead of the canvas's own box, and the
  overlay's stacking context is raised so those fixed elements aren't trapped below other fixed page
  chrome. The portrait-document mobile test still stands as its own valid coverage; it was not
  converted to a landscape document.
- **The environment-sampling "disabled without a space photo" UI state is architecturally
  unreachable and was deliberately left untested.** The environment-sampling controls only render
  inside a selected object's properties panel, which requires an object to exist, which requires a
  space photo to already exist (`canAddSignage = !!spaceBackground`); removing the space photo wipes
  the entire document (`createEmptyDocument`) rather than leaving a selected object with no photo. A
  test for this state was written, found to target dead code paths, and removed rather than forcing
  an artificial reproduction.
- **Golden-image baselines are an ongoing maintenance cost, not a one-time artifact.** Any future
  change to shadow, glow, reflection, blend, material, or curvature rendering that affects one of the
  three covered scenes will need its baseline regenerated via the documented Docker/Linux command
  (`docs/quality-runbook.md`) and re-committed — CI will fail the `quality` job otherwise. This is
  the intended tradeoff (catching unintended regressions) but means a deliberate rendering change is
  now a two-step commit (code + regenerated baseline) rather than one.
- **CI runtime increased** by the cost of a full Playwright Chromium run (84 tests, previously zero
  e2e tests ran in CI at all) on every quality-job invocation. Docker image build remains a separate,
  parallel job and is unaffected.

## Review trigger

Revisit this ADR when: occlusion masks need anything beyond enable/disable/feather/opacity (e.g.
per-mask blend modes or animated masks), `installationMode` grows a fourth value or starts affecting
something beyond shadow/reflection defaults, or the golden-image baseline corpus grows large enough
that regenerating it becomes a workflow bottleneck (candidate fix: a scheduled CI job rather than a
manual Docker step).
