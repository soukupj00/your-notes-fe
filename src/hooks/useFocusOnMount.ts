import { useEffect, useRef } from 'react';

/**
 * Focuses the returned element on mount, which is on route change: each route mounts its own view.
 * Attach it to the view's `<h1 tabIndex={-1}>` so a screen reader announces where the user landed.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}
