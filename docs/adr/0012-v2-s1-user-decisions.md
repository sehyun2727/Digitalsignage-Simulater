# ADR 0012: v2-S1 user decisions

## Status

Accepted — v2-S1 (2026-10).

## Context

v2-S0 ended with four open questions that the next spec work could not proceed on without
user input (`docs/v2/requirements.md` "요구 전제의 확인 요청 사항"). The user confirmed
answers for all four during the v2-S1 cycle. This ADR records them so each future sprint
(S3, S4, S6) can start without re-opening the questions.

## Decisions

### D-9. 2-6 — Manual entrypoint moves into the header (S3)

The current manual entrypoint is the 📖 button in the app footer (`src/app/App.tsx:29-40`,
labelled by `userGuideOpenButton`), with a decorative hint span 「← マニュアルはこちら」
(`userGuideHereHint`). Audit B-3-6 flagged that the PDF annotation points at the right panel
bottom, which the footer button does not match.

**Decision**: S3 adds an always-visible 「使い方ガイド」 button to the editor header, placed
next to the 言語 selector, which opens the existing `UserGuideModal`. The footer 📖 entry
stays as a secondary access point. The decorative `userGuideHereHint` (「← マニュアルはこちら」)
is removed once the header button exists (it points to the wrong location by then).

### D-10. 2-2 — Accordion default open/closed states (S3)

The right panel becomes an accordion of six sections. S3 opens them with these defaults:

- 「設置場所の写真」: **open** (needed before anything else)
- 「サイネージを追加」: **open** (the next step after a photo)
- 「選択中のサイネージ」: **auto-opens** the first time the session selects a signage;
  afterwards the user's open/closed choice is preserved and persists across signage
  selection changes.
- 「画面コンテンツ」: **auto-opens** the first time the session selects a signage;
  afterwards same as 「選択中のサイネージ」.
- 「サイネージ外観の調整」: **closed by default**, including every detail subsection
  (位置・サイズの詳細設定, コンテンツの詳細設定, 外観の詳細設定).
- 「書き出し」: **not collapsible** — fixed at the bottom of the panel (ties into 2-4's
  large export buttons placement).

When no signage is selected, the Selected-signage / Content / Appearance sections behave as
in v1 (hidden / placeholder, same empty-state copy).

### D-11. 1-3 — Space-photo Fit as the default, Fit↔Cover switch (S4)

- A newly uploaded space photo defaults to **Fit** (letterbox/pillarbox, show the whole
  photo).
- Users switch between Fit and Cover via a toggle in the 「設置場所の写真」 section.
- Fit↔Cover switching **preserves canvas-absolute signage coordinates** (an LED placed at
  pixel (300, 200) stays at (300, 200) regardless of mode). Perspective quads are already
  normalized (0..1 of document) per ADR 0008 and survive the switch unchanged.
- In Fit mode the wheel does not pan the background and `spaceBackground.offsetY` is 0.
  Switching to Fit resets `offsetY` to 0 immediately. Switching back to Cover does **not**
  restore the previous offset — it starts from 0 again.
- The switch is an undoable action (goes through `commitObjectChange` / history, not
  `updateObjectTransient`), and the chosen mode is reflected identically in the preview, the
  PNG export, and the video export (one `computeFit` function, three call sites).

### D-12. 4-1 — ko/en term translations in glossary.md stand as drafted (S6)

The ko/en columns in `docs/v2/glossary.md` ① ("変更 用어") are confirmed. S6 proceeds with
exactly those translations; S6 may still improve wording as part of the broader locale pass,
but no retranslation of these specific terms is required before starting.

### D-13. 5-2 — Perspective-mode content aspect comes from the quad, not from the stored width/height (S1 rework)

