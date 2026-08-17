# Quality runbook: golden-image visual QA

`e2e/visual-qa.spec.ts` (`npm run qa:visual`) renders three canonical, deterministic scenes on the
live editor canvas and diffs them against committed baseline screenshots via Playwright's
`toHaveScreenshot`. See [`docs/adr/0010-scene-integration-occlusion-and-visual-qa-sprint-4-5.md`](adr/0010-scene-integration-occlusion-and-visual-qa-sprint-4-5.md)
for why this exists as a separate suite from `npm run test:e2e`'s behavioral flows and from the
targeted pixel-sampling assertions used elsewhere in `e2e/`.

## Why this can't run directly on a Windows dev machine

Playwright suffixes snapshot files with the OS/browser they were captured on
(`e2e/visual-qa.spec.ts-snapshots/*-chromium-linux.png`). CI runs on `ubuntu-latest`, so the
committed baselines are Linux baselines. Running `npm run qa:visual` directly on Windows compares
against those Linux baselines using a Windows-rendered screenshot and will show diffs from font
hinting/anti-aliasing differences alone, even when nothing actually regressed. Baselines must
always be generated (and regenerated) inside a matching Linux environment.

## Regenerating baselines

Only needed when a deliberate rendering change affects one of the three covered scenes (wall-mounted
LED on the Natural preset, freestanding portable with a ground shadow, four-point perspective
placement) — see the scene definitions in `e2e/visual-qa.spec.ts`. If `npm run qa:visual` fails in
CI after an intentional rendering change, regenerate the baselines and commit the updated PNGs
alongside the code change in the same PR.

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

## Adding a new golden scene

Keep the set small and deliberately curated — this suite exists to catch _whole-scene_ regressions
in shadow/glow/blend/material/reflection rendering that the targeted pixel-sample specs could miss,
not to become a general screenshot-testing dumping ground. Before adding a scene, check whether a
targeted pixel-sample assertion in an existing spec would catch the same regression more cheaply.
If a new scene is warranted, add it to `e2e/visual-qa.spec.ts` and generate its baseline using the
Docker command above in the same PR.
