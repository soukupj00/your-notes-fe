import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * A stable getter over the latest value, for a callback that is built once (a TipTap extension,
 * an effect that must not re-run) and still has to read the current render.
 */
export function useLatest<T>(value: T): () => T {
  const ref = useRef(value);
  // Written after commit: React's ref rule forbids touching a ref during render.
  useLayoutEffect(() => {
    ref.current = value;
  });
  return useCallback(() => ref.current, []);
}