The first S1 attempt (`c31a36b`) proved only "same final state → same output" and
inadvertently defined the PDF-reported bug ("①追加 → ②パース → ③コンテンツ produces a
stretched content") as *correct behavior under invariant B*. The rework retracts that
conclusion.

In perspective mode the renderer now derives the logical screen's aspect from the perspective
quad itself. The pure helper `perspectiveLogicalAspect(quad, documentSize)` in
`src/lib/perspectiveLogicalSize.ts` returns:

```
apparent_width  = (|top edge| + |bottom edge|) / 2    // in document pixels
apparent_height = (|left edge| + |right edge|) / 2    // in document pixels
aspect          = apparent_width / apparent_height
```

Measurements are in **document pixel** space (via `normalizedQuadToDocument`), not canvas
fraction, because a 16:9 or 9:16 canvas shears edge-length comparisons taken on raw
fractional coordinates. The companion `getPerspectiveLogicalSize(width, height, quad,
documentSize)` keeps the raster width equal to the stored `object.width` and derives raster
height as `width / aspect`, so the offscreen pixel density matches rect mode's. Fallback
(stored width/height) applies when the quad is non-convex, self-intersecting, non-finite, or
when `documentSize` is unavailable. The function is pure — invariant A (no history/stored
captured size) is retained.

The frame screen inset rule (`DISPLAY_FRAME_TEMPLATES[frameId].screenRegion`) is
fraction-based for every current template (`wall-led` is x=0.02, y=0.02, w=0.96, h=0.96 per
`src/types/editor.ts:181`), so applying the inset after the aspect substitution preserves the
inset as an inset of the quad corners under warp.

Portable objects are out of scope — their screen quad is a separate compound-model concept
(see CLAUDE.md §3-5) and S4 owns any portable-specific perspective rework.

### D-14. 5-2 — Perspective mode disables the width/height toolbar inputs

The quad's four corner handles fully determine the warped body in perspective mode; a
separate width/height number input (or Transformer resize handle) would both re-introduce
PDF 5-2's "aspect comes from unrelated size" distortion and leave two UI surfaces that can't
agree about the signage's shape. S1's rework disables `editorWidthLabel` / `editorHeightLabel`
inputs when `object.placementMode === 'perspective' && object.perspectiveQuad !== null`.
Transformer resize handles were already de-facto disabled (the perspective-mode warped Group
in `SignageDisplayView.tsx` doesn't register a Konva node ref, so the shared Transformer
attaches to no node). The toolbar inputs now mirror that lock-out, with:

- `disabled={perspectiveLocked}` on both number inputs;
- a visible hint span rendered under them with id `perspective-size-locked-hint`;
- `aria-describedby="perspective-size-locked-hint"` on each input so screen readers announce
  the lock reason;
- an i18n key `perspectiveSizeLockedHint` with ja / ko / en strings (see glossary.md ②).

When the user returns the object to rect mode (via `通常配置に戻す`), the inputs re-enable
and the hint span is unmounted — see `Toolbar.tsx`'s `perspectiveLocked` branch.

**Scope follow-ups**:

- S3's requirement 3-1 (「位置・サイズの詳細設定」 collapsible section) and S4's requirement
  1-2 (「縦横比を固定」 lock-aspect-ratio toggle) must keep width/height inputs disabled in
  perspective mode. The 1-2 aspect-ratio toggle is a rect-mode-only feature under D-14.
- S6's locale pass covers the `perspectiveSizeLockedHint` wording in the broader review of
  v2 UI copy; the current ja/ko/en strings are the baseline but may be tightened then.

## Alternatives considered

- **D-9 alternative**: keep the manual entrypoint in the footer only, enlarging it visually.
  Rejected because 2-6's complaint is specifically about discoverability from a user who is
  working inside the right panel; adding a header button is a direct answer, and footer
  retention keeps mobile layouts (where the right panel scrolls) working.
- **D-11 alternative**: pixel-reproject existing signage when toggling Fit↔Cover so each
  signage "stays over the same photo spot." Rejected because the user-mental-model is "the
  canvas is a page, I placed signage on this spot of the page" — the photo is the background
  that re-fits, not the frame of reference for signage positions. Simpler to implement and
  matches ADR 0008's "perspective is normalized to document, not photo" principle.

## Consequences

- S3 implements D-9 and D-10. The 2-6 and 2-2 blocking question is cleared.
- S4 implements D-11. The 1-3 Fit/Cover design is now specified end-to-end.
- S6 proceeds with D-12. No translation revision required before S6 starts.
- S1 rework implements D-13 and D-14. `c31a36b` 's "code change unnecessary" conclusion is
  retracted in `docs/v2/audit.md` B-4-4 and `docs/v2/requirements.md` 5-2.
- `docs/v2/requirements.md` "요구 전제의 확인 요청 사항" items 1-4 are now answered —
  mark them resolved there.
