# Runbook: local development

## Requirements

- Node.js 22.x (matches `.github/workflows/ci.yml`)
- npm (ships with Node)
- Docker, only if verifying the container image

## Install

```bash
npm ci
```

`npm ci` uses `package-lock.json` for a deterministic install. Use `npm install` only
when intentionally adding/updating a dependency.

## Line endings

The repository enforces LF line endings for all tracked text files via `.gitattributes`
(`* text=auto eol=lf`) and `.editorconfig` (`end_of_line = lf`), regardless of the
platform or a contributor's local `core.autocrlf` setting. This keeps Prettier's output
(`endOfLine: "lf"`, the default) stable across Windows, macOS, Linux, and CI, and avoids
`format:check` failures caused only by CRLF/LF drift.

If `npm run format:check` reports unexpected diffs after a fresh checkout on Windows, run:

```bash
git add --renormalize .
```

then discard and re-checkout any files it flags, so the working tree matches the
LF-normalized index. Image/font/media file types are explicitly marked `binary` in
`.gitattributes` and are never subject to line-ending conversion.

## Run the dev server

```bash
npm run dev
```

Open the local URL Vite prints (typically `http://localhost:5173`).

## Quality checks

```bash
npm run format:check   # Prettier check (use `npm run format` to fix)
npm run lint            # ESLint
npm run typecheck       # TypeScript project build (no emit)
npm run test            # Vitest, watch mode
npm run test:run        # Vitest, single run (used in CI)
npm run test:e2e        # Playwright smoke tests (starts a preview server automatically)
```

Playwright browsers must be installed once before the first `test:e2e` run:

```bash
npx playwright install --with-deps chromium
```

`e2e/mobile.spec.ts` covers a 390x844 mobile viewport by emulating Chromium's mobile
profile (touch, device scale factor, mobile user agent) — it still runs against
Chromium, not a real device. Real iOS Safari behavior is not verified by this suite.

## Production build

```bash
npm run build      # outputs to dist/
npm run preview     # serve the production build locally for a final check
```

## Docker

```bash
docker build -t digital-signage-simulator:sprint-0 .
docker run --rm -p 8080:8080 digital-signage-simulator:sprint-0
```

Then open `http://localhost:8080`.

## Locale behavior to check manually

- First visit (no stored preference, browser locale unsupported) shows Japanese.
- The language selector switches between 日本語 / 한국어 / English.
- Reloading the page after switching keeps the selected language (stored in
  `localStorage` under `signage-canvas.locale`; no other data is stored there).
- The HULL contact link opens `https://hull-inc.jp/contact` in a new tab and is labeled
  as external.

## Known limitations (Sprint 0)

- No editor, canvas, image upload, or export — this is a placeholder shell only.
- Mobile layout is basic and has not been tested across a wide device matrix.
