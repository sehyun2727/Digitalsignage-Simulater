import type { Page } from '@playwright/test';

/**
 * v2-S3 2-2 helper: open a top-level toolbar accordion section if it is currently closed.
 * The S3 refactor made every ToolbarSection a collapsible accordion (default state per
 * section lives in uiStore.accordionOpen) and hides the body when closed, which means
 * descendants are not in the DOM for tests to query. Use this helper from any e2e flow
 * that needs to interact with a non-default-open section.
 *
 * Known section IDs: 'space', 'add-signage', 'selected', 'content', 'appearance'. The
 * 'export' section is `always` open and has no toggle.
 */
// The 'export' section is pinned (always-mode) and has no toggle button, so a caller that
// mistakenly asks for it should not hang — treat waitFor timeouts as "toggle legitimately
// absent" and skip the click. For every other known section, the subsection toggle normally
// appears within one React re-render pass after its parent section's selection changes.
const WAIT_FOR_TOGGLE_MS = 2000;

export async function openSection(page: Page, id: string): Promise<void> {
  const toggle = page.getByTestId(`toolbar-section-${id}-toggle`);
  try {
    await toggle.waitFor({ state: 'attached', timeout: WAIT_FOR_TOGGLE_MS });
  } catch {
    return;
  }
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded !== 'true') await toggle.click();
}

/** Opens the inline sub-accordion (currently only `position-size`, which lives inside the
 *  Selected top-level section). The `id` argument matches the sub-accordion's TESTID key —
 *  the uiStore state key for this fold is prefixed with its parent (`selected-position-size`)
 *  but the testid intentionally omits that prefix so DOM queries read short names. */
export async function openSubsection(page: Page, id: string): Promise<void> {
  const toggle = page.getByTestId(`toolbar-subsection-${id}-toggle`);
  try {
    await toggle.waitFor({ state: 'attached', timeout: WAIT_FOR_TOGGLE_MS });
  } catch {
    return;
  }
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded !== 'true') await toggle.click();
}
