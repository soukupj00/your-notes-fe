import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_VERSION,
  PreferencesProvider,
} from '@/context/PreferencesProvider.tsx';
import { COLOR_BLIND_CLASS, DocumentPreferences } from './DocumentPreferences.tsx';

// `PreferencesProvider` only re-reads on a `storage` event (another tab's
// write) or `setPreference` (its own). A same-tab write from outside React -
// what this suite does to force a value into an already-mounted provider -
// has to fire that event itself to be picked up.
const store = (value: unknown) => {
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new StorageEvent('storage', { key: PREFERENCES_STORAGE_KEY }));
};

afterEach(() => {
  document.documentElement.classList.remove(COLOR_BLIND_CLASS, 'dark');
  document.documentElement.removeAttribute('data-density');
  document.documentElement.removeAttribute('data-reduced-motion');
  document.documentElement.removeAttribute('data-sink-checked');
  localStorage.clear();
});

function tree() {
  return (
    <PreferencesProvider>
      <DocumentPreferences />
    </PreferencesProvider>
  );
}

function mount() {
  return render(tree());
}

describe('DocumentPreferences', () => {
  describe('colour-blind palette', () => {
    it('leaves the root unmarked when the preference is off', async () => {
      mount();
      await waitFor(() =>
        expect(document.documentElement.classList.contains(COLOR_BLIND_CLASS)).toBe(false)
      );
    });

    it('marks the root once the stored preference hydrates', async () => {
      await store({ version: PREFERENCES_VERSION, colorBlind: true });

      mount();

      await waitFor(() =>
        expect(document.documentElement.classList.contains(COLOR_BLIND_CLASS)).toBe(true)
      );
    });

    it('composes with the theme class rather than replacing it', async () => {
      // The whole reason this is a modifier and not a third theme: a colour-blind
      // user must still be able to choose a dark room. `globals.css` selects on
      // `.dark.cvd`, so both classes have to survive together.
      document.documentElement.classList.add('dark');
      await store({ version: PREFERENCES_VERSION, colorBlind: true });

      mount();

      await waitFor(() =>
        expect(document.documentElement.classList.contains(COLOR_BLIND_CLASS)).toBe(true)
      );
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes the mark when the preference is turned back off', async () => {
      await store({ version: PREFERENCES_VERSION, colorBlind: true });
      const { rerender } = mount();
      await waitFor(() =>
        expect(document.documentElement.classList.contains(COLOR_BLIND_CLASS)).toBe(true)
      );

      await store({ version: PREFERENCES_VERSION, colorBlind: false });
      rerender(tree());

      await waitFor(() =>
        expect(document.documentElement.classList.contains(COLOR_BLIND_CLASS)).toBe(false)
      );
    });
  });

  describe('density', () => {
    it('stamps the comfortable default', async () => {
      mount();
      await waitFor(() => expect(document.documentElement.dataset.density).toBe('comfortable'));
    });

    it('stamps compact once the stored preference hydrates', async () => {
      await store({ version: PREFERENCES_VERSION, density: 'compact' });

      mount();

      await waitFor(() => expect(document.documentElement.dataset.density).toBe('compact'));
    });

    it('returns to comfortable when the preference changes back', async () => {
      await store({ version: PREFERENCES_VERSION, density: 'compact' });
      const { rerender } = mount();
      await waitFor(() => expect(document.documentElement.dataset.density).toBe('compact'));

      await store({ version: PREFERENCES_VERSION, density: 'comfortable' });
      rerender(tree());

      await waitFor(() => expect(document.documentElement.dataset.density).toBe('comfortable'));
    });
  });

  describe('reduced motion', () => {
    // `system` is stamped rather than left absent because CSS has to tell it
    // apart from `never`: one falls through to the OS query, the other overrules
    // it. An absent attribute cannot stand for both.
    it('stamps the system default rather than leaving the attribute off', async () => {
      mount();
      await waitFor(() => expect(document.documentElement.dataset.reducedMotion).toBe('system'));
    });

    it.each(['always', 'never'] as const)('stamps the explicit %s override', async (value) => {
      await store({ version: PREFERENCES_VERSION, reducedMotion: value });

      mount();

      await waitFor(() => expect(document.documentElement.dataset.reducedMotion).toBe(value));
    });
  });

  describe('checklist sinking', () => {
    // The only switch the sinking rules have (ADR 0013): they are pure CSS, so
    // without this attribute the preference cannot reach them at all.
    it('stamps the on-by-default preference', async () => {
      mount();
      await waitFor(() =>
        expect(document.documentElement.hasAttribute('data-sink-checked')).toBe(true)
      );
    });

    it('removes the attribute when the preference is turned off', async () => {
      const { rerender } = mount();
      await waitFor(() =>
        expect(document.documentElement.hasAttribute('data-sink-checked')).toBe(true)
      );

      await store({ version: PREFERENCES_VERSION, sinkCheckedItems: false });
      rerender(tree());

      await waitFor(() =>
        expect(document.documentElement.hasAttribute('data-sink-checked')).toBe(false)
      );
    });
  });

  it('stamps every preference from one pass, so none can be left behind', async () => {
    await store({
      version: PREFERENCES_VERSION,
      colorBlind: true,
      density: 'compact',
      reducedMotion: 'always',
      sinkCheckedItems: false,
    });

    mount();

    await waitFor(() => {
      expect(document.documentElement.classList.contains(COLOR_BLIND_CLASS)).toBe(true);
      expect(document.documentElement.dataset.density).toBe('compact');
      expect(document.documentElement.dataset.reducedMotion).toBe('always');
      expect(document.documentElement.hasAttribute('data-sink-checked')).toBe(false);
    });
  });
});
