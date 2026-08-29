import { type DependencyList, useEffect, useState } from 'react';
import type { Live } from './live.ts';

/**
 * The one React adapter for a `Live<T>`. Returns `undefined` until the first
 * value lands, which callers read as "loading" - the same contract
 * `useLiveQuery` had, so hooks keep their public shape.
 *
 * `deps` is the caller's list, exactly as with `useLiveQuery`: the Live is
 * rebuilt (and re-subscribed) when it changes. The last value is kept across
 * that swap on purpose - a route change must not flash skeletons.
 */
export function useLive<T>(make: () => Live<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the caller's, by contract
  useEffect(() => make().subscribe((value) => setValue(value)), deps);
  return value;
}
