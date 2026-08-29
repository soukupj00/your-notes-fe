export type Unsubscribe = () => void;

/**
 * A value the Local Store keeps current. `subscribe` delivers the present value
 * (asynchronously) and every later value the store's writes produce, until the
 * returned function is called.
 *
 * Deliberately the smallest observable that works: one method, no operators,
 * no error channel. A read that throws is a bug in the store, not an event.
 */
export interface Live<T> {
  subscribe(next: (value: T) => void): Unsubscribe;
}

/** A Live that delivers `value` once, asynchronously, and never again. For callers with nothing to watch. */
export function emptyLive<T>(value: T): Live<T> {
  return {
    subscribe(next) {
      let live = true;
      queueMicrotask(() => {
        if (live) next(value);
      });
      return () => {
        live = false;
      };
    },
  };
}
