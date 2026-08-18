# Sprint 4.4 baseline visual-quality defect report

Compiled by reading the Sprint 2-4.3 rendering source directly (`ScreenComposition.tsx`,
`SignageDisplayView.tsx`, `PortableProductView.tsx`, `materialTexture.ts`, `curvature.ts`,
`displayFrame.ts`, `environmentIntegration.ts`) rather than from rendered screenshots, since the
project has no headless rendering harness yet (see "Not implemented" below). Each item traces to
concrete code so the Sprint 4.4 fix can be verified against it directly.

## Confirmed defects

1. **Glow is silhouette-driven, not content-luminance-driven.** `ScreenComposition.tsx` passes
   `getGlowShadow(materialSettings.glow)` as a Konva `shadowColor/shadowBlur/shadowOpacity` on the
   whole content `<KonvaImage>`. Konva shadows follow the shape's alpha silhouette, not per-pixel
   brightness, so a fully dark/black content image gets the same glow halo as bright content —
   directly contradicting "content remains readable... bright regions contribute more glow, dark
   regions contribute little or none" (spec §14).
2. **LED/Transparent LED grid opacity is flat, not screen-size-aware.** `materialPatternOpacity`
   (`materialTexture.ts`) scales only with the `intensity` setting; the repeating grid-line tile
   from `getLedPatternCanvas` (3-5px, since Sprint 4.9) is drawn at the same opacity regardless of the screen's rendered
   pixel size, so a small display reads with the same grid density as a large one instead of fading
   out — contradicts "grid opacity decreases when screen is displayed small" (spec §8).
3. **Transparent LED's default reads more opaque than "transparent."** `DEFAULT_MATERIAL_SETTINGS.
transparency` is `60`; `transparentBackingOpacity(60)` resolves to ~0.39 backing opacity, and
   dark content pixels barely lift alpha under the `'lighten'` composite, so the default state
   already reads as a fairly solid dark panel rather than "clearly transparent" (spec §21).
4. **LCD reflection is a full-diagonal wash, not a localized highlight.** The `LCD_HIGHLIGHT_COLOR_
STOPS` gradient spans the entire screen corner-to-corner at up to `LCD_HIGHLIGHT_MAX_OPACITY`
   (0.15); this reads as a uniform screen-wide gray/white wash rather than a directional, localized
   highlight band — contradicts "reflection does not uniformly gray the whole screen" (spec §15).
5. **Environment integration blends the whole object (frame + screen), and can read muddy.**
   `environmentBlendOpacity` (up to 0.35) is applied as a flat `ENVIRONMENT_BLEND_COLOR` (#888c94)
   wash over the _entire_ object bounding box in `SignageDisplayView`/`PortableProductView`,
   including the frame — at higher strength this desaturates and grays both content and frame
   together, which is the "reducing visibility too aggressively" / "muddy" failure mode called out
   in spec §6 and §16.
6. **Contact shadow is a generic floating ellipse, not silhouette/plane-attached.** `Contact
ShadowView` always draws a fixed squashed ellipse under the object's _unrotated_ bounding-box
   footprint with a default `offsetY: 0.2` (20% of object height below it) — a large, generic,
   detached-looking shadow disconnected from the frame/screen silhouette, and disabled by default
   (`DEFAULT_CONTACT_SHADOW.enabled = false`), so the "default result... must already look
   credible" flow (spec §1, §21) currently ships with _no_ shadow at all. Contradicts "a shadow
   should attach signage to the installation plane, not float as a generic rectangle" (spec §13).
7. **No rendering presets exist.** There is no Natural/Bright/Night concept anywhere in
   `types/editor.ts` or the store; every object always starts from one flat `DEFAULT_MATERIAL_
SETTINGS`, so tuning for a bright exterior vs. a dark interior currently requires manually
   adjusting every slider (spec §7, §21).

## Investigated, not confirmed as defects

- **Frame/bezel thickness**: `wall-led`'s `screenRegion` inset is only 2% of the object's own
  width/height (`DISPLAY_FRAME_TEMPLATES['wall-led']`), which is already numerically thin; the
  curved-outline bezel stroke (`SignageDisplayView.tsx` `bezelThickness`) is `max(4, min(w,h) *
0.04)`, uncapped at the top end. Sprint 4.4 still tightens/caps this (spec §12) since the
  screenshot referenced in the sprint brief was not independently reproduced here, but the flat
  2%/4% figures are not obviously "excessive" from the code alone.
- **Preview/export mismatch**: preview and PNG export already render through the same Konva Stage
  and the same `ScreenComposition`/`SignageDisplayView`/`PortableProductView` tree with no
  export-only or preview-only CSS filters found — no mismatch defect identified in the current
  code. Sprint 4.4 keeps this property intact rather than fixing a regression.
- **Edge aliasing / seam gaps** in curvature strips and perspective mesh triangles: plausible from
  the strip/triangle-based geometry (`curvature.ts`, `PerspectiveScreenView.tsx`) but not
  confirmable without an actual rendered frame; addressed defensively (small strip-edge overlap)
  rather than from a reproduced defect.

## Not implemented for this baseline

A full automated "render N fixture scenarios and diff pixels" golden-image pipeline (spec §22-23,
`npm run qa:visual`) was **not** built for this baseline pass — it is a substantial separate piece
of infrastructure (headless Chromium/Playwright screenshot capture, reference-image storage
policy, diffing) and is out of scope for the time available in this pass. Instead, Sprint 4.4 adds
deterministic _unit-level_ pixel/metric helpers (luminance, background-retention ratio, grid
coverage) with unit tests, and targeted Playwright assertions for the specific defects above. See
`docs/adr/0009-photorealistic-rendering-core.md` for the full list of scope decisions and
deferrals.
