import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { createDexieLocalStore } from '@/data/dexie/DexieLocalStore.ts';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalRemote } from '@/data/http/HalRemote.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { isSharePath } from '@/data/http/publicShare.ts';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import App from './App.tsx';
import './i18n.ts';

// The Local Store (ADR 0020); to bring your own, see src/data/CLAUDE.md.
// A Share Link's page is opened by strangers: it writes nothing to their Local Store and has no
// Account, so it never opens IndexedDB or asks for a Session.
const shared = isSharePath(window.location.pathname);
const store = shared ? createMemoryLocalStore() : createDexieLocalStore();
// The server that serves the PWA is the server (ADR 0018); where none answers,
// `AccountProvider` says so and the app runs local-only.
const hal = createHalClient();
const accountService = shared ? null : createHalAccountService(hal);
const remote = shared ? null : createHalRemote(hal);

// Any `meta` read waits for the legacy migration, which must land before PreferencesProvider's
// first synchronous localStorage read. The timeout keeps a blocked IndexedDB (another tab on an
// older version) from blanking the app: losing the race costs default preferences for one render.
const ready = store.meta
  .get('storeReady')
  .catch((error) => console.error('Local Store not ready', error));
const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
void Promise.race([ready, timeout]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App store={store} accountService={accountService} remote={remote} />
    </StrictMode>
  );
});
