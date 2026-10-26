import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountStatus } from '@/context/AccountProvider.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { formatDate, MEDIUM_DATE_TIME, SHORT_TIME } from '@/lib/format.ts';
import { clearStore, withStore } from '@/test/store.tsx';
import DataSettingsPage from './data.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

const account = vi.hoisted(() => ({
  status: 'signed-in' as AccountStatus,
  lastSyncedAt: null as string | null,
}));
vi.mock('@/context/AccountProvider.tsx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/context/AccountProvider.tsx')>()),
  useAccount: () => ({ status: account.status, session: null, service: null }),
}));

vi.mock('@/context/SyncProvider.tsx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/context/SyncProvider.tsx')>()),
  useSync: () => ({
    active: account.status === 'signed-in',
    status: 'idle',
    lastSyncedAt: account.lastSyncedAt,
    pending: 0,
    syncNow: vi.fn(),
  }),
}));

beforeEach(() => {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { persisted: async () => false, estimate: async () => ({ usage: 16_000 }) },
  });
});

afterEach(async () => {
  Reflect.deleteProperty(navigator, 'storage');
  account.status = 'signed-in';
  account.lastSyncedAt = null;
  await clearStore();
});

function mount(status: AccountStatus) {
  account.status = status;
  return render(
    withStore(
      <PreferencesProvider>
        <DataSettingsPage />
      </PreferencesProvider>
    )
  );
}

const headings = async () =>
  (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);

describe('the data page', () => {
  it('signed in: Sync, This device and Backup, with Sync now and Keep every attachment', async () => {
    mount('signed-in');

    await screen.findByText(/^sync\.storage\.storedHere/);
    expect(await headings()).toEqual(['sync.label', 'sync.storage.title', 'settings.backup.title']);
    expect(screen.getByRole('button', { name: 'sync.syncNow' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'sync.keepEverything.label' })).toBeInTheDocument();
    expect(screen.getByText('sync.keepEverything.description')).toBeInTheDocument();
    expect(screen.queryByText('settings.backup.localFootnote')).toBeNull();
  });

  it.each<AccountStatus>(['unavailable', 'signed-out'])(
    'with no account (%s): no Sync, and a footnote that a backup is the only other copy',
    async (status) => {
      mount(status);

      await screen.findByText(/^sync\.storage\.storedHere/);
      expect(await headings()).toEqual(['sync.storage.title', 'settings.backup.title']);
      expect(screen.getByText('settings.backup.localFootnote')).toBeInTheDocument();
    }
  );

  it('says how much this device stores and that the browser may clear it', async () => {
    mount('unavailable');

    expect(await screen.findByText('sync.storage.storedHere 16 kB')).toBeInTheDocument();
    expect(screen.getByText('sync.storage.notPersisted')).toBeInTheDocument();
  });

  // A time alone reads as today's, and is what fits a phone in Czech.
  it.each([
    ['today', 0, (at: string) => `sync.syncedAt ${formatDate(at, 'en', SHORT_TIME)}`],
    ['before today', 1, (at: string) => `sync.idle ${formatDate(at, 'en', MEDIUM_DATE_TIME)}`],
  ])('names a last sync %s by its time or its date', async (_name, daysAgo, expected) => {
    const at = new Date();
    at.setDate(at.getDate() - daysAgo);
    account.lastSyncedAt = at.toISOString();
    mount('signed-in');

    expect(await screen.findByText(expected(account.lastSyncedAt))).toBeInTheDocument();
  });
});
