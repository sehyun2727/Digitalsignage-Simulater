import { defineConfig, devices } from '@playwright/test';

// Overridable so a locally occupied default port (e.g. an unrelated project already bound to
// 4173) can't cause Playwright to silently attach to the wrong server — see the incident this
// config change fixed: reuseExistingServer treated another app's server on 4173 as this one's,
// and every spec then timed out against unrelated markup. Run e.g. `E2E_PORT=4174 npm run
// test:e2e` (PowerShell: `$env:E2E_PORT=4174; npm run test:e2e`) to pick a free port locally.
const E2E_PORT = process.env.E2E_PORT ?? '4173';
const E2E_HOST = '127.0.0.1';
const baseURL = `http://${E2E_HOST}:${E2E_PORT}`;

export default defineConfig({
  testDir: './e2e',
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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // --strictPort makes Vite fail fast instead of silently shifting to the next free port when
    // E2E_PORT is already taken, so a port collision surfaces as a clear startup error rather
    // than Playwright's readiness check (a plain HTTP GET, which can't distinguish this app from
    // whatever else happens to answer) reusing a server that isn't this project's build.
    command: `npx vite preview --port ${E2E_PORT} --host ${E2E_HOST} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60000,
  },
});
