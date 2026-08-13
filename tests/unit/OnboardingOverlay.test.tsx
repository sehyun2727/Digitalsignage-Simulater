import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { ja } from '../../src/i18n/locales/ja';
import { useUiStore } from '../../src/store/uiStore';

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

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockBrowserLocale(['fr-FR']);
    useUiStore.setState({ comparisonMode: false, onboardingDismissed: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the onboarding card on first visit', () => {
    render(<App />);
    expect(screen.getByRole('note', { name: ja.onboardingTitle })).toBeInTheDocument();
  });

  it('does not block the toolbar: sections stay reachable while the card is showing', () => {
    render(<App />);

    expect(screen.getByRole('note', { name: ja.onboardingTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ja.editorAddLedButton })).toBeInTheDocument();
  });

  it('the start button hides the card and persists the choice to localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: ja.onboardingStartButton }));

    expect(screen.queryByRole('note', { name: ja.onboardingTitle })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('signage-canvas.onboarding-dismissed')).toBe('1');
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
