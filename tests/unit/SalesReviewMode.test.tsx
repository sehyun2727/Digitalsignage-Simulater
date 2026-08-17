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

describe('sales review mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockBrowserLocale(['fr-FR']);
    useUiStore.setState({
      comparisonMode: false,
      salesReviewMode: false,
      onboardingDismissed: true,
      realismGuideDismissed: true,
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

  it('hides the toolbar and shows a hint once entered', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

    await user.click(screen.getByRole('button', { name: ja.salesReviewEnterButton }));

    expect(screen.queryByRole('button', { name: ja.editorAddLedButton })).not.toBeInTheDocument();
    expect(screen.getByText(ja.salesReviewModeHint)).toBeInTheDocument();
  });

  it('hides undo/redo but keeps export reachable', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    await user.click(screen.getByRole('button', { name: ja.salesReviewEnterButton }));

    expect(screen.queryByRole('button', { name: ja.editorUndoButton })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ja.editorRedoButton })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: ja.editorExportButton })).toBeInTheDocument();
  });

  it('clears the current selection on entry', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
    expect(useEditorStore.getState().selectedId).not.toBeNull();

    await user.click(screen.getByRole('button', { name: ja.salesReviewEnterButton }));

    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  it('the exit button restores the toolbar and editing controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.salesReviewEnterButton }));

    await user.click(screen.getByRole('button', { name: ja.salesReviewExitButton }));

    expect(screen.getByRole('button', { name: ja.editorAddLedButton })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ja.editorUndoButton })).toBeInTheDocument();
    expect(screen.queryByText(ja.salesReviewModeHint)).not.toBeInTheDocument();
  });
});
