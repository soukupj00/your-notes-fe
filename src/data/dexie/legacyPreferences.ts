import { PREFERENCES_STORAGE_KEY } from '@/context/PreferencesProvider.tsx';
import type { NotesDB } from './db.ts';

const LEGACY_ROW_KEY = 'preferences';
// Duplicates `TOUR_PROPS_META_KEY` in `src/lib/tour/props.ts`: `src/data` must not depend on
// `src/lib/tour`. Rename both together, or a legacy database's baselines are orphaned.
const TOUR_PROPS_META_KEY = 'tourProps';

/**
 * One-shot split of the pre-ADR-0020 `preferences` row: choices go to localStorage, the Tour's
 * baselines stay under `meta`, and the row is deleted. Existing localStorage preferences win, so
 * an old row never undoes a newer choice.
 */
export async function migrateLegacyPreferences(db: NotesDB): Promise<void> {
  const row = await db.settings.get(LEGACY_ROW_KEY);
  if (!row) return;
  const { tourProps, ...preferences } = (row.value ?? {}) as Record<string, unknown>;
  // localStorage before the delete: if `setItem` throws or the tab dies in between, the legacy
  // row is still there to retry from, instead of the preferences being lost.
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
