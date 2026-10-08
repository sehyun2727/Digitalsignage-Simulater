# Runbook: Render Static Site deployment

Status: live at `https://digitalsignage-simulater.onrender.com` as a staging environment
that mirrors the current `main` branch. The production site at
`https://hull-inc.jp/oitemiru/` is a separate manual upload described at the bottom of
this document, not a Render deploy.

## Branches and deployment (v2 workflow)

- Active development happens on the **`v2`** branch. All feature commits and all CC pushes
  target `origin v2`.
- `main` only advances when the S7 **`v2 → main` pull request** is merged. Render redeploys
  from `main`, so merging the PR is what releases the sprint into staging.
- Direct pushes to `main` from a developer workstation are forbidden. The local pre-push
  hook under `.git/hooks/pre-push` rejects:
  1. any push whose remote ref is `refs/heads/main`,
  2. non-fast-forward pushes to any ref (so `--force` cannot sneak around guard 1),
  3. remote-ref deletions (local sha all-zeros).
- **Re-installing the hook on a new clone**: the hook lives inside `.git/`, which git does
  not track, so a fresh clone has no guard. After cloning, copy `pre-push` into
  `.git/hooks/pre-push`, then `chmod +x .git/hooks/pre-push`. (The canonical copy of the
  hook body is reproduced in `docs/runbooks/pre-push-hook.sh` for easy restoration — if
  that file is missing, the latest version lives in the sprint retrospective tagged
  `v2-S4-ok` or later.) Verify with a direct stdin test:
  ```
  echo "refs/heads/v2 c0f4196 refs/heads/main 4e9659d" | .git/hooks/pre-push origin x
  # expected: refusing push to refs/heads/main; exit 1
  ```
  `git push --dry-run` intentionally skips `pre-push` per git design, so direct stdin is
  the only self-contained way to confirm installation.

## Two build targets

The same codebase produces two dist outputs depending on which URL path serves them.
Keep the base as a CLI flag — do **not** hard-code it in `vite.config.ts`, because a
hard-coded `base` breaks whichever environment it does not match.

| Script                   | Output folder    | Effective base | Target                                                    |
| ------------------------ | ---------------- | -------------- | --------------------------------------------------------- |
| `npm run build`          | `dist/`          | `/`            | Render staging (served at root)                           |
| `npm run build:oitemiru` | `dist-oitemiru/` | `/oitemiru/`   | `hull-inc.jp/oitemiru/` manual upload (served at subpath) |

Preview locally with `npm run preview` (root) or `npm run preview:oitemiru` — the latter
reads `dist-oitemiru/` and serves at `http://localhost:4173/oitemiru/`.

`dist-oitemiru/` is git-ignored (see `.gitignore`, `.prettierignore`,
`eslint.config.js`). Never commit it.

## Service type

Render **Static Site** (not a Web Service). The app has no server-side runtime
requirement, so a static site avoids paying for and operating a server process.

## Settings

| Setting               | Value                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Root directory        | repository root (`.`)                                                                         |
| Build command         | `npm ci && npm run build`                                                                     |
| Publish directory     | `dist`                                                                                        |
| Node version          | 22.x (set via a `.node-version` file or Render's environment settings if the default changes) |
| Environment variables | None required for Sprint 0                                                                    |

## SPA fallback

This is a client-side-routed single-page app. Configure a Render rewrite rule so unknown
paths serve `index.html` instead of 404ing:

- Source: `/*`
- Destination: `/index.html`
- Action: Rewrite

(Equivalent to the `try_files ... /index.html;` rule in `docker/nginx.conf`, used for the
Docker image.)

## Cold start / free-plan limitations

Render's free Static Site plan serves pre-built static assets from a CDN and does not
have a server process to "cold start," but free-plan builds may queue and free bandwidth
is capped — check current Render free-plan limits before relying on this for
production-scale traffic.

## Deploying from the default branch

Connect the Render Static Site to the GitHub repository's `main` branch. Render rebuilds
automatically on pushes to `main` once connected. No auto-deploy from feature branches is
configured; Sprint 0 does not add production auto-deployment beyond what Render's default
"deploy on push to the connected branch" behavior provides.

## Verification checklist before treating a deploy as done

- [ ] Build command succeeds on Render, not just locally.
- [ ] Publish directory contains `index.html` and hashed asset files.
- [ ] SPA rewrite rule is active (reloading a non-root path does not 404).
- [ ] Default language is Japanese on first load.
- [ ] HULL CTA link works and opens in a new tab.

## hull-inc.jp/oitemiru/ manual upload (production)

The production site at `https://hull-inc.jp/oitemiru/` is **not** a Render deploy. It is
served by HULL's own web hosting at a subpath, and updates are pushed by manually
uploading a build. `git push` does not affect it.

Procedure:

1. Run `npm run build:oitemiru` locally on a clean checkout of the release commit. This
   writes `dist-oitemiru/` with all asset URLs prefixed by `/oitemiru/`.
2. On the hosting side, back up the current `/oitemiru/` folder (rename to something
   like `oitemiru-YYYYMMDD/`) so you have a one-step rollback if the new upload breaks.
3. Upload the **contents of** `dist-oitemiru/` (not the folder itself) into the
   `/oitemiru/` directory on the server, replacing existing files.
4. Verify: open `https://hull-inc.jp/oitemiru/`, reload, upload a photo, export a PNG.
   Check the browser network tab — every asset request should be under `/oitemiru/…`
   and return 200.
5. If anything is broken, restore the backup folder to `oitemiru/` as the rollback.

Never upload `dist/` (root build) to `/oitemiru/`, and never upload `dist-oitemiru/` to
Render — the base prefixes are mutually exclusive.
