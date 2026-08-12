# ADR 0006: Unified professional toolbar for Sprint 4.1

## Status

Accepted — Sprint 4.1 (supersedes an earlier five-stage guided-editor design that was
built, then rejected before merge; see "Rejected alternative" below).

## Context

Sprints 1–3 built a capable but flat editor: one always-visible toolbar plus a single
properties panel. An initial Sprint 4.1 pass wrapped that in a five-stage guided flow
(Space → Signage → Content → Effects → Export, each stage mounted/unmounted on
navigation, with per-stage completion badges). That design was formally rejected before
merge in favor of a **single unified right-side toolbar with six always-visible,
fixed-order sections**, so this ADR documents the corrected, shipped design.
`CLAUDE.md` still excludes accounts, server persistence, and broad visual redesign
unrelated to the approved acceptance criteria; the guiding constraint throughout the
correction was the same as before: restructure navigation chrome only, don't touch how
documents are edited, stored, or exported underneath.

## Decisions

- **`Toolbar.tsx` renders six fixed sections unconditionally, in a fixed order — Space,
  Add signage, Selected signage, Content, Appearance, Export.** Nothing here is
  mounted/unmounted based on a navigation state; every control is reachable at all
  times. This replaces the rejected design's per-stage mount/unmount
  (`StageSection.tsx`) and its document-derived completion badges
  (`computeStageStatus`) entirely — there is no longer a concept of "which stage the
  user is on," so there is nothing to badge or gate.
- **`useUiStore` (Zustand) holds only `comparisonMode` and `onboardingDismissed`** —
  the `stage` field from the rejected design's `useGuidedUiStore` is gone along with
  the stage concept itself. `onboardingDismissed` is still the one value that survives
  reload, via `src/lib/onboardingStorage.ts` (localStorage key
  `signage-canvas.onboarding-dismissed`, wrapped in try/catch so private-browsing mode
  degrades to "onboarding reappears next session" rather than throwing).
- **`EditorLayout.tsx` is a header row (Product title, Undo, Redo, a quick-compare
  toggle, language selector, Export) plus a workspace (canvas beside the toolbar) plus
  a compact status bar**, not a guided-flow shell. The header's quick-compare button
  and Export button are deliberately the _only_ place those actions live —
  accessible-name uniqueness is a hard requirement carried over from the correction
  spec:
  - Undo / Redo / Export exist only in the header.
  - Delete exists only in the toolbar's Selected-signage section.
  - The Result/Original comparison toggle group exists only in the toolbar's Export
    section, with static labels (`comparisonResultLabel` / `comparisonOriginalLabel`,
    i.e. "結果" / "オリジナル"). The header's quick-compare button is a separate,
    distinctly-worded dynamic toggle (`headerCompareToOriginalButton` /
    `headerCompareToResultButton`, i.e. "オリジナルと比較" / "結果表示に戻る") that
    drives the same `comparisonMode` state but is not the same control.
  - This uniqueness rule matters beyond accessibility: because the header's dynamic
    label textually _contains_ the toolbar's static label as a substring (e.g.
    "オリジナルと比較" contains "オリジナル"), and Playwright's `getByRole(..., {
name })` matches substrings by default, `e2e/comparison-toggle.spec.ts` had to
    add `exact: true` to its toolbar-button locators to avoid ambiguously matching
    both controls. Any future toolbar/header label pair with the same
    substring relationship needs the same treatment.
- **An original/result comparison toggle (`comparisonMode` in `useUiStore`) lets the
  user view the space photo alone instead of the composed result**, unchanged in
  mechanism from the rejected design: `EditorCanvas` accepts a `comparisonMode` prop
  that suppresses rendering of every signage object, the Transformer, and
  drag-and-drop entirely, and both toggle controls clear selection
  (`selectObject(null)`) when entering comparison mode. **Export always exports the
  composed Result, never the Original, regardless of which view is on screen**:
  `EditorCanvas.exportToDataUrl()` force-shows the objects group and hides the
  Transformer for the duration of the synchronous `toDataURL()` call, then restores
  whatever the user was actually looking at.
- **A first-visit onboarding overlay (`OnboardingOverlay.tsx`) is a small,
  non-blocking `role="note"` card, not a modal dialog.** It has no backdrop, no focus
  trap, no scroll lock, and no Escape handler — every toolbar and canvas control stays
  fully usable while it is showing, and clicking elsewhere on the page does not
  dismiss it. This is a deliberate departure from the rejected design's reuse of the
  `PortableBuilderModal` modal pattern (`role="dialog"`, `aria-modal`, focus trap):
  the correction spec required onboarding to never block toolbar use, which a modal
  fundamentally cannot satisfy. Both the Start and Dismiss buttons call the same
  `dismissOnboarding` store action.
- **The HULL CTA (`HullCta.tsx`) stays a fixed bottom-right green button**
  (`position: fixed`, `z-index: 5`), unchanged from the rejected design's positioning
  decision — this part of the original ADR held up independent of the stage-vs-toolbar
  question.
- **Export pixel-dimension truncation fix**: Konva's `Stage.toDataURL({ pixelRatio })`
  assigns the exported canvas's pixel dimensions via a raw `canvas.width =`/`canvas.height
