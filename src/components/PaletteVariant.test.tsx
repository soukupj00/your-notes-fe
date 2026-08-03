import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PREFERENCES_KEY,
  PREFERENCES_VERSION,
  PreferencesProvider,
} from '@/context/PreferencesProvider.tsx';
import { db } from '@/db/db.ts';
import { COLOR_BLIND_CLASS, PaletteVariant } from './PaletteVariant.tsx';

const store = (value: unknown) => db.settings.put({ key: PREFERENCES_KEY, value });

afterEach(async () => {
  document.documentElement.classList.remove(COLOR_BLIND_CLASS, 'dark');
  await db.settings.clear();
});

function mount() {
  return render(
    <PreferencesProvider>
      <PaletteVariant />
    </PreferencesProvider>
  );
}

describe('PaletteVariant', () => {
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
    rerender(
      <PreferencesProvider>
        <PaletteVariant />
      </PreferencesProvider>
    );

    await waitFor(() =>
      expect(document.documentElement.classList.contains(COLOR_BLIND_CLASS)).toBe(false)
    );
  });
});
