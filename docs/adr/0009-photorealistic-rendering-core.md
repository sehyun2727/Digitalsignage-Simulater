# ADR 0009: Non-AI photorealistic rendering core for Sprint 4.4

## Status

Accepted — Sprint 4.4.

## Context

`docs/quality/sprint-4-4-baseline.md` audited the Sprint 2-4.3 rendering source directly (not
from screenshots, since the project has no headless rendering harness) and confirmed seven visual-
quality defects: silhouette-driven (not luminance-driven) glow, a flat non-size-aware LED/
Transparent-LED grid opacity, a Transparent-LED default that reads more opaque than "transparent,"
an LCD reflection that washes the whole screen instead of reading as a localized highlight, an
environment-integration blend that grays the frame along with the screen, a generic detached
contact shadow that ships **disabled** by default, and no rendering-preset concept at all — every
object starting from one flat `DEFAULT_MATERIAL_SETTINGS` regardless of material or installation
context. Sprint 4.4's approved scope is to close these seven gaps with deterministic, non-AI
rendering changes so a freshly added display already looks plausible (spec §1/§21), while keeping
`CLAUDE.md`'s constraints unchanged (no accounts, no server persistence, no watermark, no AI
generation).

## Decisions

- **Named rendering presets (`natural`/`bright`/`night`) replace the single flat default**, in a
  new `src/lib/renderingPresets.ts`. `MATERIAL_BASE_SETTINGS` gives each material (LED/LCD/
  Transparent-LED) its own tuned `natural` baseline instead of one generic set; `bright`/`night`
  apply small additive deltas on top (`PRESET_ADJUSTMENT`) to brightness/contrast/intensity/glow,
  skipping settings a material doesn't use (e.g. LCD has no grid/glow). `getPresetContactShadow`
  and `getPresetEnvironmentIntegration` extend the same preset id to shadow strength and
  environment-blend strength, so one preset choice adjusts every layer together. `addDisplay`/
  `addPortable` (`editorStore.ts`) seed new objects from `resolvePresetPatch(..., DEFAULT_
RENDERING_PRESET)` instead of copying flat constants; the Toolbar's "Reset" actions now resolve
  to the `natural` preset per-material rather than one identical legacy default, and a new preset
  button group (`applyRenderingPreset` store action) lets a user re-seed all three layers at once.
  `detectActivePreset` is a pure, unpersisted reverse lookup ("does the object's current state
  exactly match a preset's resolved patch") used only to highlight the active button — it stops
  matching the moment a user hand-edits any slider, which is the intended behavior, not a bug.
- **Glow is scaled by actual content luminance, not just silhouette alpha.** `src/lib/
contentLuminance.ts`'s `sampleMeanLuminance` reads a downscaled (24x24) canvas copy of image
  content — mirroring the existing `detectHasAlpha` sampling precedent in `assetRegistry.ts` — and
  `glowLuminanceFactor` maps that into a `[0.15, 1]` multiplier applied to `materialSettings.glow`
  in `ScreenComposition.tsx`. Video content is deliberately **not** sampled (a canvas readback per
  animation frame would add real per-frame cost for a visual-only effect); it keeps the prior
  silhouette-only glow via `glowLuminanceFactor(null) === 1`. LCD never glows at all regardless of
  luminance (`normalized !== 'lcd' ? getGlowShadow(...) : null`), matching its non-emissive
  surface.
- **LED/Transparent-LED grid opacity now fades with rendered screen size.** `materialTexture.ts`'s
  `materialPatternOpacity` gained an optional `screenSizePx` parameter (`ScreenComposition.tsx`
  passes `Math.min(screen.width, screen.height)`); `sizeAwareGridMultiplier` linearly ramps from
  `GRID_OPACITY_MIN_MULTIPLIER` (0.25) at 28px up to full opacity at 140px, so a small display's
  individually-unresolvable pixel grid reads as smoother instead of tiling at full density
  regardless of size. LCD's highlight band is left size-independent (it isn't a repeating pixel
  grid, so there's nothing to alias at small sizes).
- **The LCD reflection is a narrow diagonal specular band, not a full-screen wash.**
  `LCD_HIGHLIGHT_COLOR_STOPS` changed from a single 0→1 diagonal ramp to a five-stop band
  (transparent until 22%, sharp peak at 30%, transparent again by 42%), and its cap
  (`LCD_HIGHLIGHT_MAX_OPACITY`) rose from 0.15 to 0.5 since the band itself is now narrow — the
  earlier low cap existed to keep a _full-width_ wash from looking too strong, and no longer
  applies to a localized streak. **A real coordinate-space bug was found and fixed while
  re-verifying this against a correctly rebuilt app** (see Consequences): the gradient's
  `fillLinearGradientStartPoint`/`EndPoint` in `ScreenComposition.tsx` had been set to
  `{x: screen.x, y: screen.y}`/`{x: screen.x + width, y: screen.y + height}`, but Konva resolves
  gradient coordinates in the shape's own local drawing space (always `(0,0)`-origin, regardless
  of the shape's `x`/`y` translate) — using `screen.x`/`screen.y` there double-counted the offset
  and shifted the visible peak well off its intended position whenever a screen region wasn't near
  local `(0,0)` (which is the common case for portable objects, whose default screen region starts
  20% into the object). Fixed to `{x: 0, y: 0}`/`{x: screen.width, y: screen.height}`.
- **Environment-integration blend is restricted to the screen region, not the whole object.**
  `SignageDisplayView.tsx`'s blend `Rect` now uses `screen.x/y/width/height` instead of `0/0/
object.width/object.height`, so the physical-looking frame/bezel stays out of the wash
  (`PortableProductView.tsx` already scoped its blend to the screen region and needed no change).
  `MAX_ENVIRONMENT_BLEND_OPACITY` also dropped from 0.35 to 0.22 — even screen-scoped, the old cap
  read as too aggressive a desaturation at full strength.
- **Contact shadow ships enabled by default, with per-installation-plane starting geometry.**
  `environmentIntegration.ts` adds `resolveShadowMode` (`'wall'` for a mounted display, `'window'`
  for Transparent-LED, `'freestanding'` for a portable product) and `SHADOW_MODE_BASE`, replacing
  the old single `DEFAULT_CONTACT_SHADOW` (`enabled: false`). A freshly added object now already
  has a plausible, plane-appropriate shadow — a wall display's is tight and close (`offsetY:
0.035`), a portable's is larger and more separated (`offsetY: 0.06`) — instead of requiring the
  user to opt in before the default composition looks credible. Rendering presets further scale
  each mode's base `strength` (`PRESET_SHADOW_MULTIPLIER`: bright 1.2x, night 0.7x).
- **Bezel thickness is capped, not just floored.** `SignageDisplayView.tsx`'s `bezelThickness`
  changed from `Math.max(4, min(w,h) * 0.04)` (unbounded at the top end) to `Math.min(18,
Math.max(4, ...))`, so a very large display's bezel can no longer grow arbitrarily thick.
- **Curvature strip seams are hidden by a small interior clip-edge overlap, not by increasing
  strip count.** `curvature.ts`'s `computeCurvatureStrips` now returns both a strip's true
  (non-overlapping) `x`/`width` — still used unchanged for the bezel outline geometry
  (`computeCurvatureOutlinePoints`) — and a separate `clipX`/`clipWidth` widened by `STRIP_SEAM_
OVERLAP_PX / 2` (0.5px) at interior boundaries only, leaving the outermost strips' true screen
  edges untouched. `ScreenComposition.tsx`'s per-strip `clipFunc` uses the widened rect, so
  adjacent strips' independently-clipped/transformed Konva Groups overlap by a sub-pixel amount
  instead of leaving a hairline anti-aliasing gap.
- **Cached Konva bitmaps are re-baked at export resolution immediately before every PNG export,
  then restored to interactive-editing resolution immediately after.** Konva's `.cache()` bakes a
  filtered node's bitmap at `devicePixelRatio` by default, independent of a later `stage.
toDataURL({pixelRatio})` export call — so LED's non-neutral default contrast (52, see the
  preset baselines above) or an active contact-shadow blur previously exported visibly blurrier
  than the live preview once export renders far above screen resolution (a large source photo
  shown small, per `EditorCanvas.tsx`'s `exportPixelRatio`). The new `src/lib/konvaCacheSync.ts`
  (`findCachedNodes`, `recacheAtPixelRatio`) walks the stage for every cached node (`ContrastGroup`
  in `ScreenComposition.tsx`, `ContactShadowView`'s blur cache) and re-runs `.cache()` at the
  export `pixelRatio`, restoring the default (no explicit `pixelRatio`) immediately after the
  `toDataURL()` snapshot so normal interactive-editing cost is unaffected.
- **No golden-image/screenshot-diff pipeline was built.** Per the baseline report's explicit scope
  decision, a full "render N fixtures and diff pixels" harness (spec §22-23, `npm run qa:visual`)
  is a substantial separate piece of infrastructure and stayed out of scope for this pass. Instead:
  deterministic _unit-level_ helpers (`contentLuminance.ts`'s luminance sampling,
  `renderingPresets.ts`'s pure preset resolution — both fully unit-testable without a real canvas)
  plus targeted Playwright pixel assertions for the specific defects above (contact-shadow-enabled-
  by-default rendering in the export, rendering-preset brightness differences in the export, the
  LCD highlight band actually rendering, cover-fit clipping) provide regression coverage without
  the ongoing maintenance cost of a reference-image corpus.

## Consequences

- **All seven baseline-confirmed defects are addressed**; the two "investigated, not confirmed"
  items (bezel thickness, curvature seam aliasing) were still tightened defensively even without a
  reproduced screenshot, per the baseline report's own recommendation.
- **A genuine rendering bug (the LCD gradient coordinate double-offset) was caught only because a
  stale build was discovered and corrected mid-sprint.** Playwright's `webServer` config runs
  `vite preview` against the **built** `dist/` folder, not live source — so `reuseExistingServer`
  can silently mask source changes indefinitely if a Playwright run isn't preceded by a fresh
  `npm run build`. Every E2E verification in this project must rebuild first; this is not
  automated away here (that would be an unapproved scope expansion into the E2E harness itself)
  but is recorded as an operational requirement for future sprints touching rendering code.
- **Rendering presets are a best-effort, unpersisted UI affordance, not a document-level field.**
  `detectActivePreset` recomputes on every render from the object's current values; there is
  deliberately no `object.activePreset` stored anywhere, so import/export, undo/redo, and object
  duplication all continue to work through the existing `materialSettings`/`contactShadow`/
  `environmentIntegration` fields with no new persisted concept to keep in sync.
- **Glow's luminance sampling adds one canvas readback per image-content commit** (memoized via
  `useMemo` on `[asset, content]` in `ScreenComposition.tsx`, not per animation frame), consistent
  with the project's "no per-pixel per-frame work" performance guidance; video content's glow
  remains an approximation (silhouette-only) rather than paying that cost per frame.
- **The export re-cache fix has no unit-test coverage of its own** — Konva node instantiation
  requires a real canvas that jsdom doesn't provide, and the codebase has no existing precedent for
  instantiating live Konva nodes in unit tests. It is verified instead via the existing E2E export
  pixel-resolution/pixel-color assertions plus TypeScript, which was a deliberate scope judgment
  call rather than an oversight.
- **The full Playwright suite grew to 71 tests** (two new cases in `e2e/content-material.spec.ts`:
  contact-shadow-enabled-by-default rendering in the export, and rendering-preset brightness
  differences carrying through to the export), all passing against a freshly built `dist/`.

## Review trigger

Revisit this ADR when: a golden-image/screenshot-diff pipeline is proposed for real (the baseline
report's deferred item), rendering presets grow object-level persistence or per-preset i18n content
beyond the current three fixed ids, or the Konva cache/export-resolution approach is replaced by a
different export pipeline (e.g. server-side rendering, which would also require revisiting
`CLAUDE.md`'s local-first/no-upload constraints).
