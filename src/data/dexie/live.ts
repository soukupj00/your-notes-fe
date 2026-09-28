import { liveQuery } from 'dexie';
import type { Live } from '../live.ts';

/** Dexie's `liveQuery` already is the contract; this only narrows its Observable to `Live<T>`. */
export function live<T>(querier: () => T | Promise<T>): Live<T> {
  return {
    subscribe(next) {
      const subscription = liveQuery(querier).subscribe(next);
      return () => subscription.unsubscribe();
    },
  };
}
