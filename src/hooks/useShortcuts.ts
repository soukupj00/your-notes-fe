import { useMemo } from 'react';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import {
  assignShortcut,
  resetShortcut,
  resolveShortcuts,
  type ShortcutBindings,
  type StoredShortcuts,
} from '@/lib/shortcuts.ts';

interface Shortcuts {
  bindings: ShortcutBindings;
  stored: StoredShortcuts;
  /** `replacing` loses the combination in the same write, so no moment has it twice. */
  assign: (id: string, combo: string | null, replacing?: string) => void;
  reset: (id: string) => void;
  resetAll: () => void;
}

/** The Shortcuts Preference, resolved against the defaults (ADR 0026). */
export function useShortcuts(): Shortcuts {
  const { preferences, setPreference } = usePreferences();
  const stored = preferences.shortcuts;

  return useMemo(
    () => ({
      bindings: resolveShortcuts(stored),
      stored,
      assign: (id, combo, replacing) =>
        void setPreference('shortcuts', assignShortcut(stored, id, combo, replacing)),
      reset: (id) => void setPreference('shortcuts', resetShortcut(stored, id)),
      resetAll: () => void setPreference('shortcuts', {}),
    }),
    [stored, setPreference]
  );
}
