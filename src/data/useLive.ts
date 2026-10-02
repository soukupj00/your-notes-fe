import { type DependencyList, useEffect, useState } from 'react';
import type { Live } from './live.ts';

/**
 * `undefined` until the first value lands means "loading", as with `useLiveQuery`.
 * The last value is kept while `deps` rebuild the Live, so a route change does not flash skeletons.
 */
export function useLive<T>(make: () => Live<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the caller's, by contract
  useEffect(() => make().subscribe((value) => setValue(value)), deps);
  return value;
}
