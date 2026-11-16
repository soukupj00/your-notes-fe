import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

/**
 * Whether decorative motion should be suppressed. Use it for motion that lives in component
 * state (timers, rotations); `globals.css` already gates CSS transitions.
 */
export function useReducedMotion(): boolean {
  const { preferences } = usePreferences();
  const systemPrefers = useMediaQuery('(prefers-reduced-motion: reduce)');

  if (preferences.reducedMotion === 'always') return true;
  if (preferences.reducedMotion === 'never') return false;
  return systemPrefers;
}
