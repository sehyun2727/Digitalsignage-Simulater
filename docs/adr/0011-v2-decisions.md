# ADR 0011: v2 planning decisions

## Status

Accepted — v2-S0 (2026-10).

## Context

The project moved from an "independent personal MVP" framing (Sprint 1 CLAUDE.md,
preserved verbatim at `docs/archive/CLAUDE-v1-sprint1.md`) to a HULL-operated official
service deployed at `https://hull-inc.jp/oitemiru/`, with a Render-hosted staging site at
`https://digitalsignage-simulater.onrender.com`. The pre-v2 commit stream (500013d,
f40514f, ea44469, 4c0676c, 4e9659d) added subpath handling, a Terms of Service modal,
portrait 4K video acceptance, space-background vertical pan, and codec-aware upload error
normalization — all accepted into main on 2026-09-30 as the v2 baseline.

Alongside the baseline, the user-facing document "置いて見る君の修正案v2" collected 19
feedback items from internal use, which this ADR records the decisions for before any
code changes are made in S1–S7. The complete requirement list and acceptance criteria
live in `docs/v2/requirements.md`; this ADR records only the decisions that would
otherwise be ambiguous to a future reader.

## Decisions

### D-1. Central modal for signage detail settings → folded into the right panel (requirement 2-3)

The pre-v2 state had `AdvancedSettingsModal` (and historically a per-content detail
settings modal) opening in the center of the viewport, which hides the signage being
edited. S3 will fold the advanced settings into an accordion section inside the right
toolbar. Any remaining popovers must not cover the canvas region of the selected object.

### D-2. Rename レンダリングプリセット → 明るさ・時間帯 (requirement C10)

"レンダリングプリセット" collides visually with the 明るさ (brightness) slider that sits
in the same panel section — users were observed clicking the preset buttons expecting
them to behave like the slider. "明るさ・時間帯" names the preset by the user-perceived
effect rather than the implementation technique. The underlying renderingPresets.ts
identifiers do not change.

### D-3. Rename モザイク → 手前の物で隠す（マスク） (requirement 3-5 / C8)

"モザイク" implied the pixelation effect used to censor imagery, which is the opposite
of this feature's purpose (making signage look partly hidden behind a real foreground
object in the installation photo). The new label states the intent. The internal code
name `Occlusion` and the type `OcclusionMask` are retained to avoid rippling a renaming
pass through non-user-facing identifiers.

### D-4. Default space-background display mode: Fit (requirement 1-3)

Current behavior is Cover-only. S4 will add a Fit / Cover toggle whose default is Fit
(contain the entire photo inside the canvas with letterbox/pillarbox as needed). Cover
remains available for users who want to crop the photo to the full canvas. When Cover is
selected, the UI shows "写真の一部が切れて表示される場合があります。" The
coordinate-system question for existing signage during a Fit ↔ Cover switch is deferred
to the S4 implementation but defaults to "preserve canvas-absolute coordinates" per the
audit's reasoning (`docs/v2/audit.md` B-5-4, C22).

### D-5. HULL operates this service officially — no "personal project" copy anywhere user-visible

Terms of Service Article 2 (added pre-v2 in ea44469) explicitly states this is a HULL
official service. The prior CLAUDE.md and the UserGuideModal still contain
"independent personal project" / "not an official HULL service" phrasing. S0 rewrites
CLAUDE.md; S6 removes the remaining in-app copy from UserGuideModal and
`src/i18n/locales/*`.

### D-6. Two environments, two builds: no base in vite.config.ts (pre-v2 P-8, requirement C18)

Render serves the app from root `/`; the hull-inc.jp hosting serves it from `/oitemiru/`.
A hard-coded `base: '/oitemiru/'` in `vite.config.ts` was pushed on 2026-09-30 and would
have 404'd every asset on Render if that had been pushed as-is. The reversal: keep
`vite.config.ts` base-free (defaults to `/`) and expose `npm run build:oitemiru` which
passes `--base=/oitemiru/ --outDir dist-oitemiru --emptyOutDir` on the CLI.

```json
"build": "tsc -b && vite build",
"build:oitemiru": "tsc -b && vite build --base=/oitemiru/ --outDir dist-oitemiru --emptyOutDir",
```

Assets must reference paths through ES module imports or `import.meta.env.BASE_URL`.
Hardcoded `"/..."` asset strings in `src/` are forbidden. See `docs/v2/deployment.md` and
the updated `docs/runbooks/render-static-site.md` for the full workflow and the manual
upload procedure for hull-inc.jp.

### D-7. Portable signage: aspect ratio locked by default (requirement C19)

The portable product renders a device-shaped template (or a user-uploaded product photo)
inside a bounding box; stretching it non-proportionally distorts the product shape in a
way that looks obviously wrong in sales material. The Transformer has `keepRatio=true`
hard-coded for portable objects already; no user toggle is added. This decision formalizes
the existing behavior rather than introducing it.

### D-8. Push rules during S1–S6

During S1–S6, do not push to `origin/main`. Reason: Render's automatic redeploy would
show mid-sprint states to employees reviewing the staging environment, causing confusion
("why is feature X missing now?" between sprints). Only S7 pushes once, with user
authorization. The hull-inc.jp production is unaffected by push (manual upload), so this
rule does not change its release cadence.

## Alternatives considered

- **D-6 alternative**: a single `base: './'` relative-path build. Rejected because
  relative paths can behave differently under SPA fallback rewrites (deep-link
  reloads resolve `./` against the deep path, not the SPA root), and the dual-build cost
  is a few seconds of extra CI time versus the hard-to-debug class of bugs relative base
  can introduce.
- **D-4 alternative**: let Cover remain the default with the pan slider. Rejected because
  the fundamental complaint is "I can't see my whole photo," which the pan slider does
  not solve (it reveals one slice at a time).
- **D-5 alternative**: narrow the HULL association to the CTA button only, keeping the
  app itself labeled as a personal project. Rejected because the Terms of Service already
  bind HULL as the operator, and conflicting self-descriptions in the same product are a
  compliance/trust risk.

## Consequences

- `vite.config.ts` is base-free; any contributor adding `base: '…'` back must justify in
  a new ADR.
- Every v2 sprint ends with its own ADR entry only if it reverses a decision above or
  introduces a new one; otherwise, sprint results live in `docs/v2/*.md` and PR
  descriptions. ADR history preserved — no edits to 0001–0010.
- The user-facing copy of the app no longer refers to a personal project after S6.
- Future "hard-code one base for simplicity" refactors are explicitly out of scope.
