import { HullCta } from '../components/HullCta';
import { LanguageSelector } from '../components/LanguageSelector';
import { EditorLayout } from '../features/editor/EditorLayout';
import { useLocale } from '../i18n/localeContext';
import { LocaleProvider } from '../i18n/LocaleProvider';

function AppShell() {
  const { messages } = useLocale();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{messages.appTitle}</h1>
        <LanguageSelector />
      </header>

      <main className="app-main">
        <EditorLayout />
      </main>

      <footer className="app-footer">
        <p className="disclaimer">{messages.disclaimer}</p>
        <HullCta />
      </footer>
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
