import type { Extendable } from '@tiptap/core';

/** The upstream extension minus the bindings the user's Shortcuts own instead (ADR 0026). */
export function withoutKeys<E extends Extendable>(upstream: E, keys: string[]): E {
  return upstream.extend({
    addKeyboardShortcuts() {
      const bindings = this.parent?.() ?? {};
      return Object.fromEntries(Object.entries(bindings).filter(([key]) => !keys.includes(key)));
    },
  }) as E;
}
