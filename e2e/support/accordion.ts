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
export async function openSection(page: Page, id: string): Promise<void> {
  const toggle = page.getByTestId(`toolbar-section-${id}-toggle`);
  if ((await toggle.count()) === 0) return;
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded !== 'true') await toggle.click();
}

/** Opens the inline sub-accordion (currently only `selected-position-size`). */
export async function openSubsection(page: Page, id: string): Promise<void> {
  const toggle = page.getByTestId(`toolbar-subsection-${id}-toggle`);
  if ((await toggle.count()) === 0) return;
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded !== 'true') await toggle.click();
}
