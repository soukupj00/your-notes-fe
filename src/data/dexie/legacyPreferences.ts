import { PREFERENCES_STORAGE_KEY } from '@/context/PreferencesProvider.tsx';
import type { NotesDB } from './db.ts';

const LEGACY_ROW_KEY = 'preferences';

/**
 * One-shot move of the pre-ADR-0020 `preferences` row to localStorage, then the row is deleted.
 * Existing localStorage preferences win, so an old row never undoes a newer choice.
 */
export async function migrateLegacyPreferences(db: NotesDB): Promise<void> {
  const row = await db.settings.get(LEGACY_ROW_KEY);
  if (!row) return;
  // localStorage before the delete: if `setItem` throws or the tab dies in between, the legacy
  // row is still there to retry from, instead of the preferences being lost.
  if (localStorage.getItem(PREFERENCES_STORAGE_KEY) === null) {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(row.value ?? {}));
  }
  await db.settings.delete(LEGACY_ROW_KEY);
}
