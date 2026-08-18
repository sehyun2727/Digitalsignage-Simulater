import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorErrorBoundary } from '../../src/features/editor/EditorErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

describe('EditorErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <EditorErrorBoundary title="title" description="description" reloadLabel="reload">
        <p>editor content</p>
      </EditorErrorBoundary>,
    );

    expect(screen.getByText('editor content')).toBeInTheDocument();
  });

  it('renders the fallback card instead of crashing when a child throws during render', () => {
    // React logs the caught error to the console by default; silence that expected noise so
    // the test output stays focused on the assertion.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <EditorErrorBoundary title="Something broke" description="Please reload" reloadLabel="Reload">
        <Bomb />
      </EditorErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something broke');
    expect(alert).toHaveTextContent('Please reload');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('reloads the page when the reload button is clicked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    const user = userEvent.setup();
    render(
      <EditorErrorBoundary title="Something broke" description="Please reload" reloadLabel="Reload">
        <Bomb />
      </EditorErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: 'Reload' }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
