import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { ja } from '../../src/i18n/locales/ja';

function mockBrowserLocale(languages: string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(languages[0] ?? 'ja');
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Force a deterministic Japanese default regardless of the test runner's locale.
    mockBrowserLocale(['fr-FR']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Sprint 0 shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Digital Signage Simulator' })).toBeInTheDocument();
    expect(screen.getByText('Sprint 0')).toBeInTheDocument();
  });

  it('defaults to Japanese', () => {
    render(<App />);

    expect(document.documentElement.lang).toBe('ja');
    expect(screen.getByText(ja.disclaimer)).toBeInTheDocument();
  });

  it('shows the independent-service disclaimer', () => {
    render(<App />);

    expect(screen.getByText(ja.disclaimer)).toBeInTheDocument();
  });

  it('links the HULL CTA to the approved contact URL as a safe external link', () => {
    render(<App />);

    const link = screen.getByRole('link', { name: ja.hullCtaLabel });
    expect(link).toHaveAttribute('href', 'https://hull-inc.jp/contact');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(ja.hullCtaExternalNotice)).toBeInTheDocument();
  });

  it('switches the UI to Korean', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByRole('combobox'), 'ko');

    expect(document.documentElement.lang).toBe('ko');
    expect(screen.getByRole('heading', { name: 'Digital Signage Simulator' })).toBeInTheDocument();
  });

  it('switches the UI to English', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByRole('combobox'), 'en');

    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('link', { name: 'Contact HULL' })).toBeInTheDocument();
  });

  it('persists the selected locale across remounts', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.selectOptions(screen.getByRole('combobox'), 'ko');
    expect(window.localStorage.getItem('signage-canvas.locale')).toBe('ko');
    unmount();

    render(<App />);
    expect(document.documentElement.lang).toBe('ko');
  });
});
