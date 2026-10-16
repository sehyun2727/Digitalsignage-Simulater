import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { ja } from '../../src/i18n/locales/ja';
import { useEditorStore } from '../../src/store/editorStore';
import { useUiStore } from '../../src/store/uiStore';
import { createEmptyDocument } from '../../src/types/editor';

// v2-S3 2-3 rewrite: the dismissable one-time card is now a stable, collapsible description
// block at the top of the Appearance section. These tests cover the current behavior —
// visibility is driven by what's selected (not localStorage), and the only state is a
// session-only expand/collapse toggle inside the component itself.

vi.mock('../../src/features/editor/EditorCanvas', () => ({
  EditorCanvas: forwardRef(function MockEditorCanvas(_props, ref) {
    useImperativeHandle(ref, () => ({ exportToDataUrl: () => null }));
    return <div data-testid="mock-editor-canvas" />;
  }),
}));

class SucceedingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function createImageFile(name = 'photo.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

function mockBrowserLocale(languages: string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(languages[0] ?? 'ja');
}

async function addSpaceBackground(user: ReturnType<typeof userEvent.setup>) {
  vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
  await user.upload(
    screen.getByLabelText(ja.editorAddSpaceBackgroundButton),
    createImageFile('space.png'),
  );
  await screen.findByRole('button', { name: ja.editorRemoveSpaceBackgroundButton });
}

describe('RealismGuideCard (v2-S3 collapsible appearance guide)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockBrowserLocale(['fr-FR']);
    useUiStore.setState({
      comparisonMode: false,
      onboardingDismissed: true,
      errors: {},
      requestSequence: { 'space-photo': 0, content: 0, export: 0 },
      // v2-S3: force Appearance section open so this spec can measure the inline guide
      // without first having to click the parent accordion toggle (that behaviour is
      // covered in e2e/v2-layout L7 "default open sections only include ...").
      accordionOpen: {
        space: true,
        'add-signage': true,
        selected: null,
        content: null,
        appearance: true,
      },
      subAccordionOpen: { 'selected-position-size': false },
    });
    useEditorStore.setState({
      document: createEmptyDocument(),
      selectedId: null,
      past: [],
      future: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is not shown before any object is selected', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    expect(screen.queryByText(ja.realismGuideTitle)).not.toBeInTheDocument();
  });

  it('is shown once a display is selected and the body stays open by default', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

    const toggle = screen.getByTestId('appearance-guide-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(ja.realismGuideStepPreset)).toBeInTheDocument();
    expect(screen.getByText(ja.realismGuideStepOcclusion)).toBeInTheDocument();
  });

  it('collapses when the toggle is clicked and expands again on the next click', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

    const toggle = screen.getByTestId('appearance-guide-toggle');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(ja.realismGuideStepPreset)).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(ja.realismGuideStepPreset)).toBeInTheDocument();
  });
});
