import { useSyncExternalStore } from 'react';
import { usePreferences } from '@/context/PreferencesProvider.tsx';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const media = globalThis.matchMedia?.(QUERY);
  if (!media) return () => {};
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return globalThis.matchMedia?.(QUERY).matches ?? false;
}

/**
 * Whether decorative motion should be suppressed. Use it for motion that lives in component
 * state (timers, rotations); `globals.css` already gates CSS transitions.
 */
export function useReducedMotion(): boolean {
  const { preferences } = usePreferences();
  const systemPrefers = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (preferences.reducedMotion === 'always') return true;
  if (preferences.reducedMotion === 'never') return false;
  return systemPrefers;
}
