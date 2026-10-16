import { defineConfig, devices } from '@playwright/test';

// Overridable so a locally occupied default port (e.g. an unrelated project already bound to
// 4173) can't cause Playwright to silently attach to the wrong server — see the incident this
// config change fixed: reuseExistingServer treated another app's server on 4173 as this one's,
// and every spec then timed out against unrelated markup. Run e.g. `E2E_PORT=4174 npm run
// test:e2e` (PowerShell: `$env:E2E_PORT=4174; npm run test:e2e`) to pick a free port locally.
const E2E_PORT = process.env.E2E_PORT ?? '4173';
const E2E_HOST = '127.0.0.1';
const baseURL = `http://${E2E_HOST}:${E2E_PORT}`;

// v2-P3 A1: audit specs read `window.__editorStoreGetState` which is gated behind
// `import.meta.env.VITE_E2E` (see src/main.tsx). The default production build drops
// that branch. Set `PW_E2E_BUILD=1` to make Playwright build with VITE_E2E=1 before
// `vite preview`; use the default to run against the stock production bundle.
// `npm run test:e2e:audit` sets this automatically.
const useE2EBuild = process.env.PW_E2E_BUILD === '1';
const previewCommand = useE2EBuild
  ? `node scripts/build-e2e.mjs && npx vite preview --port ${E2E_PORT} --host ${E2E_HOST} --strictPort`
  : `npx vite preview --port ${E2E_PORT} --host ${E2E_HOST} --strictPort`;

export default defineConfig({
  testDir: './e2e',
  // Audit specs under e2e/audit/ are a read-only requirements-audit suite (see
  // docs/v2/requirements-audit.md). They are separated from core/CI by testIgnore here
  // and only run via the `audit` project (npm run test:e2e:audit).
  testIgnore: /audit[\\/]/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    // The onboarding overlay (see OnboardingOverlay.tsx) only appears on a visitor's first
    // visit and would otherwise block every other spec's interactions. Specs that specifically
    // exercise the overlay (e2e/onboarding.spec.ts) opt back into a fresh, empty storage state.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [{ name: 'signage-canvas.onboarding-dismissed', value: '1' }],
        },
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'audit',
      testDir: './e2e/audit',
      testMatch: /.*\.spec\.ts/,
      // The top-level `testIgnore` otherwise inherits into every project and would hide
      // the audit specs from this project as well. Explicitly clear it here so only this
      // project's testDir decides which specs to run.
      testIgnore: [],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // --strictPort makes Vite fail fast instead of silently shifting to the next free port when
    // E2E_PORT is already taken, so a port collision surfaces as a clear startup error rather
    // than Playwright's readiness check (a plain HTTP GET, which can't distinguish this app from
    // whatever else happens to answer) reusing a server that isn't this project's build.
    command: previewCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
