import { PREFERENCES_STORAGE_KEY } from '@/context/PreferencesProvider.tsx';
import type { NotesDB } from './db.ts';

const LEGACY_ROW_KEY = 'preferences';
// Duplicated from `src/lib/tour/props.ts`'s `TOUR_PROPS_META_KEY` on purpose -
// this file lives under `src/data` and must not depend on `src/lib/tour`. If
// you rename one, rename the other, or a legacy database's baselines end up
// orphaned under a key nothing reads any more.
const TOUR_PROPS_META_KEY = 'tourProps';

/**
 * One-shot: before ADR 0020 the Preferences blob was a row in the `settings`
 * table and carried the Tour's Prop baselines inside it. Split it: the user's
 * choices go to localStorage, the baselines stay in the store under `meta`,
 * and the old row is deleted so this runs exactly once per database.
 *
 * localStorage is never overwritten if it already holds preferences - a user
 * who changed a setting after the split must not have it undone by an old row.
 */
export async function migrateLegacyPreferences(db: NotesDB): Promise<void> {
  const row = await db.settings.get(LEGACY_ROW_KEY);
  if (!row) return;
  const { tourProps, ...preferences } = (row.value ?? {}) as Record<string, unknown>;
  // localStorage first, transaction second: if `setItem` throws (quota,
  // disabled storage) or the tab dies in between, the legacy row is still
  // there to retry from next start. Deleting it first would lose the user's
  // preferences for good the moment `setItem` failed.
  if (localStorage.getItem(PREFERENCES_STORAGE_KEY) === null) {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }
  await db.transaction('rw', db.settings, async () => {
    if (Array.isArray(tourProps) && tourProps.length > 0) {
      await db.settings.put({ key: TOUR_PROPS_META_KEY, value: tourProps });
    }
    await db.settings.delete(LEGACY_ROW_KEY);
  });
}
