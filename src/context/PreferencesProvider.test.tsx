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
      noteButtonAlignment: 'left',
    });

    const result = await prefs();

    expect(result.current.preferences.colorBlind).toBe(false);
    expect(result.current.preferences.density).toBe('compact');
    expect(result.current.preferences.reducedMotion).toBe('always');
    expect(result.current.preferences.noteButtonAlignment).toBe('left');
  });

  // The same absorber, for the same reason, on the field that changed shape
  // with the customisable toolbar: `toolbar` was a flat `string[]` of extension
  // names and `quickCaptureButtons` an array of keys that never matched the
  // actions. Both are now object shapes, and a stored copy of either must cost
  // only itself.
  it('absorbs the pre-registry toolbar and quick-capture shapes without resetting their neighbours', async () => {
    await store({
      version: PREFERENCES_VERSION,
      toolbar: ['bold', 'italic'],
      quickCaptureButtons: ['note', 'checklist'],
      density: 'compact',
      reducedMotion: 'always',
      colorBlind: true,
    });

    const result = await prefs();

    expect(result.current.preferences.toolbar).toEqual({ compact: [], wide: [] });
    expect(result.current.preferences.quickCapture).toEqual([]);
    expect(result.current.preferences.density).toBe('compact');
    expect(result.current.preferences.reducedMotion).toBe('always');
    expect(result.current.preferences.colorBlind).toBe(true);
  });

  it('absorbs one broken Width Class without taking the other down with it', async () => {
    await store({
      version: PREFERENCES_VERSION,
      toolbar: {
        compact: 'not a layout',
        wide: [{ id: 'format', on: true, collapsed: false, members: [{ id: 'bold', on: true }] }],
      },
    });

    const result = await prefs();

    expect(result.current.preferences.toolbar.compact).toEqual([]);
    expect(result.current.preferences.toolbar.wide).toHaveLength(1);
  });

  it('keeps a stored Layout naming ids this build does not know', async () => {
    // Forward compatibility is decision 8: a blob written by a later release
    // must round-trip, not be validated away.
    const layout = [
      {
        id: 'from-the-future',
        on: true,
        collapsed: true,
        members: [{ id: 'teleport', on: false }],
      },
    ];
    await store({ version: PREFERENCES_VERSION, toolbar: { compact: layout, wide: [] } });

    const result = await prefs();

    expect(result.current.preferences.toolbar.compact).toEqual(layout);
  });
});

describe('v1 → v2 migration (ADR 0013)', () => {
  it('opts a v1 blob into sinking without touching its other settings', async () => {
    // The whole reason a migration is needed rather than a changed default:
    // `setPreference` persists the entire parsed blob, so every existing user
    // already has `sinkCheckedItems: false` on disk and a new default would
    // reach none of them.
    await store({
      version: 1,
      sinkCheckedItems: false,
      density: 'compact',
      reducedMotion: 'always',
      colorBlind: true,
      noteButtonAlignment: 'left',
    });

    const result = await prefs();

    expect(result.current.preferences.sinkCheckedItems).toBe(true);
    expect(result.current.preferences.density).toBe('compact');
    expect(result.current.preferences.reducedMotion).toBe('always');
    expect(result.current.preferences.colorBlind).toBe(true);
    expect(result.current.preferences.noteButtonAlignment).toBe('left');
  });

  it('leaves a v2 blob that has opted out alone', async () => {
    await store({ version: 2, sinkCheckedItems: false });

    const result = await prefs();

    expect(result.current.preferences.sinkCheckedItems).toBe(false);
  });

  it('does not rewrite the stored blob on read', async () => {
    // The existing contract: a read never destroys data we might want to
    // inspect. The migration is therefore re-applied on every read until the
    // next `setPreference` persists version 2, which is why it is idempotent.
    const v1 = { version: 1, sinkCheckedItems: false, density: 'compact' };
    await store(v1);

    await prefs();

    expect(await stored()).toEqual(v1);
  });

  it('persists version 2 once any preference is written', async () => {
    await store({ version: 1, sinkCheckedItems: false, density: 'compact' });
    const result = await prefs();

    await result.current.setPreference('density', 'comfortable');

    const blob = (await stored()) as Record<string, unknown>;
    expect(blob.version).toBe(PREFERENCES_VERSION);
    expect(blob.sinkCheckedItems).toBe(true);
  });

  it('still rejects a version it has never heard of', async () => {
    await store({ version: 999, sinkCheckedItems: false, density: 'compact' });

    const result = await prefs();

    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('setPreference', () => {
  it('round-trips a written value through Dexie', async () => {
    const result = await prefs();

    await result.current.setPreference('density', 'compact');

    await waitFor(() => expect(result.current.preferences.density).toBe('compact'));
    expect(await stored()).toEqual({ ...DEFAULT_PREFERENCES, density: 'compact' });
  });

  it('writes a whole Toolbar Layout and reads it back unchanged', async () => {
    const result = await prefs();
    const wide = [
      {
        id: 'format',
        on: true,
        collapsed: false,
        members: [
          { id: 'bold', on: true },
          { id: 'italic', on: false },
        ],
      },
    ];

    // A Layout is written whole, not key by key: order and visibility travel in
    // one array precisely so there is no second list to keep in sync.
    await result.current.setPreference('toolbar', { compact: [], wide });

    await waitFor(() => expect(result.current.preferences.toolbar.wide).toEqual(wide));
    expect(await stored()).toEqual({ ...DEFAULT_PREFERENCES, toolbar: { compact: [], wide } });
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
