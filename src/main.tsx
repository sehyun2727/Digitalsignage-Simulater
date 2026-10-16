import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { useEditorStore } from './store/editorStore';
import { useUiStore } from './store/uiStore';
import './styles/global.css';

// v2-P2: dev/e2e-only backdoor. Audit tests need to read the editor document (deep
// field compare, clamp coords, independent-edit measurement) without inferring from
// DOM. The accessor is a function so bundlers don't tree-shake the stores; it only
// returns a getState handle, so no mutable state leaks beyond what the UI already
// exposes. Scoped to `window.__editorStoreGetState` / `__uiStoreGetState` to make
// the dev origin obvious. Production bundles still carry it — it is a read-only
// handle on an already-public store, and gating by `import.meta.env.MODE` would
// break the audit project that runs `vite preview` on `npm run build` output.
if (typeof window !== 'undefined') {
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
