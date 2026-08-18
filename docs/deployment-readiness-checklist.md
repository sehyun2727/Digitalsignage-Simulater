# Deployment readiness checklist

A short, project-wide gate to run through before deploying a given commit to Render (or any other
host). This is separate from and does not duplicate the two more detailed, narrower checklists it
links to below — it exists to make sure those don't get skipped, not to replace them.

## 1. Automated checks pass on the exact commit being deployed

Run from a clean checkout of that commit (not just "passed at some point during the branch"):

- [ ] `npm ci`
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test` (`test:run`)
- [ ] `npm run build`
- [ ] `npm run test:e2e` (includes `qa:visual`; must run on Linux/CI or inside the Docker image
      described in [`quality-runbook.md`](quality-runbook.md) — running it directly on a
      non-Linux machine produces spurious golden-image diffs, see that doc)

CI (`.github/workflows/ci.yml`'s `quality` job) already runs all of the above on every PR to
`main` and on pushes to `main`; if deploying straight from `main` at a commit CI already passed,
re-running locally is optional — but for any other ref, run them.

## 2. Manual QA

- [ ] The [manual QA checklist](quality-runbook.md#manual-qa-checklist-pre-release--pre-render-deploy)
      in `quality-runbook.md` has been run on at least the core desktop browsers (Chrome, Firefox,
      Safari) and one mobile pass, with results/deviations recorded in the PR or release notes.

## 3. Scope and documentation currency

- [ ] The change stayed within the approved sprint scope (CLAUDE.md §2/§3) — no unapproved
      accounts, uploads, watermarks, telemetry, or HULL integration beyond the external CTA link.
- [ ] `README.md`'s policy sections (image/video upload limits, export policy, known limitations)
      reflect the current code, not a stale prior sprint's behavior.
- [ ] Any new user-facing string exists in all three locales (`ja`/`ko`/`en`) — `npm run typecheck`
      already enforces this at the type level (`Messages` interface), but review the actual
      translated text, not just that a key exists.

## 4. Privacy and security

- [ ] No new network calls to a server for user files/canvas data were introduced (CLAUDE.md §8 —
      MVP processing must stay browser-local).
- [ ] No new `localStorage` usage beyond the existing language-preference key, or if added, it is
      documented with a reset path.
- [ ] No secrets or `.env` values are committed.

## 5. Hosting configuration

- [ ] Render Static Site settings match [`runbooks/render-static-site.md`](runbooks/render-static-site.md)
      (build command, publish directory, Node version, SPA rewrite rule).
- [ ] The Node version in `Dockerfile`, `.github/workflows/ci.yml`, and the Render runbook are
      still in agreement (currently Node 22).

## 6. Rollback plan

- [ ] Know how to revert: Render redeploys are tied to commits on the connected branch, so
      rolling back means redeploying (or pushing a revert of) the last known-good commit — confirm
      that commit's hash before deploying, in case a rollback is needed after release.

## Sign-off

Record the date, the commit hash deployed, who ran this checklist, and any unchecked/deviated
items with a reason. Do not mark an item done if it was not actually run for this deploy.
