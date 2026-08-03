import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';
import { z } from 'zod';
import { db } from '@/db/db.ts';

/** Row key of the single preferences blob inside the `settings` store. */
export const PREFERENCES_KEY = 'preferences';

/**
 * Schema version of the stored blob. Bump it when a field changes shape in a
 * way defaults can't absorb, and handle the old shape in `parsePreferences`;
 * an unrecognised version is treated as unreadable and falls back to defaults.
 */
export const PREFERENCES_VERSION = 1;

export const preferencesSchema = z.object({
  version: z.literal(PREFERENCES_VERSION),
  /**
   * Editor toolbar buttons: membership = visible, position = order. Empty means
   * "never customised" and the toolbar renders its own default set - the button
   * registry lands with the customisable toolbar (M4 Slice 4), so freezing a
   * list of ids here would only give it something to drift from.
   */
  toolbar: z.array(z.string()).default([]),
  /** Which side the note-create button sits on. */
  noteButtonAlignment: z.enum(['left', 'right']).default('right'),
  /** Which capture shortcuts the mobile quick-capture bar shows, in order. */
  quickCaptureButtons: z.array(z.string()).default(['note', 'checklist']),
  /**
   * Colour-vision palette variant, applied on top of light/dark rather than
   * replacing it. One mode, not one per condition: deuteranopia and protanopia
   * are both red-green and differ marginally, so three palettes would be three
   * times the values to hand-tune and verify for a distinction two of them
   * barely make. The single palette is optimised against all three at once.
   *
   * The `.catch` is load-bearing. This field used to be an enum, and a stored
   * `'deuteranopia'` failing a bare boolean would reject the *whole* blob and
   * silently reset the user's toolbar, density and reduced-motion along with
   * it. Absorbing it at the field keeps the blast radius to this one setting.
   */
  colorBlind: z.boolean().catch(false).default(false),
  density: z.enum(['comfortable', 'compact']).default('comfortable'),
  /** `system` follows `prefers-reduced-motion`; the others override it. */
  reducedMotion: z.enum(['system', 'always', 'never']).default('system'),
  /** ISO timestamp of when the onboarding tour was completed or skipped. */
  onboardingSeenAt: z.string().optional(),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferenceKey = Exclude<keyof Preferences, 'version'>;

export const DEFAULT_PREFERENCES: Preferences = preferencesSchema.parse({
  version: PREFERENCES_VERSION,
});

/**
 * Preferences are cosmetic, so an unreadable blob must never block the app:
 * anything that fails the schema (corrupt, hand-edited, or written by a version
 * we don't know) yields defaults. The bad blob is deliberately left on disk -
 * the next `setPreference` replaces it, but a mere read never destroys data we
 * might want to inspect.
 */
export function parsePreferences(raw: unknown): Preferences {
  const parsed = preferencesSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
}

type PreferencesContextType = {
  preferences: Preferences;
  /** False until the stored blob has been read; `preferences` is defaults meanwhile. */
  hydrated: boolean;
  setPreference: <K extends PreferenceKey>(key: K, value: Preferences[K]) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

/**
 * User preferences, persisted as one Zod-validated blob in the Dexie `settings`
 * store (not localStorage: it is the same store M5 will sync, and it survives
 * the same backup/restore path as notes).
 *
 * Hydration is async, so children render against defaults first and re-render
 * once the blob lands - the same loading-tolerant contract as the note feed.
 * `hydrated` is there for the few consumers that must not act early (the
 * onboarding tour would otherwise flash before we know it was seen).
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  // `.get` returns undefined for a missing row, which useLiveQuery also returns
  // while loading; the wrapper object is what tells those two apart.
  const result = useLiveQuery(async () => ({ row: await db.settings.get(PREFERENCES_KEY) }), []);

  const preferences = useMemo(
    () => (result ? parsePreferences(result.row?.value) : DEFAULT_PREFERENCES),
    [result]
  );

  const setPreference = useCallback(async function setPreference<K extends PreferenceKey>(
    key: K,
    value: Preferences[K]
  ) {
    // Read-modify-write inside a transaction: the blob is a single row, so two
    // concurrent writes to different keys would otherwise lose one of them.
    await db.transaction('rw', db.settings, async () => {
      const row = await db.settings.get(PREFERENCES_KEY);
      const current = parsePreferences(row?.value);
      await db.settings.put({
        key: PREFERENCES_KEY,
        value: { ...current, version: PREFERENCES_VERSION, [key]: value },
      });
    });
  }, []);

  const value = useMemo(
    () => ({ preferences, hydrated: result !== undefined, setPreference }),
    [preferences, result, setPreference]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
