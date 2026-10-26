import { useSyncExternalStore } from 'react';

// Built once per query: a new `subscribe` each render would make React resubscribe each render.
function mediaQueryStore(query: string) {
  return {
    subscribe(onChange: () => void) {
      const media = globalThis.matchMedia?.(query);
      if (!media) return () => {};
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    getSnapshot: () => globalThis.matchMedia?.(query).matches ?? false,
  };
}

const primary = mediaQueryStore('(pointer: fine)');
const any = mediaQueryStore('(any-pointer: fine)');

/**
 * Whether the primary pointer is a mouse or trackpad, which decides affordances; never a width
 * (ADR 0016). Unmeasurable reads as `false`, hiding a hint rather than showing an unusable one.
 */
export function useFinePointer(): boolean {
  return useSyncExternalStore(primary.subscribe, primary.getSnapshot, () => false);
}

/** Any mouse or trackpad, even beside a touchscreen: an iPad with a trackpad case (ADR 0028). */
export function useAnyFinePointer(): boolean {
  return useSyncExternalStore(any.subscribe, any.getSnapshot, () => false);
}
