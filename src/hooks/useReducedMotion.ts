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
 * Whether decorative motion should be suppressed.
 *
 * The stored `reducedMotion` preference wins when it is an explicit
 * `always`/`never`; `system` (the default) defers to the OS media query. This is
 * the JS-side counterpart to the `prefers-reduced-motion` blocks in
 * `globals.css` - use it for motion that only exists in a component's state
 * (timers, rotations), not for CSS transitions the stylesheet can already gate.
 *
 * `useSyncExternalStore` rather than an effect: a media query is exactly the
 * external store it exists for, and mirroring it into state would mean a
 * setState-in-effect on every mount.
 */
export function useReducedMotion(): boolean {
  const { preferences } = usePreferences();
  const systemPrefers = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (preferences.reducedMotion === 'always') return true;
  if (preferences.reducedMotion === 'never') return false;
  return systemPrefers;
}