=` write, which truncates toward zero rather than rounding. A `pixelRatio` that is the
  exact mathematical inverse of the stage's fit scale can land a hair under the target
  template size (e.g. `1919.999999999998`, truncating to `1919` instead of `1920`) due to
  compounded floating-point error. `EditorCanvas.tsx` now nudges the export pixel ratio by
  a `(1 + 1e-6)` safety epsilon so the pre-truncation value always lands safely above the
  integer boundary, with no visible effect on the exported image.
- **Mobile layout fixes discovered while re-validating the full Playwright suite against
  the unified toolbar** (`src/styles/global.css`, all inside the `@media (max-width:
48rem)` block):
  - `.editor-header-actions` sets `flex-shrink: 0` on desktop so the action row never
    gets squeezed on wide screens. On mobile that same property was defeating its own
    `flex-wrap: wrap`: a flex item's _preferred_ width is computed as if unwrapped
    regardless of its own `flex-wrap` setting, so `flex-shrink: 0` kept forcing the row
    (and the whole page) as wide as its unwrapped content. The mobile override adds
    `flex-shrink: 1; min-width: 0;` so the wrap can actually take effect.
  - `.toolbar-actions-grid` (the Add-signage section's 2-column button grid) forced
    horizontal overflow at 390px because the body's global `word-break: keep-all`
    (kept deliberately so CJK phrases don't break at arbitrary characters) prevents
    long unspaced Japanese labels like "スタンド型ディスプレイを追加" from wrapping at
    all, so each grid cell's min-content exceeded a 390px column's share. Mobile now
    switches this grid to a single column, giving each label the full toolbar width.
  - `.editor-canvas-wrapper` uses `align-items`/`justify-content: center` to center the
    canvas within the available space. Plain `center` centers _overflowing_ content in
    both directions, so a portrait template taller than the available height (Stand
    Display) pushed its top edge up past the wrapper's own box and under the header
    above it — a corner click meant to hit blank canvas (deselecting) landed on the
    header instead. Changed to `safe center`, which centers when content fits and falls
    back to start-alignment when it doesn't, so overflow only ever extends downward
    into the wrapper's own scroll area. This is not mobile-only — it also fixed a
    latent desktop-viewport bug (`e2e/reselection.spec.ts`'s Stand Display case), so
    the fix lives outside the mobile media query.

## Rejected alternative

The originally-built five-stage guided flow (`GUIDED_STAGES`, `StageSection.tsx`,
`computeStageStatus`, a modal onboarding overlay reusing `PortableBuilderModal`'s
pattern) is fully removed from the codebase — no dead code, no feature flag. It is
recorded here only because its design rationale (progressive disclosure via real
mount/unmount, document-derived stage-completion badges) may resurface as a future
proposal; if it does, treat it as new scope requiring its own approval, not a revert of
this ADR.

## Consequences

- There is no longer any "what stage/step is the user on" state anywhere in the app.
  All six toolbar sections' DOM stays mounted at all times, which is a larger constant
  DOM footprint than the rejected design's per-stage mount/unmount, traded for simpler
  tests (no `goToStage` helpers) and a UI that matches the correction spec's
  "everything reachable at once" requirement.
- Playwright's `getByRole(..., { name })` matches substrings by default. Any new
  toolbar control whose label is a substring (or superset) of another control's label —
  especially the header vs. toolbar pairing described above — needs `exact: true` in
  its e2e locators, or a strict-mode "multiple elements found" failure will surface
  only at test time, not at compile time.
- `align-items: safe center` / `justify-content: safe center` need reasonably current
  browser support (recent Chromium and Firefox; Safari 16+). No fallback was added
  since this is an internal editor layout fix, not a public API surface, and the
  project's supported-browser bar was not otherwise revisited in this pass.
- Mobile header controls and Add-signage buttons now wrap onto multiple rows instead of
  forcing horizontal scroll, which increases vertical space used by the header on
  narrow viewports as an intentional trade for never overflowing the page horizontally.

## Review trigger

Revisit this ADR when: a staged/wizard-style flow is proposed again (treat it as new
scope, not a revert), a new header or toolbar control's label has a substring
relationship with an existing one (apply the same `exact: true` e2e treatment
immediately, don't wait for a flaky-test report), or `safe center` support needs to be
reconsidered for a browser this project decides to support.
