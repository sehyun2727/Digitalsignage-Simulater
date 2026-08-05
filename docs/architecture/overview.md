# Architecture overview

## Status

Sprint 0 foundation. No editor, canvas, upload, or export functionality exists yet.

## Runtime shape

The app is a single-page, browser-only React application. There is no backend, database,
or server-side persistence in the MVP. All planned processing (image handling, canvas
composition, export) is expected to run entirely client-side in later sprints.

```
Browser
 └── React app (Vite build, static assets)
      ├── i18n (ja default, ko, en) — localStorage preference only
      ├── App shell (Sprint 0 placeholder)
      └── (Sprint 1+) Zustand store, Konva canvas, editor features
```

## Directory layout

Flat `src/` layout, per `CLAUDE.md` §4 (chosen over a monorepo `apps/` tree — see
[ADR 0001](../adr/0001-frontend-foundation.md)):

- `src/app/` — application root (`App.tsx`).
- `src/components/` — reusable presentational components (`LanguageSelector`, `HullCta`).
- `src/i18n/` — locale resources, detection, persistence, React context.
- `src/lib/` — framework-agnostic constants/utilities (e.g. the HULL contact URL).
- `src/styles/` — global stylesheet.
- `src/types/` — shared domain types (currently just the i18n `Locale`/`Messages` types).
- `src/test/` — Vitest environment setup.
- `tests/unit/` — Vitest + React Testing Library unit/component tests.
- `e2e/` — Playwright smoke tests.
- `docs/` — architecture notes, ADRs, runbooks.

`src/features/editor/` and `src/store/` are reserved by `CLAUDE.md` for Sprint 1 and are
intentionally not created yet — there is nothing to put in them until the editor is approved.

## State management

No application state exists beyond the current UI locale (React context) in Sprint 0.
Zustand is installed as an approved dependency for the Sprint 1 editor store but is not
wired up to anything yet.

## Canvas rendering

Konva and `react-konva` are installed as approved dependencies for the Sprint 1 canvas but
no canvas is rendered in Sprint 0. See the video gate in `CLAUDE.md` §3 for the separate
spike required before any video-related canvas work.

## Deployment shape

- Static build (`vite build`) served as static files.
- Primary target: Render Static Site (see
  [runbooks/render-static-site.md](../runbooks/render-static-site.md)).
- Docker image (Nginx serving the static build with SPA fallback) provided as a
  reproducible local/alternative-hosting baseline, not as the primary Render deployment
  method.

## Privacy boundary

No network calls are made to any application-controlled backend, because there is no
backend. The only outbound link is the explicit HULL contact CTA, opened by the user in
a new tab.
