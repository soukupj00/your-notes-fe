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

/** Row key Preferences live under in `localStorage`; `legacyPreferences.ts` writes the same key. */
export const PREFERENCES_STORAGE_KEY = 'preferences';

/**
 * Schema version of the stored blob. Bump it when a field changes shape in a
 * way defaults can't absorb, and handle the old shape in `parsePreferences`;
 * an unrecognised version is treated as unreadable and falls back to defaults.
 */
export const PREFERENCES_VERSION = 2;

/** The choices a segmented Settings row offers, in display order; the schema validates the same lists. */
export const NOTE_BUTTON_ALIGNMENT_OPTIONS = ['left', 'right'] as const;
export const DENSITY_OPTIONS = ['comfortable', 'compact'] as const;
export const REDUCED_MOTION_OPTIONS = ['system', 'always', 'never'] as const;

/** One leaf inside a stored family: array position is its order on the bar. */
const toolbarMemberSchema = z.object({ id: z.string(), on: z.boolean() });

/**
 * Ids are plain strings, not the registry's unions: a blob from a later release may name Items
 * this build does not know, and they must survive a round-trip (ADR 0011, decision 8).
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
   * One Toolbar Layout per Width Class (ADR 0011); empty means "never customised". The `.catch`
   * absorbs the old flat `string[]`, which would reject the whole blob; no version bump, as that
   * would discard the neighbours it protects.
   */
  toolbar: z
    .object({
      compact: toolbarLayoutSchema.catch([]).default([]),
      wide: toolbarLayoutSchema.catch([]).default([]),
    })
    .catch({ compact: [], wide: [] })
    .default({ compact: [], wide: [] }),
  /** Which side the note-create button sits on. */
  noteButtonAlignment: z.enum(NOTE_BUTTON_ALIGNMENT_OPTIONS).default('right'),
  /**
   * The quick-capture starts in order, as the toolbar's `{ id, on }` rows without families: five
   * buttons have nothing to group. Replaces `quickCaptureButtons`, whose default matched no action
   * key; the old key is dropped on the next write.
   */
  quickCapture: z
    .array(z.object({ id: z.string(), on: z.boolean() }))
    .catch([])
    .default([]),
  /**
   * One colour-vision palette on top of light/dark, tuned against every condition at once rather
   * than one per condition (DESIGN.md). The `.catch` absorbs the old enum, which would otherwise
   * reject the whole blob and reset every other setting with it.
   */
  colorBlind: z.boolean().catch(false).default(false),
  density: z.enum(DENSITY_OPTIONS).default('comfortable'),
  /**
   * Whether a checklist is *shown* with checked items at the bottom (CONTEXT.md, "Sinking").
   * On by default since ADR 0013 made it presentation only; off serves lists whose order matters.
   */
  sinkCheckedItems: z.boolean().default(true),
  /**
   * Whether Sync downloads every Attachment's full bytes to this Device after
   * each pull (04-sync.md "Attachment transfer"). Off: Previews arrive eagerly
   * and full bytes on the first tap, which is what a phone's storage wants.
   */
  keepEverything: z.boolean().default(false),
  /** `system` follows `prefers-reduced-motion`; the others override it. */
  reducedMotion: z.enum(REDUCED_MOTION_OPTIONS).default('system'),
  /**
   * When the Settings Tour was first *offered*, not completed (ADR 0015): a completion flag would
   * re-arm after every reload, and bring back a tutorial the user dismissed. The name predates
   * the Tour's move into Settings (ADR 0024).
   */
  onboardingSeenAt: z.string().optional(),
  /** When the launch Welcome was offered (ADR 0024); stamped on offer for the same reason. */
  welcomeSeenAt: z.string().optional(),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferenceKey = Exclude<keyof Preferences, 'version'>;

export const DEFAULT_PREFERENCES: Preferences = preferencesSchema.parse({
  version: PREFERENCES_VERSION,
});

/**
 * Upgrades an older blob before the schema sees it: `version` is a literal, so an old one would
 * fail and reset everything. Must stay idempotent: nothing writes the result back, so it re-runs
 * on every read until the next `setPreference`.
 */
function migratePreferences(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const blob = raw as Record<string, unknown>;

  // v1 → v2 (ADR 0013): forced, not left to the new default, because anyone who changed a setting
  // already stores `sinkCheckedItems: false`. It overrules the few who chose off, which is benign:
  // a stored `false` is indistinguishable from the old default.
  if (blob.version === 1) return { ...blob, version: 2, sinkCheckedItems: true };

  return blob;
}

/**
 * Anything unreadable yields defaults, so a bad blob never blocks the app. It is left on disk:
 * a read never destroys data, and the next `setPreference` replaces it.
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
 * User Preferences (CONTEXT.md), one Zod-validated blob in `localStorage` (ADR 0020). Read
 * synchronously, so the first render already has them; another tab's write arrives via `storage`.
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
