import { HullCta } from '../components/HullCta';
import { UserGuideModal } from '../components/UserGuideModal';
import { EditorErrorBoundary } from '../features/editor/EditorErrorBoundary';
import { EditorLayout } from '../features/editor/EditorLayout';
import { useLocale } from '../i18n/localeContext';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { useUiStore } from '../store/uiStore';

function AppShell() {
  const { messages } = useLocale();
  // v2-S3 2-6: UserGuide open state lifted into uiStore so the header 「使い方ガイド」 button
  // (EditorLayout) and the footer 📖 button share one source of truth. The old
  // `userGuideHereHint` 「← マニュアルはこちら」 inline label is removed — the header entry
  // is now always visible, which was the whole point of 2-6.
  const userGuideOpen = useUiStore((state) => state.userGuideOpen);
  const setUserGuideOpen = useUiStore((state) => state.setUserGuideOpen);

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
          data-testid="editor-footer-user-guide"
          onClick={() => setUserGuideOpen(true)}
          aria-label={messages.userGuideOpenButton}
          title={messages.userGuideOpenButton}
        >
          <span aria-hidden="true">📖</span>
        </button>
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
