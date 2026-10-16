// v2-P3 A1: build the editor with the dev/e2e store accessor enabled.
//
// The audit project needs the window.__editorStoreGetState / __uiStoreGetState
// backdoor (see src/main.tsx). Setting VITE_E2E=1 at build time keeps the branch in
// the bundle; the default `npm run build` leaves it tree-shaken so prod artifacts
// stay clean (verified by scripts/check-prod-build.mjs).
//
// Usage: `npm run build:e2e`. Outputs the same `dist/` as `npm run build` and is
// consumed by the Playwright audit project's `vite preview` webServer.

import { spawn } from 'node:child_process';

const child = spawn('npx', ['tsc', '-b'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
child.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const build = spawn('npx', ['vite', 'build'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VITE_E2E: '1' },
  });
  build.on('exit', (c) => process.exit(c ?? 0));
});
