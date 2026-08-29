import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { TourProvider, useTourActive } from '@/context/TourProvider.tsx';
import { PREFERENCES_STORAGE_KEY } from '@/data/dexie/legacyPreferences.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { clearStore, renderHookWithStore, testStore, withStore } from '@/test/store.tsx';

/**
 * What is answerable about the provider *without* a browser.
 *
 * Not much, and deliberately so. jsdom applies no CSS and measures every element
 * as 0x0, so `resolveTourTarget` finds nothing, the spotlight has no rect to cut
 * and no step can be shown at all - which is why the Tour's own behaviour is
 * `e2e/onboarding.spec.ts`, at two real viewports. Everything decidable without
 * a rect was moved to `src/lib/tour/` and is tested there.
 *
 * What is left here is the pair of promises the rest of the app leans on: that
 * the startup sweep clears up after a run nobody finished, and that a component
 * asking whether the Tour is running gets an answer even where there is no Tour.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ state: { location: { pathname: '/' } }, history: { back: vi.fn() } }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { href: 'http://localhost/' } }),
}));

/** A finished-with profile: the Tour has been offered, so none is due. */
function storePreferences(overrides: Record<string, unknown>) {
  localStorage.setItem(
    PREFERENCES_STORAGE_KEY,
    JSON.stringify({
      ...DEFAULT_PREFERENCES,
      onboardingSeenAt: '2026-08-09T10:00:00.000Z',
      ...overrides,
    })
  );
}

afterEach(async () => {
  localStorage.clear();
  await clearStore();
});

function Probe() {
  return <span data-testid="active">{String(useTourActive())}</span>;
}

describe('the abandoned-run sweep', () => {
  it('purges the Props a previous run left behind, and forgets them', async () => {
    // A reload mid-Tour ends it with no teardown, and `onboardingSeenAt` is
    // already stamped - so there will never be another Tour start to clean up
    // from. The sweep has to happen on the next *load*.
    const { createNote } = renderHookWithStore(() => useNoteActions()).result.current;
    const abandoned = await createNote({ header: 'Ideas' });
    await testStore.meta.set('tourProps', [{ id: abandoned.id, updatedAt: abandoned.updatedAt }]);
    storePreferences({});

    render(
      withStore(
        <PreferencesProvider>
          <TourProvider>
            <Probe />
          </TourProvider>
        </PreferencesProvider>
      )
    );

    await waitFor(async () => expect(await testStore.notes.list()).toHaveLength(0));
    await waitFor(async () => {
      expect(await testStore.meta.get('tourProps')).toEqual([]);
    });
  });

  it('leaves a Prop the user made their own', async () => {
    const { createNote } = renderHookWithStore(() => useNoteActions()).result.current;
    const kept = await createNote({ header: 'Ideas' });
    // A baseline the note no longer matches is the whole definition of "edited".
    await testStore.meta.set('tourProps', [{ id: kept.id, updatedAt: 'before the user typed' }]);
    storePreferences({});

    render(
      withStore(
        <PreferencesProvider>
          <TourProvider>
            <Probe />
          </TourProvider>
        </PreferencesProvider>
      )
    );

    await waitFor(async () => {
      expect(await testStore.meta.get('tourProps')).toEqual([]);
    });
    await expect(testStore.notes.get(kept.id)).resolves.toBeDefined();
  });
});

describe('useTourActive', () => {
  it('answers false where there is no provider at all', () => {
    // `searchInput` asks on every render and is mounted on its own in half a
    // dozen tests: "no provider" and "no Tour" mean the same thing to a caller
    // that only wants to know whether to stand down.
    render(<Probe />);

    expect(screen.getByTestId('active')).toHaveTextContent('false');
  });
});
