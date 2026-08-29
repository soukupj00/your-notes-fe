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

// Lets the one-shot legacy migration land before the first synchronous
// preferences read (src/data/dexie/legacyPreferences.ts). Renders regardless
// of whether it succeeded - IndexedDB refusing to open must not blank the app.
// Any key works: `meta` awaits the one-shot legacy migration before reading
// (src/data/dexie/legacyPreferences.ts), and that migration is what must land
// before PreferencesProvider's first synchronous localStorage read. The race
// is what keeps a blocked IndexedDB open (another tab holding an older
// version) from blanking the app: losing it degrades to default preferences
// for one render, never to no render.
const ready = store.meta
  .get('storeReady')
  .catch((error) => console.error('Local Store not ready', error));
const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
void Promise.race([ready, timeout]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>
  );
});
