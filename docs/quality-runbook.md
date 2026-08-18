# Quality runbook: golden-image visual QA

`e2e/visual-qa.spec.ts` (`npm run qa:visual`) renders six canonical, deterministic scenes on the
live editor canvas and diffs them against committed baseline screenshots via Playwright's
`toHaveScreenshot`. See [`docs/adr/0010-scene-integration-occlusion-and-visual-qa-sprint-4-5.md`](adr/0010-scene-integration-occlusion-and-visual-qa-sprint-4-5.md)
for why this exists as a separate suite from `npm run test:e2e`'s behavioral flows and from the
targeted pixel-sampling assertions used elsewhere in `e2e/`.

The three original (Sprint 4.5) scenes use flat solid-color backgrounds: wall-mounted LED on the
Natural preset, freestanding portable with a ground contact shadow, and a four-point
perspective-placed display. Sprint 4.8 added three "real-photo-style" scenes that instead use
`scenePhotoPng()` (see `e2e/fixtures/README.md`) — a procedurally-drawn, non-flat stand-in for a
photo — paired with each rendering preset: a bright interior with an LCD display on the Natural
preset, a dark interior with an LED display on the Night preset, and outdoor daylight with an LED
display on the Bright preset (the `outdoor-led` material is legacy/not user-selectable, so
"outdoor" is represented via a normal display + the Bright preset instead). Sprint 4.8 also added a
PNG export validity check (`golden-image PNG export validity` describe block) that downloads an
export from a real-photo scenario and verifies it is a well-formed, correctly sized PNG via
`readPngDimensions()`, and a mobile smoke test in `e2e/mobile.spec.ts` covering the same real-photo
fixture at the 390x844 viewport.

## Why this can't run directly on a Windows dev machine

Playwright suffixes snapshot files with the OS/browser they were captured on
(`e2e/visual-qa.spec.ts-snapshots/*-chromium-linux.png`). CI runs on `ubuntu-latest`, so the
committed baselines are Linux baselines. Running `npm run qa:visual` directly on Windows compares
against those Linux baselines using a Windows-rendered screenshot and will show diffs from font
hinting/anti-aliasing differences alone, even when nothing actually regressed. Baselines must
always be generated (and regenerated) inside a matching Linux environment.

## Regenerating baselines

Only needed when a deliberate rendering change affects one of the six covered scenes — see the
scene definitions in `e2e/visual-qa.spec.ts`. If `npm run qa:visual` fails in CI after an
intentional rendering change, regenerate the baselines and commit the updated PNGs alongside the
code change in the same PR.

Run this from the repository root (PowerShell or POSIX shell; only Docker Desktop with Linux
containers is required — no local Node/Playwright install is used for this step):

```bash
docker run --rm \
  -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -c "npm ci && npx playwright test e2e/visual-qa.spec.ts --update-snapshots"
```

On Windows PowerShell, replace `"$PWD"` with `${PWD}` (or an absolute path):

```powershell
docker run --rm `
  -v "${PWD}:/work" -w /work `
  mcr.microsoft.com/playwright:v1.62.1-noble `
  bash -c "npm ci && npx playwright test e2e/visual-qa.spec.ts --update-snapshots"
