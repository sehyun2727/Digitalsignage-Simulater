# Signage Canvas — Claude Code Project Instructions

> **Working title:** Signage Canvas  
> **Project type:** Independent personal project  
> **Document status:** Project instructions for Claude Code and contributors  
> **Default language:** Japanese (日本語), with Korean and English support planned

## 1. Project identity and boundaries

Signage Canvas is an independent personal project for creating and exporting simple digital-signage compositions in the browser.

This project is **not an official HULL service, product, website, or affiliated implementation**. HULL appears only as an external call-to-action (CTA) destination:

- HULL contact: https://hull-inc.jp/contact

Do not imply endorsement, ownership, partnership, sponsorship, or operational relationship with HULL. Do not use HULL branding, logos, proprietary assets, internal terminology, or copied content without explicit permission. Keep any HULL reference limited to a clearly labeled external CTA.

### Product principles

1. **Local-first:** MVP editing and processing should happen in the browser whenever practical.
2. **Privacy by default:** Do not upload user assets or canvas data to a server unless a future feature explicitly requires it and the user is informed.
3. **No account for MVP:** Do not add authentication, user profiles, or account creation.
4. **No watermark for MVP:** Exports should not add a Signage Canvas watermark.
5. **Simple mobile support:** Support basic mobile viewing and interaction, but do not expand Sprint 1 into a fully optimized mobile editor.
6. **Export matters:** Image export is required for MVP.
7. **Evidence before complexity:** Video insertion and browser-side video export require a technical spike before implementation.
8. **Small, reviewable increments:** Do not code beyond the approved sprint scope.

## 2. Non-negotiable working rule: sprint approval

Before writing production code:

1. Read the current sprint scope in this file and any repository issue/spec supplied by the user.
2. Identify the requested change and its acceptance criteria.
3. Confirm that the change is inside the approved sprint.
4. If it is outside scope, stop and ask for approval rather than implementing it.
5. If a small supporting change is necessary, explain why and keep it minimal.
6. Do not opportunistically add adjacent features, refactors, abstractions, dependencies, or design systems.

When requirements are ambiguous, prefer the smallest reversible implementation and ask a focused question.

## 3. Current Sprint 1

### Sprint 1 goal

Establish a usable browser-local foundation for a Japanese-first signage canvas MVP, including basic composition and image export.

### In scope

- Vite + React + TypeScript project setup.
- Basic application shell and responsive layout.
- Japanese as the default UI language.
- Initial i18n structure for Japanese, Korean, and English.
- Canvas/editor foundation using Konva.
- Zustand state management for editor state.
- A simple canvas/stage with a manageable set of editable elements, such as:
  - text
  - image
  - background color
- Basic selection and positioning interactions.
- Basic text editing controls.
- Local image selection and browser-local image handling.
- PNG image export from the canvas.
- Clear empty, loading, and error states where applicable.
- Simple mobile layout/readability support.
- Basic automated checks and documentation.
- Render free-plan deployment configuration or documentation.
- GitHub Actions CI baseline.
- Docker development/production container baseline if the repository structure supports it.

### Out of scope for Sprint 1

Do not implement these unless the user explicitly approves a scope change:

- User accounts, authentication, teams, roles, or cloud projects.
- Server-side persistence or asset uploads.
- Backend APIs or databases.
- Paid plans, billing, analytics, or user tracking.
- Watermarks or watermark-removal workflows.
- Video insertion.
- Video export, especially browser-side video export.
- Video transcoding, FFmpeg, WebCodecs, or media-worker architecture.
- Collaborative editing or real-time synchronization.
- Templates marketplace, sharing links, comments, or publishing workflows.
- Advanced timeline, animation, transitions, audio, or scheduling.
- OCR, AI generation, background removal, or automatic layout.
- Full-featured mobile editor or native applications.
- HULL integration beyond an external CTA link.
- Broad visual redesign unrelated to the approved acceptance criteria.

### Video gate

Video insertion and browser-side video export are future work. Before coding them, create and complete a spike that evaluates:

- Browser support and codec constraints.
- Memory and performance behavior for realistic signage assets.
- Whether Konva can provide the required capture path.
- Export quality, timing, and audio policy.
- Security and local-file handling implications.
- A fallback or explicit unsupported-browser experience.

Do not add a video dependency or architecture based on assumptions.

## 4. Technical architecture

### Planned stack

- React
- TypeScript
- Vite
- Konva / React-Konva for canvas rendering
- Zustand for client state
- Browser APIs for local file selection and image export
- GitHub Actions for CI
- Docker for reproducible development/deployment
- Render free plan for the initial hosted deployment

Use the existing repository choices when they are already established. Do not replace the stack without approval.

### Recommended boundaries

- `src/app/`: application bootstrap, routing if needed, global providers.
- `src/components/`: reusable presentational UI components.
- `src/features/editor/`: editor-specific UI, canvas, tools, and behaviors.
- `src/store/`: Zustand slices and typed state actions.
- `src/i18n/`: locale resources, language selection, formatting helpers.
- `src/lib/`: small framework-agnostic utilities.
- `src/types/`: shared domain types.
- `src/styles/`: global styles and design tokens.
- `public/`: static assets only.
- `tests/`: unit, integration, and end-to-end tests as the project adopts them.

Keep canvas rendering, editor state, and UI controls separated. Prefer serializable editor state. Avoid placing DOM nodes, large binary blobs, or mutable Konva objects in Zustand unless there is a documented reason.

### State guidelines

- Define explicit TypeScript types for document, element, selection, viewport, and export settings.
- Use stable IDs for elements.
- Keep mutations predictable and easy to test.
- Keep transient interaction state separate from persisted document state where possible.
- Avoid hidden global state and implicit coupling between UI controls and canvas nodes.
- Clean up event listeners, object URLs, and subscriptions.

