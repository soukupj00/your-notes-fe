import { useSyncExternalStore } from 'react';

type MediaQueryStore = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => boolean;
};

const stores = new Map<string, MediaQueryStore>();

// Built once per query: a new `subscribe` each render would make React resubscribe each render.
function mediaQueryStore(query: string, fallback: boolean): MediaQueryStore {
  const key = `${fallback}:${query}`;
  let store = stores.get(key);
  if (!store) {
    store = {
      subscribe(onChange) {
        const media = globalThis.matchMedia?.(query);
        if (!media) return () => {};
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
      },
      getSnapshot: () => globalThis.matchMedia?.(query).matches ?? fallback,
    };
    stores.set(key, store);
  }
  return store;
}

/**
 * Whether a media query matches, read synchronously so the first paint already agrees with CSS.
 * `fallback` answers where the query cannot be measured.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const store = mediaQueryStore(query, fallback);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => fallback);
}
