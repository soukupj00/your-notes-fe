export type Unsubscribe = () => void;

/**
 * Delivers the present value (asynchronously), then every value later writes produce.
 * Deliberately minimal: no operators, no error channel - a read that throws is a store bug.
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
