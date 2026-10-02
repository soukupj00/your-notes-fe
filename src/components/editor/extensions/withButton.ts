import type { Extendable } from '@tiptap/core';
import type { ButtonContext, ButtonView } from './button-types';

/**
 * Pattern A in one place (ADR 0004): the upstream extension plus a `button` option. `options` are
 * any other defaults the wrapper sets (TextAlign's `types`). The one cast lives here, not per file.
 */
export function withButton<E extends Extendable>(
  upstream: E,
  button: (context: ButtonContext) => ButtonView | ButtonView[],
  options: object = {}
): E {
  return upstream.extend({
    addOptions() {
      return { ...this.parent?.(), ...options, button };
    },
  }) as E;
}
