import { Fragment } from 'react';
import { comboParts } from '@/lib/key-combo.ts';
import { getShortcutKeys } from '@/lib/shortcut-keys.ts';

/**
 * `tracking-normal`: the label token's spacing shifts a cap's glyph off centre.
 * `font-sans`: most monospace faces lack the modifier symbols.
 */
const KEYCAP =
  'inline-flex min-w-7 items-center justify-center rounded-control border bg-muted px-1.5 py-1 font-sans text-label text-muted-foreground tracking-normal';

/** `Control + Shift + S` for a screen reader, which reads `⇧` as punctuation or not at all. */
export function readableCombo(combo: string): string {
  return getShortcutKeys(comboParts(combo))
    .map((part) => part.readable)
    .join(' + ');
}

/** The caps as printed on the keyboard; whatever holds them is named with `readableCombo`. */
export function ShortcutKeys({ combo }: { combo: string }) {
  return (
    <span aria-hidden className="flex items-center gap-1">
      {getShortcutKeys(comboParts(combo)).map((part, index) => (
        <Fragment key={part.readable}>
          {index > 0 && <span className="text-muted-foreground text-xs">+</span>}
          <kbd className={KEYCAP}>{part.symbol}</kbd>
        </Fragment>
      ))}
    </span>
  );
}
