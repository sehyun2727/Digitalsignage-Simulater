import { useState } from 'react';
import { HullCta } from '../components/HullCta';
import { UserGuideModal } from '../components/UserGuideModal';
import { EditorErrorBoundary } from '../features/editor/EditorErrorBoundary';
import { EditorLayout } from '../features/editor/EditorLayout';
import { useLocale } from '../i18n/localeContext';
import { LocaleProvider } from '../i18n/LocaleProvider';

function AppShell() {
  const { messages } = useLocale();
  const [userGuideOpen, setUserGuideOpen] = useState(false);

  return (
    <div className="app-shell">
      <main className="app-main">
        <EditorErrorBoundary
          title={messages.editorCrashTitle}
          description={messages.editorCrashDescription}
          reloadLabel={messages.editorCrashReloadButton}
        >
          <EditorLayout />
        </EditorErrorBoundary>
      </main>

      <footer className="app-footer">
        {/* The independent-service disclaimer (CLAUDE.md §1) now lives inside the user guide
         *  modal opened by this link, alongside the browser-local privacy notes and basic
         *  usage steps, instead of taking a persistent line of below-canvas height. */}
        <button
          type="button"
          className="user-guide-open-button"
          onClick={() => setUserGuideOpen(true)}
          aria-label={messages.userGuideOpenButton}
          title={messages.userGuideOpenButton}
        >
          <span aria-hidden="true">📖</span>
        </button>
        <span className="user-guide-here-hint" aria-hidden="true">
          {messages.userGuideHereHint}
        </span>
      </footer>

      <HullCta />

      {userGuideOpen && <UserGuideModal onClose={() => setUserGuideOpen(false)} />}
    </div>
  );
}

export function App() {
  return (
    <LocaleProvider>
      <AppShell />
    </LocaleProvider>
  );
}
