import { useEffect, useRef } from 'react';

/**
 * Move focus to the returned element when the view mounts.
 *
 * Each route renders its own view component, so a navigation unmounts the old
 * one and mounts the new: focusing on mount *is* focusing on route change. The
 * target needs `tabIndex={-1}` to be programmatically focusable, and should be
 * the view's `<h1>` so a screen reader announces where the user landed instead
 * of silently leaving focus on the nav link they just clicked.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}
