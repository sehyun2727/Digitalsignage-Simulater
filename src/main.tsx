import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { useEditorStore } from './store/editorStore';
import { useUiStore } from './store/uiStore';
import './styles/global.css';

// v2-P3 A1: dev / e2e-only store accessor. The audit project needs `document.objects`,
// `past/future`, and `clipboard` without inferring from DOM. We gate the accessor on
// `import.meta.env.VITE_E2E` so **production builds** (`npm run build` and
// `npm run build:oitemiru`) tree-shake the branch — `scripts/check-prod-build.mjs`
// enforces 0 occurrences in dist/ and dist-oitemiru/.
//
// For audit tests use `npm run build:e2e` (sets `VITE_E2E=1`) before `vite preview`
// — the playwright `audit` project's webServer is wired to that build in
// `playwright.config.ts`.
if (import.meta.env.VITE_E2E && typeof window !== 'undefined') {
  const w = window as unknown as {
    __editorStoreGetState?: () => unknown;
    __uiStoreGetState?: () => unknown;
  };
  w.__editorStoreGetState = () => useEditorStore.getState();
  w.__uiStoreGetState = () => useUiStore.getState();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
