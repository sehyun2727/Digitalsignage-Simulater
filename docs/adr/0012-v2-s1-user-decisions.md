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
- `docs/v2/requirements.md` "요구 전제의 확인 요청 사항" items 1-4 are now answered —
  mark them resolved there.
