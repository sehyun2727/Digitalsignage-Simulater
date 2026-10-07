// v2-S3 Step A-2: file-based filter for test:e2e:core. The previous `--grep-invert`
// variant relied on every visual-qa test living inside a `describe("golden-image …")`
// block, which breaks silently the moment a new describe is added. This script lists
// every `e2e/*.spec.ts` except `visual-qa.spec.ts` and passes them to Playwright
// explicitly — so adding/renaming describes inside visual-qa cannot change which specs
// the S3+ core suite reads.
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const dir = 'e2e';
const specs = readdirSync(dir)
  .filter((f) => f.endsWith('.spec.ts') && f !== 'visual-qa.spec.ts')
  .map((f) => `${dir}/${f}`);

const extra = process.argv.slice(2);
const child = spawn('npx', ['playwright', 'test', ...specs, ...extra], {
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
