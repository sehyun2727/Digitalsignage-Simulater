import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { ja } from '../../src/i18n/locales/ja';
import { useEditorStore } from '../../src/store/editorStore';
import { useUiStore } from '../../src/store/uiStore';
import { createEmptyDocument } from '../../src/types/editor';

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

vi.mock('../../src/features/editor/EditorCanvas', () => ({
  EditorCanvas: forwardRef(function MockEditorCanvas(_props, ref) {
    useImperativeHandle(ref, () => ({ exportToDataUrl: () => null }));
    return <div data-testid="mock-editor-canvas" />;
  }),
}));

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

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockBrowserLocale(['fr-FR']);
    useUiStore.setState({ comparisonMode: false, onboardingDismissed: false });
    useEditorStore.setState({
      document: createEmptyDocument(),
      selectedId: null,
      past: [],
      future: [],
    });
    // jsdom does not implement scrollIntoView; focusToolbarTrigger calls it before focus().
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the onboarding card on first visit at step 1', () => {
    render(<App />);

    expect(screen.getByRole('note', { name: ja.onboardingTitle })).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    expect(screen.getByText(ja.onboardingStep1Title)).toBeInTheDocument();
  });

  it('does not block the toolbar: sections stay reachable while the card is showing', () => {
    render(<App />);

    expect(screen.getByRole('note', { name: ja.onboardingTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ja.editorAddLedButton })).toBeInTheDocument();
  });

  it('step 1 CTA focuses the existing space photo upload control instead of duplicating it', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: ja.onboardingStep1CtaLabel }));

    expect(screen.getByRole('button', { name: ja.editorAddSpaceBackgroundButton })).toHaveFocus();
  });

  it('advances to step 2 once a space photo exists, and its CTA focuses the existing add-signage control instead of forcing an LED choice', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    expect(screen.getByText('2 / 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: ja.onboardingStep2CtaLabel }));

    expect(screen.getByRole('button', { name: ja.editorAddLedButton })).toHaveFocus();
    expect(
      useEditorStore.getState().document.objects.some((object) => object.kind === 'display'),
    ).toBe(false);
  });

  it('advances to step 3 once signage exists, and its CTA focuses the existing content upload control', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    act(() => {
      useEditorStore.getState().addDisplay('led');
    });

    expect(screen.getByText('3 / 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: ja.onboardingStep3CtaLabel }));

    expect(screen.getByRole('button', { name: ja.editorContentUploadButton })).toHaveFocus();
  });

  it('advances to step 4 once content exists, and its CTA reuses the existing PNG export handler', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    act(() => {
      useEditorStore.getState().addDisplay('led');
      useEditorStore.setState((state) => ({
        document: {
          ...state.document,
          objects: state.document.objects.map((object) =>
            object.id === state.selectedId
              ? {
                  ...object,
                  content: {
                    kind: 'image' as const,
                    sourceId: 'test-source',
                    fit: 'contain' as const,
                    offsetX: 0,
                    offsetY: 0,
                    scale: 1,
                  },
                }
              : object,
          ),
        },
      }));
    });

    expect(screen.getByText('4 / 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: ja.onboardingStep4CtaLabel }));

    // The mocked canvas cannot actually export in jsdom, so the reused handler falls into its
    // existing failure path — confirming the same handler ran, not a duplicated export path.
    expect(await screen.findByText(ja.editorExportErrorAnnouncement)).toBeInTheDocument();
  });

  it('the dismiss button hides the card and persists the choice to localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: ja.onboardingDismissButton }));

    expect(screen.queryByRole('note', { name: ja.onboardingTitle })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('signage-canvas.onboarding-dismissed')).toBe('1');
  });

  it('does not show the card when onboarding was already dismissed', () => {
    useUiStore.setState({ onboardingDismissed: true });
    render(<App />);

    expect(screen.queryByRole('note', { name: ja.onboardingTitle })).not.toBeInTheDocument();
  });
});
