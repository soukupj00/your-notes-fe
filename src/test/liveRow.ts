import type { Live } from '@/data/live.ts';

/**
 * An async lookup as the live read node views take (`AttachmentDeps.watchAttachment`),
 * for fixtures without a store: it delivers the lookup's answer once. Build it once
 * per render, since a new function each render re-subscribes.
 */
export function liveRow<T>(get: (id: string) => Promise<T>): (id: string) => Live<T> {
  return (id) => ({
    subscribe(next) {
      let on = true;
      void get(id).then((value) => {
        if (on) next(value);
      });
      return () => {
        on = false;
      };
    },
  });
}
