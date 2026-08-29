import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { z } from 'zod';
import { PREFERENCES_STORAGE_KEY } from '@/data/dexie/legacyPreferences.ts';

/**
 * Schema version of the stored blob. Bump it when a field changes shape in a
 * way defaults can't absorb, and handle the old shape in `parsePreferences`;
 * an unrecognised version is treated as unreadable and falls back to defaults.
 */
export const PREFERENCES_VERSION = 2;

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

const preferencesSchema = z.object({
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
   * Whether a checklist is *shown* with its checked items gathered at the
   * bottom (CONTEXT.md, "Sinking").
   *
   * On by default. It was off while sinking physically reordered the stored
   * body, because rewriting the user's typed order unasked is the app losing
   * work; ADR 0013 made it a presentation rule, so nothing is rewritten and
   * unchecking returns an item to exactly where it was authored. The preference
   * survives for the case where sequence *is* the content - recipe steps, a
   * ranked list of options - which is real but a minority.
   */
  sinkCheckedItems: z.boolean().default(true),
  /** `system` follows `prefers-reduced-motion`; the others override it. */
  reducedMotion: z.enum(['system', 'always', 'never']).default('system'),
  /**
   * ISO timestamp of when the Tour was first *shown* - stamped as step 1
   * renders, not on completion (ADR 0015). The fact worth recording is that the
   * Tour was offered; a flag stamped on completion re-arms after every reload,
   * crash and closed tab, and a tutorial that reappears after you dismissed it
   * is the most irritating thing this feature can do.
   */
  onboardingSeenAt: z.string().optional(),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferenceKey = Exclude<keyof Preferences, 'version'>;

export const DEFAULT_PREFERENCES: Preferences = preferencesSchema.parse({
  version: PREFERENCES_VERSION,
});

/**
 * Brings a blob written by an older schema version up to the current one.
 *
 * Runs *before* the schema sees it, which is the only place it can: `version`
 * is a `z.literal`, so a stored older version fails validation outright and
 * `parsePreferences` would fall back to defaults - wiping the toolbar, density
 * and reduced-motion settings this is meant to preserve.
 *
 * Must stay idempotent. Nothing writes the migrated blob back (a read never
 * destroys data), so this re-runs on every read until the next `setPreference`
 * happens to persist the new version.
 */
function migratePreferences(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const blob = raw as Record<string, unknown>;

  // v1 → v2 (ADR 0013): sinking became a presentation rule, so the reason it
  // defaulted off - that it rewrote the user's stored order - is gone. Forced
  // rather than left to the new default, because `setPreference` persists the
  // whole parsed blob: every user who has ever changed any setting already has
  // `sinkCheckedItems: false` on disk, so a changed default would reach nobody.
  //
  // This does overrule the handful of users who turned sinking on and then off
  // again in the two days the setting existed. A stored `false` is
  // indistinguishable from the old default, and being opted into a behaviour
  // that no longer destroys anything is benign.
  if (blob.version === 1) return { ...blob, version: 2, sinkCheckedItems: true };

  return blob;
}

/**
 * Preferences are cosmetic, so an unreadable blob must never block the app:
 * anything that fails the schema (corrupt, hand-edited, or written by a version
 * we don't know) yields defaults. The bad blob is deliberately left on disk -
 * the next `setPreference` replaces it, but a mere read never destroys data we
 * might want to inspect.
 */
function parsePreferences(raw: unknown): Preferences {
  const parsed = preferencesSchema.safeParse(migratePreferences(raw));
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
}

function readStored(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return parsePreferences(raw === null ? undefined : JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

type PreferencesContextType = {
  preferences: Preferences;
  setPreference: <K extends PreferenceKey>(key: K, value: Preferences[K]) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

/**
 * User Preferences (CONTEXT.md), one Zod-validated blob in localStorage beside
 * Theme and Locale (ADR 0020). Read synchronously, so the first render already
 * has the user's density and motion choice - there is no hydration step.
 *
 * Another tab's write arrives through the `storage` event, so two open tabs
 * cannot disagree.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(readStored);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PREFERENCES_STORAGE_KEY || event.key === null) setPreferences(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback(async function setPreference<K extends PreferenceKey>(
    key: K,
    value: Preferences[K]
  ) {
    // Read-modify-write against storage, not React state: a second write in
    // the same tick must see the first, and localStorage is synchronous.
    const next = { ...readStored(), version: PREFERENCES_VERSION, [key]: value } as Preferences;
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    setPreferences(next);
  }, []);

  const value = useMemo(() => ({ preferences, setPreference }), [preferences, setPreference]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
