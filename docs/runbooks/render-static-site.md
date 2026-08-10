# Runbook: Render Static Site deployment

Status: documented, not yet deployed. No live Render deployment has been created or
verified as of Sprint 4 (main now contains Sprint 0-3.2) — this is the configuration to
use when deployment is approved.

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

No deployment has been performed yet as of Sprint 4; this document describes the
intended configuration only.
