import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { createDexieLocalStore } from '@/data/dexie/DexieLocalStore.ts';
import App from './App.tsx';
import './i18n.ts';

// The Local Store the app runs on (ADR 0020). Dexie/IndexedDB is the default
// and the only shipped implementation that persists; see src/data/CLAUDE.md
// for bringing your own.
const store = createDexieLocalStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>
);
