import { HullCta } from '../components/HullCta';
import { EditorErrorBoundary } from '../features/editor/EditorErrorBoundary';
import { EditorLayout } from '../features/editor/EditorLayout';
import { useLocale } from '../i18n/localeContext';
import { LocaleProvider } from '../i18n/LocaleProvider';

function AppShell() {
  const { messages } = useLocale();

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
        {/* title exposes the full disclaimer text on hover in case the compact single-line
         *  rendering ellipsizes it on narrow viewports. Text itself stays as-is (a legal
         *  requirement per CLAUDE.md §1) — only its layout footprint is compressed. */}
        <p className="disclaimer" title={messages.disclaimer}>
          {messages.disclaimer}
        </p>
      </footer>

      <HullCta />
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
