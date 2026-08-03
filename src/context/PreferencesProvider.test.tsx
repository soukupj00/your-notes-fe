import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db.ts';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  PREFERENCES_VERSION,
  PreferencesProvider,
  usePreferences,
} from './PreferencesProvider.tsx';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

/** Render the hook and wait for the stored blob to arrive. */
async function prefs() {
  const { result } = renderHook(() => usePreferences(), { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  return result;
}

const store = (value: unknown) => db.settings.put({ key: PREFERENCES_KEY, value });
const stored = async () => (await db.settings.get(PREFERENCES_KEY))?.value;

afterEach(async () => {
  await db.settings.clear();
});

describe('defaults', () => {
  it('serves defaults when nothing is stored', async () => {
    const result = await prefs();
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('serves defaults before hydration finishes', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.hydrated).toBe(false);
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('fills missing fields of a partial blob with defaults', async () => {
    await store({ version: PREFERENCES_VERSION, density: 'compact' });

    const result = await prefs();

    expect(result.current.preferences.density).toBe('compact');
    expect(result.current.preferences.reducedMotion).toBe(DEFAULT_PREFERENCES.reducedMotion);
  });
});

describe('graceful fallback', () => {
  it.each([
    ['a corrupt blob', 'not-an-object'],
    ['an invalid field value', { version: PREFERENCES_VERSION, density: 'enormous' }],
    ['a blob from an unknown schema version', { version: 999, density: 'compact' }],
    ['a blob with no version at all', { density: 'compact' }],
  ])('falls back to defaults for %s', async (_label, value) => {
    await store(value);

    const result = await prefs();

    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('leaves the unreadable blob in place rather than overwriting it on read', async () => {
    await store('not-an-object');
    await prefs();
    expect(await stored()).toBe('not-an-object');
  });

  it('absorbs the old enum shape of colorBlind without resetting its neighbours', async () => {
    // `colorBlind` shipped as an enum before the single-mode decision. A stored
    // string must not take the whole blob down with it: falling back to
    // defaults here would silently wipe the user's toolbar and density too,
    // which is a far worse outcome than losing a setting nothing ever read.
    await store({
      version: PREFERENCES_VERSION,
      colorBlind: 'deuteranopia',
      density: 'compact',
      reducedMotion: 'always',
      toolbar: ['bold', 'italic'],
    });

    const result = await prefs();

    expect(result.current.preferences.colorBlind).toBe(false);
    expect(result.current.preferences.density).toBe('compact');
    expect(result.current.preferences.reducedMotion).toBe('always');
    expect(result.current.preferences.toolbar).toEqual(['bold', 'italic']);
  });
});

describe('setPreference', () => {
  it('round-trips a written value through Dexie', async () => {
    const result = await prefs();

    await result.current.setPreference('density', 'compact');

    await waitFor(() => expect(result.current.preferences.density).toBe('compact'));
    expect(await stored()).toEqual({ ...DEFAULT_PREFERENCES, density: 'compact' });
  });

  it('keeps previously written values when another key is set', async () => {
    const result = await prefs();

    await result.current.setPreference('noteButtonAlignment', 'left');
    await result.current.setPreference('reducedMotion', 'always');

    await waitFor(() => expect(result.current.preferences.reducedMotion).toBe('always'));
    expect(result.current.preferences.noteButtonAlignment).toBe('left');
  });

  it('writes over an unreadable blob instead of merging into it', async () => {
    await store('not-an-object');
    const result = await prefs();

    await result.current.setPreference('density', 'compact');

    expect(await stored()).toEqual({ ...DEFAULT_PREFERENCES, density: 'compact' });
  });

  it('stamps the current schema version on every write', async () => {
    const result = await prefs();

    await result.current.setPreference('onboardingSeenAt', '2026-07-25T00:00:00.000Z');

    const value = (await stored()) as { version: number };
    expect(value.version).toBe(PREFERENCES_VERSION);
  });
});

describe('usePreferences', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => usePreferences())).toThrow(/PreferencesProvider/);
  });
});
