// v2-P3 A1: run the Playwright `audit` project against a build that has the e2e
// store accessor enabled (VITE_E2E=1). Sets PW_E2E_BUILD=1 so playwright.config.ts
// kicks off `node scripts/build-e2e.mjs` from inside the webServer command, and
// forwards any extra CLI args (e.g. `-g 1-1-c`).

import { spawn } from 'node:child_process';

const extra = process.argv.slice(2);
const child = spawn('npx', ['playwright', 'test', '--project=audit', ...extra], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PW_E2E_BUILD: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
