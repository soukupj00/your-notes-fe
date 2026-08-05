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

/** One leaf inside a stored family: array position is its order on the bar. */
const toolbarMemberSchema = z.object({ id: z.string(), on: z.boolean() });

/**
 * One family. `id` and the member ids are plain strings, not the registry's
 * unions: a blob written by a later release may name Items this build has never
 * heard of, and those must survive a round-trip rather than fail validation
 * (ADR 0011, decision 8).
 */
const toolbarFamilySchema = z.object({
  id: z.string(),
  on: z.boolean(),
  collapsed: z.boolean(),
  members: z.array(toolbarMemberSchema),
});

const toolbarLayoutSchema = z.array(toolbarFamilySchema);

export const preferencesSchema = z.object({
  version: z.literal(PREFERENCES_VERSION),
  /**
   * The editor toolbar, one Toolbar Layout per Width Class (ADR 0011). An empty
   * array means "never customised" and the toolbar renders that width's default.
   *
   * The `.catch` is the same load-bearing absorber as `colorBlind` below: this
   * field used to be a flat `string[]` of extension names, and a stored array
   * failing an object schema would reject the *whole* blob and take the user's
   * density and reduced-motion down with a setting nothing ever wrote. No
   * `PREFERENCES_VERSION` bump for the same reason - a field-level absorber is
   * enough, and a version bump would discard the neighbours it is protecting.
   */
  toolbar: z
    .object({
      compact: toolbarLayoutSchema.catch([]).default([]),
      wide: toolbarLayoutSchema.catch([]).default([]),
    })
    .catch({ compact: [], wide: [] })
    .default({ compact: [], wide: [] }),
  /** Which side the note-create button sits on. */
  noteButtonAlignment: z.enum(['left', 'right']).default('right'),
  /**
   * The quick-capture starts, in order, with the same `{ id, on }` rows the
   * toolbar uses - but no families and no Width Classes, because five buttons
   * on one bar have nothing to group and nothing to overflow.
   *
   * Renamed from `quickCaptureButtons`, which defaulted to `['note','checklist']`
   * while the action keys were `text|checklist|audio|drawing|picture`: `'note'`
   * matched nothing, so the field was wrong in every stored copy it never had.
   * The old key is simply dropped on the next write.
   */
  quickCapture: z
    .array(z.object({ id: z.string(), on: z.boolean() }))
    .catch([])
    .default([]),
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
  /**
   * Whether ticking a checklist item drops it to the bottom of its list.
   *
   * Off by default, and a preference rather than a behaviour, because it is an
   * opinion about what a list is for: a shopping list wants done things out of
   * the way, while a ranked list of options wants the order the user put it in
   * left alone. Rewriting that order unasked would be the app losing work.
   */
  sinkCheckedItems: z.boolean().default(false),
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
