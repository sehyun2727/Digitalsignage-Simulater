import { Component, type ReactNode } from 'react';

interface EditorErrorBoundaryProps {
  children: ReactNode;
  title: string;
  description: string;
  reloadLabel: string;
}

interface EditorErrorBoundaryState {
  hasError: boolean;
}

/**
 * A last-resort fallback for an unexpected render crash inside the editor tree (e.g. a
 * malformed document object reaching a component that doesn't defensively guard against it),
 * so the user sees a recoverable message instead of a blank white page. React error boundaries
 * must be class components — there is no hook equivalent. Deliberately does not log the caught
 * error anywhere: this project has no logging/telemetry infrastructure, and an error's message
 * could incidentally include a blob: object URL (CLAUDE.md §8 bars logging those).
 */
export class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): EditorErrorBoundaryState {
    return { hasError: true };
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="editor-crash-card" role="alert">
          <h2>{this.props.title}</h2>
          <p>{this.props.description}</p>
          <button type="button" onClick={this.handleReload}>
            {this.props.reloadLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
