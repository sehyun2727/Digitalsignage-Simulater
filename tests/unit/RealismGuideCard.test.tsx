import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { ja } from '../../src/i18n/locales/ja';
import { useEditorStore } from '../../src/store/editorStore';
import { useUiStore } from '../../src/store/uiStore';
import { createEmptyDocument } from '../../src/types/editor';

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

describe('RealismGuideCard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockBrowserLocale(['fr-FR']);
    useUiStore.setState({
      comparisonMode: false,
      onboardingDismissed: true,
      realismGuideDismissed: false,
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

    expect(screen.queryByRole('note', { name: ja.realismGuideTitle })).not.toBeInTheDocument();
  });

  it('is shown once a display is selected', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

    expect(screen.getByRole('note', { name: ja.realismGuideTitle })).toBeInTheDocument();
  });

  it('is not shown for a selected element with no appearance settings (e.g. text)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    await user.click(screen.getByRole('button', { name: ja.editorAddTextButton }));

    expect(screen.queryByRole('note', { name: ja.realismGuideTitle })).not.toBeInTheDocument();
  });

  it('the dismiss button hides the card and persists the choice to localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

    await user.click(screen.getByRole('button', { name: ja.realismGuideDismissButton }));

    expect(screen.queryByRole('note', { name: ja.realismGuideTitle })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('signage-canvas.realism-guide-dismissed')).toBe('1');
  });

  it('does not reappear on a later selection once dismissed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
    await user.click(screen.getByRole('button', { name: ja.realismGuideDismissButton }));

    await user.click(screen.getByRole('button', { name: ja.editorAddLcdButton }));

    expect(screen.queryByRole('note', { name: ja.realismGuideTitle })).not.toBeInTheDocument();
  });

  it('does not show when the guide was already dismissed in a previous session', async () => {
    useUiStore.setState({ realismGuideDismissed: true });
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

    expect(screen.queryByRole('note', { name: ja.realismGuideTitle })).not.toBeInTheDocument();
  });
});