### File handling

- Use `<input type="file">` or an equivalent browser-local flow.
- Validate accepted file types and reasonable size limits before processing.
- Revoke object URLs when no longer needed.
- Do not transmit selected files to a server.
- Do not log file contents, object URLs, or sensitive metadata.

## 5. UX, accessibility, and i18n

### Language policy

- Japanese is the default language.
- Korean and English are supported through the same i18n mechanism.
- Do not scatter user-facing strings across components when they should be translation keys.
- Translation keys should be stable, descriptive, and grouped by feature.
- Avoid concatenating sentence fragments when grammar differs by language.
- Keep the HULL CTA label and explanatory context clear in all supported locales.
- Use Japanese-friendly text wrapping and avoid fixed widths that break CJK text.

### Accessibility

- Provide accessible labels for buttons, inputs, file pickers, and export controls.
- Ensure keyboard focus is visible.
- Do not rely on color alone for selection or errors.
- Use semantic HTML for controls and headings.
- Maintain reasonable contrast.
- For canvas interactions, provide a usable control alternative where practical and document limitations.
- Announce important errors and export status to assistive technologies when appropriate.

### Mobile

- Support basic responsive layout and readable controls.
- Avoid horizontal overflow in the primary workflow.
- Do not promise touch parity with desktop until it is tested.
- Keep the mobile implementation intentionally simple in Sprint 1.

## 6. Coding conventions

- Use strict TypeScript settings where possible.
- Prefer functional React components and explicit props.
- Keep components focused; extract only when reuse or clarity justifies it.
- Prefer named exports for reusable modules.
- Use `const` by default and avoid `any`.
- Validate external/user-controlled values at boundaries.
- Favor small pure functions for transformations and export preparation.
- Use clear names over clever abstractions.
- Add comments only for non-obvious constraints or browser behavior.
- Do not introduce a dependency for a small utility that can be safely implemented locally.
- Follow the repository formatter, linter, and import ordering rules.
- Preserve existing style unless the approved task changes it.

## 7. Testing and quality gates

At minimum, test the behavior changed by each PR.

Prioritize tests for:

- Store actions and state transitions.
- Element creation, selection, movement, and deletion where supported.
- i18n fallback and language selection.
- File type/size validation.
- Export invocation and error handling.
- Responsive-critical UI states.
- HULL CTA URL and external-link behavior.

Before opening a PR, run the repository's available checks, typically:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Do not claim a check passed if it was not run. If a script does not exist, report that clearly. For visual/editor changes, manually verify desktop and a basic mobile viewport.

## 8. Security and privacy

- Treat all imported files and text as untrusted input.
- Keep MVP processing browser-local.
- Never add an upload endpoint or telemetry without explicit approval and user-facing documentation.
- Do not use `dangerouslySetInnerHTML` for user content.
- Sanitize or constrain values used in URLs, styles, and SVG-related paths.
- Avoid exposing local file paths.
- Use HTTPS in deployment configuration.
- External HULL CTA links must be explicit, use the exact approved URL, and open safely if opened in a new tab.
- Do not store more user data than necessary in localStorage. If local persistence is added, document it and provide a clear reset path.
- Review dependency changes for known security and maintenance concerns.

## 9. Git, branches, PRs, and commits

### Branches

Use short, descriptive branches, for example:

- `feat/editor-text`
- `fix/export-error`
- `docs/sprint-1`
- `chore/ci`

Do not commit directly to the default branch unless the repository policy explicitly permits it.

### Commits

Use concise imperative Conventional Commit-style messages:

- `feat: add local image element`
- `fix: revoke image object URLs`
- `test: cover export validation`
- `docs: clarify local processing`

One logical change per commit. Do not mix unrelated formatting churn with functional work.

### Pull requests

Every PR should include:

- What changed and why.
- Scope and affected areas.
- Tests/checks run and their results.
- Screenshots or a short recording for meaningful UI changes.
- Privacy/security implications, if any.
- Confirmation that the change is within the approved sprint.
- Known limitations and follow-up work.

Do not merge speculative future work into a current-sprint PR.

## 10. Deployment and operations

The initial hosting target is Render's free plan. Keep deployment configuration compatible with its limits and document:

- Build command.
- Publish/start command.
- Required environment variables, if any.
- SPA fallback behavior.
- Expected cold-start or resource limitations.
- How to deploy from the default branch.

The app should remain useful without a backend. Do not add a server solely to support deployment unless approved.

Docker should provide a reproducible baseline, not an excuse to add infrastructure. Keep images small, avoid secrets in images, and document local commands.

GitHub Actions should run deterministic checks on pull requests and the default branch. Do not expose secrets in logs.

## 11. Definition of Done

A task is done only when all applicable items are true:

- The implementation matches the approved scope and acceptance criteria.
- TypeScript, lint, tests, and build checks pass, or failures are explicitly documented.
- User-facing strings use the i18n structure.
- Japanese default behavior is preserved.
- Korean and English behavior is not unintentionally broken.
- Accessibility and basic mobile behavior are checked.
- Browser-local privacy expectations are preserved.
- No unapproved account, upload, watermark, video, or HULL integration was added.
- Object URLs/listeners/resources are cleaned up where applicable.
- Documentation is updated for user-visible behavior or setup changes.
- The PR explains limitations and verification steps.
- The result is deployable or the blocking issue is clearly recorded.

## 12. Instruction priority

When instructions conflict, use this order:

1. System/developer instructions and repository security policies.
2. Explicit current user request.
3. Approved sprint scope and acceptance criteria.
4. This document.
5. Existing implementation conventions.

When in doubt, stop before expanding scope and ask for clarification.
