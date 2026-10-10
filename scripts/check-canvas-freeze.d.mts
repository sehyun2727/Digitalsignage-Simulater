// Ambient types for the plain .mjs CLI module. The script itself has no runtime types (it's
// a one-file node tool, not a published package); this shim gives in-repo consumers like
// `tests/unit/checkCanvasFreeze.test.ts` a signature for runCheck() so tsc stays strict.
export function runCheck(options?: {
  root?: string;
  scanRoots?: readonly string[];
}): Promise<{ ok: boolean; errors: string[]; zonesChecked: number }>;
export const CHECK_CANVAS_FROZEN_CLASSES: readonly string[];
export function collectCssSelectorHits(options: {
  root?: string;
  scanRoots?: readonly string[];
  classes?: readonly string[];
}): Promise<Array<{ file: string; line: number; selector: string }>>;
