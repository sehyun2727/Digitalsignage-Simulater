# ADR 0001: Frontend foundation for Sprint 0

## Status

Accepted — Sprint 0.

## Context

Sprint 0's goal is a stable, testable, deployable project foundation for the Sprint 1
signage editor, without building any editor functionality yet. `CLAUDE.md` already
specifies the target stack (React, TypeScript, Vite, Konva/react-konva, Zustand, GitHub
Actions, Docker, Render free plan) and a flat `src/` directory layout. The Sprint 0
kickoff brief additionally proposed an `apps/web/` monorepo-style tree, but also said to
prefer the simplest structure that satisfies `CLAUDE.md` when the repository is a simple
single-app project — which it is, since this is a greenfield repository with no existing
backend or second app.

## Decisions

- **App structure:** flat `src/` layout as specified in `CLAUDE.md` §4
  (`src/app`, `src/components`, `src/features/editor`, `src/store`, `src/i18n`,
  `src/lib`, `src/types`, `src/styles`), not a monorepo. There is currently exactly one
  app and no backend, so `apps/web/` would add indirection (workspace config, root vs.
  app-level scripts) without a second workspace to justify it. This can be revisited if a
  backend or second frontend is approved later.
- **Package manager:** npm, matching the lockfile-based install commands already implied
  by `CLAUDE.md` §7 and the Sprint 0 brief.
- **React/Vite:** Vite + React + TypeScript, using `create-vite`'s `react-ts` template as
  the starting point, then replacing the generated linting setup (the template now
  defaults to `oxlint`) with ESLint + `typescript-eslint`, since `CLAUDE.md` §6 and the
  Sprint 0 brief both call for ESLint specifically.
- **i18n approach:** a small hand-written typed implementation (`src/types/i18n.ts`,
  `src/i18n/locales/*.ts`, `src/i18n/detectLocale.ts`, `src/i18n/storage.ts`,
  `src/i18n/LocaleProvider.tsx`) instead of a library such as `react-i18next`. Sprint 0
  only needs a handful of static strings across three locales with TypeScript already
  enforcing that every locale exports the same `Messages` shape; a library's plural
  rules, interpolation, and namespace-loading machinery are not needed yet. This should
  be revisited if Sprint 1 introduces pluralization, interpolation, or many more strings.
- **State management direction:** Zustand is installed now (approved dependency) but not
  used in Sprint 0 — there is no editor state yet. This avoids a churny "add Zustand
  later" PR when Sprint 1 starts.
- **Canvas library direction:** Konva and `react-konva` are installed now for the same
  reason, but no `<Stage>`/`<Layer>` is rendered in Sprint 0.
- **No backend in the MVP foundation:** `CLAUDE.md` requires browser-local, privacy-first
  processing with no account system and no server-side asset storage. A backend has no
  role until a future feature explicitly requires one (e.g. server-side video
  transcoding, which is explicitly out of scope and gated behind a separate spike).
- **Render Static Site as the initial deploy target:** the app is fully static after
  build (no SSR, no server-rendered routes), so a static site host avoids running and
  paying for a server process for content that doesn't need one. Docker is provided as a
  reproducible local-dev/alternative-hosting baseline, not as the Render deployment path.

## Consequences

- Editor state and canvas code added in Sprint 1 will live in `src/store/` and
  `src/features/editor/`, which don't exist yet — they'll be created when that work
  starts, not preemptively.
- If a second app or a backend service is approved later, this decision should be
  revisited; moving to `apps/web/` after the fact is a mechanical but non-trivial import
  path change.
- Because i18n is hand-rolled, adding a fourth locale or richer formatting
  (pluralization, number/date formatting) will require either extending the small
  implementation or migrating to a library — that trade-off should be made explicitly
  when the need arises, not assumed now.

## Review trigger

Revisit this ADR when: a backend/API is approved, a second frontend app is approved, or
i18n requirements grow beyond static per-locale strings.