```

The image tag (`v1.62.1-noble`) must match the `@playwright/test` version pinned in
`package.json` — bump both together, since a mismatched Playwright version can itself produce
spurious pixel diffs unrelated to any rendering change.

After the container exits, review the changed files under
`e2e/visual-qa.spec.ts-snapshots/` with `git diff`/an image viewer before committing — a diff you
did not expect is more likely a real regression than a baseline that needs updating.

## Running the comparison (CI, or manually inside the same container)

```bash
npm run qa:visual
```

This is also covered by `npm run test:e2e` (which runs every spec under `e2e/`, including
`visual-qa.spec.ts`) and by the `End-to-end tests` step in `.github/workflows/ci.yml`'s `quality`
job, which runs on `ubuntu-latest` and therefore compares against the correct platform's baselines
natively — no Docker step is needed in CI itself, only for local baseline regeneration.

## Resolved: freestanding-portable scenario didn't open the settings modal (fixed in Sprint 4.8)

The `'freestanding portable product with a ground contact shadow'` test used to query
`page.getByRole('combobox', { name: '設置面' })` directly, but the installation-mode control lives
inside `AdvancedSettingsModal` (moved there by the Sprint 4.5/4.6 settings-modal work, commits
`65241bc`/`dd35f7c`, both landed _after_ this spec file was added in `73cd365`) and the test never
opened that modal first, so the combobox was unreachable and the test timed out — on any platform,
not just Windows. Sprint 4.8 fixed it by opening the Appearance section's `詳細設定` button first,
scoping the `設置面` combobox and `閉じる` close-button locators to that dialog (avoiding the
Sprint-4.7-discovered accessible-name substring-collision pitfall via `exact: true`), and closing
the modal before continuing.

## Adding a new golden scene

Keep the set small and deliberately curated — this suite exists to catch _whole-scene_ regressions
in shadow/glow/blend/material/reflection rendering that the targeted pixel-sample specs could miss,
not to become a general screenshot-testing dumping ground. Before adding a scene, check whether a
targeted pixel-sample assertion in an existing spec would catch the same regression more cheaply.
If a new scene is warranted, add it to `e2e/visual-qa.spec.ts` and generate its baseline using the
Docker command above in the same PR.

## Manual QA checklist (pre-release / pre-Render-deploy)

Automated checks (`npm run lint`/`typecheck`/`test:run`/`test:e2e`/`build`, all Chromium-only via
Playwright) do not cover real cross-browser rendering or touch input. Run this checklist by hand
before a Render deploy or a release-labeled PR — it is deliberately short; do not expand it into a
full manual regression suite for every PR.

**Browsers** (desktop, latest stable unless noted):

- [ ] Chrome — full flow below
- [ ] Firefox — full flow below
- [ ] Safari (macOS) — full flow below, and confirm the video-export button is correctly absent
      (`captureStream`/`MediaRecorder` WebM support gap) and `editorExportVideoUnsupportedHint`
      shows instead
- [ ] Edge — spot-check the full flow (Chromium-based; lower risk of divergence from Chrome)

**Core flow, per browser above:**

- [ ] Upload a space photo (JPEG and PNG) — fits to the canvas, no console errors
- [ ] Add an LED, LCD, Transparent LED, and portable product — each renders with a visible default
      appearance
- [ ] Upload screen content (image, then video if the browser supports it) — displays correctly;
      an oversized/corrupted/wrong-type file shows the matching visible error message (not just a
      blank failure)
- [ ] Drag-and-drop a content file directly onto a display (not just the file-picker button)
- [ ] Undo/redo across several steps — no crash, no stale preview image
- [ ] Export PNG — downloads, opens, matches the on-screen composition (no selection handles baked
      in)
- [ ] Export video (where supported) — downloads and plays
- [ ] Switch language (JA/KO/EN) — no untranslated keys or broken layout in any of the three

**Mobile** (real device or browser device-emulation at minimum; a real iOS Safari + a real Android
Chrome pass is preferred before a release, since `<a download>` and file-input behavior can differ
from desktop and from emulation):

- [ ] Layout has no horizontal overflow at a narrow viewport (e.g. 390px wide)
- [ ] Upload space photo, add signage, upload content, export PNG — full flow completes
- [ ] Toolbar controls remain reachable and tappable (not obscured by the fixed HULL CTA)

**Accessibility spot-check:**

- [ ] Tab through the toolbar and header controls — focus is visible at every stop
- [ ] Trigger an upload error — the message is both visually shown near the top of the page (not
      only announced) and picked up by a screen reader (VoiceOver/NVDA), per the visible
      `role="status"` announcement described in `EditorLayout.tsx`

Record the browser/OS versions actually tested and any deviations in the PR description — do not
claim a checklist item passed if it was not run on that specific browser.
