import type { Live } from '@/data/live.ts';

/**
 * An async lookup shaped as node views' live read (`AttachmentDeps.watchAttachment`), for fixtures
 * without a store. Build it once per render: a new function each render re-subscribes.
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
